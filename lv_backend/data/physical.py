"""Serve previously computed physical values; never calculate within the request."""

from __future__ import annotations

from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION

DISPLAY_FIELDS = (
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
    "computed_revision",
    "computed_at",
)

_SELECT = """
SELECT o.pgc, p.*, s.source_revision, s.applied_revision, s.formula_version,
       md.name AS md_name
FROM lv.objects AS o
CROSS JOIN lv.physical_refresh_state AS s
LEFT JOIN lv.physical AS p ON p.pgc = o.pgc
LEFT JOIN lv.objects AS md ON md.pgc = p.md_pgc
WHERE o.pgc = %s AND s.singleton = true
"""


def select_physical(storage: Storage, pgc: int) -> dict[str, object] | None:
    rows = storage.query(_SELECT, (pgc,))
    if not rows:
        return None
    source = rows[0]
    fresh = (
        source["source_revision"] == source["applied_revision"]
        and source["formula_version"] == FORMULA_VERSION
        and source.get("computed_revision") == source["source_revision"]
    )
    if not fresh:
        return {"pgc": pgc, "physical_status": "pending"}
    result: dict[str, object] = {"pgc": pgc, "physical_status": "ready"}
    for field in DISPLAY_FIELDS:
        result[field] = source.get(field)
    result["log_mhi_limit_flag"] = source.get("derived_hi_limit_flag")
    result["md_name"] = source.get("md_name")
    return result


def refresh_status(storage: Storage) -> dict[str, object]:
    """Administrative diagnostics; never causes a recomputation in an API call."""
    rows = storage.query("""
        SELECT source_revision, applied_revision, formula_version,
               source_changed_at, refreshed_at, last_error, last_error_at,
               (SELECT count(*) FROM lv.objects) AS object_count,
               (SELECT count(*) FROM lv.physical
                WHERE computed_revision = applied_revision) AS computed_count
        FROM lv.physical_refresh_state WHERE singleton = true
    """)
    if not rows:
        return {"ready": False, "error": "Refresh state is missing"}
    state = rows[0]
    return {
        **state,
        "ready": state["source_revision"] == state["applied_revision"]
        and state["formula_version"] == FORMULA_VERSION
        and state["computed_count"] == state["object_count"],
        "expected_formula_version": FORMULA_VERSION,
    }
