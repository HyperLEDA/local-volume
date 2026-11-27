"""Scientific and materialization invariants; no PostgreSQL mutations."""

from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pytest

from lv_backend.data import physical, physical_refresh
from lv_backend.domain.physical_calculations import FORMULA_VERSION, physical_from_observed
from lv_backend.domain.tidal_calculations import environment_from_prepared, prepared_environment_donors


def fixture_galaxy(pgc: int, *, ra: float = 10.0, ks: float = 9.0) -> dict[str, Any]:
    return {
        "pgc": pgc,
        "name": f"PGC{pgc}",
        "ra": ra,
        "dec": 0.0,
        "mu": 27.9,
        "dist": 3.8,
        "morphology_t": 8,
        "axis_ratio": 0.6,
        "a26_arcmin": 5.0,
        "a_b_galactic_mag": 0.2,
        "b_mag": 12.0,
        "ks_mag": ks,
        "ks_estimated": False,
        "w50_kms": 100.0,
        "hi21_mag": 12.0,
        "hi21_limit": None,
        "ha_mag": 16.0,
        "ha_limit": None,
        "fuv_mag": 17.0,
        "fuv_limit": None,
    }


def test_full_batch_includes_objects_without_observations() -> None:
    raw = [fixture_galaxy(1), {"pgc": 2, "name": "PGC2", "ra": None, "dec": None}]
    computed = physical_refresh.compute_rows(raw, 12)
    assert len(computed) == 2
    assert computed[0][0] == 1 and computed[1][0] == 2
    assert computed[0][-1] == 12 and computed[1][-1] == 12
    assert computed[1][1] is None  # No fabricated linear diameter.
    assert all(not field.endswith("_published") for field in physical_refresh._STORED)  # noqa: SLF001


def test_removing_donor_changes_main_disturber_and_tidal_index() -> None:
    target = fixture_galaxy(1, ra=10)
    near = fixture_galaxy(2, ra=10.01, ks=7)
    far = fixture_galaxy(3, ra=10.08, ks=7)
    catalog = [target, near, far]
    donors = prepared_environment_donors(catalog, [physical_from_observed(x) for x in catalog])
    first = environment_from_prepared(target, donors)
    assert first["md_pgc"] == 2
    new_donors = [donor for donor in donors if donor[0] != 2]
    after = environment_from_prepared(target, new_donors)
    assert after["md_pgc"] == 3
    assert isinstance(after["theta1"], float) and after["theta1"] < first["theta1"]


def test_updates_to_other_galaxies_affect_target_environment() -> None:
    target = fixture_galaxy(1)
    donor = fixture_galaxy(2, ra=10.01, ks=10)
    catalog = [target, donor]
    baseline = environment_from_prepared(
        target, prepared_environment_donors(catalog, [physical_from_observed(x) for x in catalog])
    )
    donor["ks_mag"] = 6.0
    refreshed = environment_from_prepared(
        target, prepared_environment_donors(catalog, [physical_from_observed(x) for x in catalog])
    )
    assert refreshed["theta1"] - baseline["theta1"] == pytest.approx(1.6, abs=1e-9)


def test_missing_sfr_inputs_return_missing_not_zero() -> None:
    raw = fixture_galaxy(1)
    raw["ha_mag"] = None
    raw["fuv_mag"] = None
    vals = physical_from_observed(raw)
    assert vals["log_sfr_halpha_msun_yr"] is None
    assert vals["log_sfr_fuv_msun_yr"] is None


def test_milky_way_global_hi_is_not_derived_from_observer_flux() -> None:
    raw = fixture_galaxy(5064336)
    vals = physical_from_observed(raw)
    assert vals["log_mhi_msun"] == pytest.approx(9.47)
    assert vals["physical_method"] == "MW_GLOBAL_LVGDB_TABLE2_JUST2015_V1"
    env = environment_from_prepared(raw, [])
    assert env["environment_coverage"] == "MW_GEOMETRY_EXCEPTION"


def test_refresh_state_requires_formula_version_epoch_and_full_coverage() -> None:
    good = {
        "source_revision": 7,
        "applied_revision": 7,
        "formula_version": FORMULA_VERSION,
        "object_count": 2,
        "computed_count": 2,
    }
    assert not physical_refresh.needs_refresh(good)
    for changes in (
        {"source_revision": 8},
        {"formula_version": "outdated-formula"},
        {"computed_count": 1},
    ):
        assert physical_refresh.needs_refresh({**good, **changes})


class FakeStorage:
    def __init__(self, row: dict[str, Any] | None):
        self.row = row
        self.queries: list[tuple[str, Sequence[Any] | None]] = []

    def query(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        self.queries.append((sql, params))
        return [self.row] if self.row is not None else []


def test_api_reads_only_materialized_computed_values() -> None:
    raw = {
        "pgc": 1,
        "source_revision": 2,
        "applied_revision": 2,
        "computed_revision": 2,
        "formula_version": FORMULA_VERSION,
        "a26_kpc": 8.5,
        "md_name": "NGC 123",
        "a26_kpc_published": 99.0,
    }
    store = FakeStorage(raw)
    result = physical.select_physical(store, 1)
    assert result is not None and result["physical_status"] == "ready"
    assert result["a26_kpc"] == 8.5
    assert "a26_kpc_published" not in result
    assert "lv.physical" in store.queries[0][0]
    assert "lv.observed" not in store.queries[0][0]


def test_api_marks_stale_values_as_pending() -> None:
    store = FakeStorage(
        {
            "pgc": 1,
            "source_revision": 3,
            "applied_revision": 2,
            "computed_revision": 2,
            "formula_version": FORMULA_VERSION,
        }
    )
    assert physical.select_physical(store, 1) == {"pgc": 1, "physical_status": "pending"}


def test_insert_statement_and_delete_statement_invalidate_cache() -> None:
    migration = Path(__file__).resolve().parents[1] / "postgres/migrations/0010.lv_physical_precomputed.sql"
    contents = migration.read_text(encoding="utf-8")
    assert "AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON lv.observed" in contents
    assert "AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON lv.objects" in contents
    assert "ON DELETE CASCADE" in contents


def test_unresolved_science_hold_is_not_computed_or_used_as_donor() -> None:
    held = fixture_galaxy(2807149)
    held["ra"] = 10.001
    normal = fixture_galaxy(1)
    prepared = physical_refresh.compute_rows([normal, held], 2)
    assert prepared[1][0] == 2807149
    assert prepared[1][1] is None  # No physical diameter for HOLD.
    # No allowed donor can be built from the HOLD object.
    donors = prepared_environment_donors([held], [physical_from_observed(held)])
    assert donors == []
