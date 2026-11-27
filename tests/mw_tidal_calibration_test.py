"""MW calibrated tidal proxy and observer-inside group regression tests."""

from __future__ import annotations

import math
from typing import Any

import pytest

from lv_backend.domain.groups import _live_components, _summary
from lv_backend.domain.tidal_calculations import (
    MW_PGC,
    MW_TIDAL_LOG_LK,
    TIDAL_C,
    coordinates,
    environment_from_observed,
    environment_from_prepared,
    prepared_environment_donors,
)


def mw_row() -> dict[str, Any]:
    return {"pgc": MW_PGC, "name": "Milky Way", "ra": 266.4168, "dec": -29.00781, "mu": 14.5}


def test_mw_donor_is_calibrated_not_photometric() -> None:
    mw = mw_row()
    donors = prepared_environment_donors([mw], [{"log_lks_lsun": 99.0}])
    assert len(donors) == 1
    assert donors[0][3] == MW_TIDAL_LOG_LK
    assert math.hypot(*donors[0][2]) == pytest.approx(0.007943282347242814)
    assert prepared_environment_donors([mw], [{}]) == donors


def test_mw_invalid_centre_fails_closed() -> None:
    for changes in ({"mu": 25}, {"ra": 10}, {"dec": None}, {"mu": None}):
        raw = {**mw_row(), **changes}
        assert coordinates(raw) is None
        assert prepared_environment_donors([raw], [{}]) == []
        assert environment_from_prepared(raw, [])["environment_coverage"] == "MW_GEOMETRY_EXCEPTION"


def test_mw_can_be_md_and_never_self_donor() -> None:
    mw = mw_row()
    target = {"pgc": 1, "name": "Test", "ra": mw["ra"], "dec": mw["dec"], "dist": 0.05}
    donors = prepared_environment_donors([mw, target], [{}, {"log_lks_lsun": 8.0}])
    sep = math.dist(donors[0][2], donors[1][2])
    res = environment_from_prepared(target, donors)
    assert res["md_pgc"] == MW_PGC
    assert res["theta1"] == pytest.approx(MW_TIDAL_LOG_LK - 3 * math.log10(sep) - TIDAL_C)
    assert res["environment_donors_used"] == 1
    own = environment_from_prepared(mw, donors)
    assert own["md_pgc"] == 1
    assert own["theta1"] == pytest.approx(8 - 3 * math.log10(sep) - TIDAL_C)
    assert own["environment_donors_used"] == 1
    assert environment_from_observed(target, [mw])["md_pgc"] == MW_PGC


def test_mw_cycle_root_uses_tidal_proxy_not_missing_photometry() -> None:
    def row(pgc: int, md: int, lk: float | None) -> dict[str, object]:
        return {
            "pgc": pgc,
            "name": str(pgc),
            "ra": 10.0,
            "dec": 0.0,
            "dist_mpc": 0.05,
            "md_pgc_computed": md,
            "theta1_computed": 2.0,
            "log_lks_lsun": lk,
            "morphology_t": 4,
            "b_mag": None,
            "lvg_v_lg_kms": None,
            "abs_b_mag": None,
            "log_mhi_msun": None,
            "log_m26_msun": None,
            "environment_coverage": "INCOMPLETE_LV_ONLY",
        }

    rows = [row(MW_PGC, 1, None), row(1, MW_PGC, 8.0), row(2, 1, 7.0)]
    for definition in ("physical", "suite"):
        groups = _live_components(rows, definition)
        assert list(groups) == [MW_PGC]
        assert len(groups[MW_PGC]) == 3
        assert groups[MW_PGC][0]["parent_md_pgc"] is None
        assert groups[MW_PGC][0]["log_lks_lsun"] is None


def test_mw_group_projected_extent_is_not_external_projection() -> None:
    header: dict[str, object] = {
        "root_pgc": MW_PGC,
        "root_ra": 266.4168,
        "root_dec": -29.00781,
        "root_dist_mpc": 0.007943282347242814,
        "group_id": -MW_PGC,
        "root_name": "Milky Way",
        "definition": "physical",
        "data_status": "computed",
        "source_catalog": "lv.physical",
        "source_version": "test",
    }
    members: list[dict[str, object]] = [
        {"pgc": MW_PGC, "ra": 266.4168, "dec": -29.00781, "parent_md_pgc": None},
        {"pgc": 1, "ra": 10.0, "dec": 0.0, "parent_md_pgc": MW_PGC},
    ]
    assert _summary(header, members, (None, None))["extent_kpc"] is None
