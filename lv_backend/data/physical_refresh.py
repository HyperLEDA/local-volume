"""Durable, transactionally consistent precomputation of lv.physical.

Statement-level triggers increment lv.physical_refresh_state.source_revision on
any source-table write. Workers build all physical rows from one repeatable-read
snapshot, then atomically publish them only if no source changes intervened.
The catalog size (~1,677 galaxies) permits a full refresh of the tidal census.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Mapping
from typing import Any, cast

import psycopg
import psycopg.rows

from lv_backend.data.storage import StorageConfig
from lv_backend.domain.physical_calculations import FORMULA_VERSION, physical_from_observed
from lv_backend.domain.tidal_calculations import environment_from_prepared, prepared_environment_donors

_LOG = logging.getLogger(__name__)
_REFRESH_LOCK = 2026111601

_SOURCE = """
SELECT o.pgc, o.name, o.ra, o.dec,
       v.dist, v.mu, v.morphology_t, v.axis_ratio, v.a26_arcmin,
       v.a_b_galactic_mag, v.b_mag, v.ks_mag, v.ks_estimated,
       v.w50_kms, v.hi21_mag, v.hi21_limit,
       v.ha_mag, v.ha_limit, v.fuv_mag, v.fuv_limit
FROM lv.objects AS o
LEFT JOIN lv.observed AS v USING (pgc)
ORDER BY o.pgc
"""

# Deliberately never populate or read any *_published or old calc_* fields.
_STORED = (
    "a26_kpc",
    "inclination_deg",
    "vrot_kms",
    "a_b_internal_mag",
    "abs_b_mag",
    "abs_ks_mag",
    "mean_sb_b_mag_arcsec2",
    "log_lks_lsun",
    "log_m26_msun",
    "log_mhi_msun",
    "derived_hi_limit_flag",
    "log_sfr_halpha_msun_yr",
    "log_sfr_fuv_msun_yr",
    "log_sfr_halpha_upper_limit",
    "log_sfr_fuv_upper_limit",
    "ks_mag_used",
    "ks_estimated",
    "ks_method",
    "distance_method",
    "internal_extinction_method",
    "md_pgc",
    "theta1",
    "theta5",
    "thetaj",
    "environment_coverage",
    "environment_donors_used",
    "environment_neighbors_1mpc",
    "physical_method",
)
_COLS = ("pgc", *_STORED, "computed_revision")
_INSERT = (
    f"INSERT INTO lv.physical ({', '.join(_COLS)}, computed_at) "
    + f"VALUES ({', '.join('%s' for _ in _COLS)}, clock_timestamp()) "
    + "ON CONFLICT (pgc) DO UPDATE SET "
    + ", ".join(f"{name}=EXCLUDED.{name}" for name in _STORED)
    + ", computed_revision=EXCLUDED.computed_revision, computed_at=clock_timestamp()"
)


def needs_refresh(state: Mapping[str, Any]) -> bool:
    return (
        state["source_revision"] != state["applied_revision"]
        or state["formula_version"] != FORMULA_VERSION
        or state["computed_count"] != state["object_count"]
    )


def _read_snapshot(dsn: str) -> tuple[int, list[dict[str, Any]]] | None:
    with psycopg.connect(dsn, row_factory=psycopg.rows.dict_row) as conn:
        with conn.transaction():
            conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            state = conn.execute("""
                SELECT s.source_revision, s.applied_revision, s.formula_version,
                       (SELECT count(*) FROM lv.objects) AS object_count,
                       (SELECT count(*) FROM lv.physical
                        WHERE computed_revision = s.source_revision) AS computed_count
                FROM lv.physical_refresh_state AS s WHERE s.singleton = true
            """).fetchone()
            if state is None:
                raise RuntimeError("Missing singleton refresh-state row")
            if not needs_refresh(state):
                return None
            rows = list(conn.execute(_SOURCE).fetchall())
            return cast(dict[str, Any], state)["source_revision"], rows


def compute_rows(source: list[dict[str, Any]], revision: int) -> list[tuple[object, ...]]:
    """Pure batch computation; each donor's luminosity is calculated only once."""
    scalar = [physical_from_observed(row) if row["pgc"] != 2807149 else {} for row in source]
    donors = prepared_environment_donors(source, scalar)
    output: list[tuple[object, ...]] = []
    for row, quantities in zip(source, scalar, strict=True):
        if row["pgc"] == 2807149:
            # Explicit science HOLD: count the object, but never derive science
            # values or allow it to contribute as a tidal donor until resolved.
            record = {"physical_method": "SCIENCE_HOLD", "environment_coverage": "SCIENCE_HOLD"}
        else:
            record = {**quantities, **environment_from_prepared(row, donors)}
        # The legacy 0006 column log_mhi_limit_flag is an original published
        # source qualifier. Never overwrite it; store derived qualifier separately.
        record["derived_hi_limit_flag"] = record.get("log_mhi_limit_flag")
        output.append((row["pgc"], *(record.get(field) for field in _STORED), revision))
    return output


def refresh_once(dsn: str) -> bool:
    """Return True only after an entire updated snapshot was committed."""
    snapshot = _read_snapshot(dsn)
    if snapshot is None:
        return False
    revision, objects = snapshot
    results = compute_rows(objects, revision)
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_xact_lock(%s)", (_REFRESH_LOCK,))
            if not cur.fetchone()[0]:
                return False  # Another worker is already publishing a generation.
            cur.execute("SELECT source_revision FROM lv.physical_refresh_state WHERE singleton = true FOR UPDATE")
            state = cur.fetchone()
            if state is None or state[0] != revision:
                return False  # A source write occurred during computation; retry next tick.
            cur.executemany(_INSERT, results)
            cur.execute(
                "DELETE FROM lv.physical AS p WHERE NOT EXISTS (SELECT 1 FROM lv.objects o WHERE o.pgc = p.pgc)"
            )
            cur.execute(
                """
                UPDATE lv.physical_refresh_state
                SET applied_revision = %s, formula_version = %s,
                    refreshed_at = clock_timestamp(), last_error = NULL, last_error_at = NULL
                WHERE singleton = true
            """,
                (revision, FORMULA_VERSION),
            )
    _LOG.info("Physical-property refresh committed: generation=%s, objects=%s", revision, len(objects))
    return True


def record_error(dsn: str, message: str) -> None:
    with psycopg.connect(dsn) as conn:
        conn.execute(
            """
            UPDATE lv.physical_refresh_state
               SET last_error = %s, last_error_at = clock_timestamp()
             WHERE singleton = true
        """,
            (message[:2000],),
        )


def background_refresh(config: StorageConfig, stop_event: threading.Event, poll_seconds: float = 5.0) -> None:
    """Service loop; a failure remains visible in lv.physical_refresh_state."""
    dsn = config.get_dsn()
    while not stop_event.is_set():
        try:
            refresh_once(dsn)
        except Exception as error:  # noqa: BLE001 - service loop must survive transient database errors.
            _LOG.exception("Physical refresh failed; pending generation retained")
            try:
                record_error(dsn, f"{type(error).__name__}: {error}")
            except psycopg.Error:
                _LOG.exception("Cannot persist physical-refresh error")
        stop_event.wait(poll_seconds)
