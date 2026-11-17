"""Run against the patched real lv_backend pipeline, not a mock database."""

import pytest

from lv_backend.domain.physical_calculations import FORMULA_VERSION, physical_from_observed


def test_pipeline_exposes_propagated_uncertainties():
    row = physical_from_observed(
        {
            "pgc": 42,
            "mu": 29.5,
            "e_mu": 0.15,
            "dist": 11.1,
            "lvg_v_hel_kms": 311.0,
            "lvg_v_lg_kms": 351.0,
            "lvg_e_v_hel_kms": 9.5,
        }
    )
    assert FORMULA_VERSION == "lv-physical-precomputed-2026-11-17-v2-uncertainties"
    assert row["distance_mpc"] == pytest.approx(10**0.9)
    assert row["e_distance_minus_mpc"] is not None
    assert row["e_distance_plus_mpc"] is not None
    assert row["e_distance_plus_mpc"] > row["e_distance_minus_mpc"]
    assert row["v_lg_kms"] == 351
    assert row["e_v_lg_kms"] == 9.5


def test_pipeline_does_not_report_missing_errors():
    row = physical_from_observed({"pgc": 43, "dist": 4.0, "lvg_v_lg_kms": 420.0})
    assert row["distance_mpc"] == 4.0
    assert row["e_distance_plus_mpc"] is None
    assert row["e_distance_minus_mpc"] is None
    assert row["e_v_lg_kms"] is None
