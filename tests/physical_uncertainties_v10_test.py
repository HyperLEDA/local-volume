import math

import pytest

from lv_backend.domain.physical_uncertainties import derived_adopted_uncertainties


def test_modulus_yields_asymmetric_distance_errors():
    row = derived_adopted_uncertainties({"mu": 30.0, "e_mu": 0.2, "dist": 20.0})
    assert row["distance_mpc"] == pytest.approx(10.0)
    assert row["e_distance_minus_mpc"] == pytest.approx(10 * (1 - 10 ** (-0.04)))
    assert row["e_distance_plus_mpc"] == pytest.approx(10 * (10**0.04 - 1))
    assert row["distance_error_basis"] == "observed_mu_e_mu_exact"


def test_bare_distance_does_not_borrow_or_invent_error():
    row = derived_adopted_uncertainties({"dist": 5.0, "e_mu": 0.3})
    assert row["distance_mpc"] == 5.0
    assert row["e_distance_minus_mpc"] is None
    assert row["e_distance_plus_mpc"] is None


def test_lvg_hel_uncertainty_is_source_paired_and_propagates_additively():
    row = derived_adopted_uncertainties(
        {"lvg_v_hel_kms": 120.0, "lvg_v_lg_kms": 156.0, "lvg_e_v_hel_kms": 7.0, "e_v_lg": 100.0}
    )
    assert row["v_lg_kms"] == 156.0
    assert row["e_v_lg_kms"] == 7.0
    assert row["velocity_error_basis"] == "lvg_e_v_hel_kms_paired"


def test_do_not_borrow_legacy_velocity_error():
    row = derived_adopted_uncertainties({"lvg_v_lg_kms": 210.0, "e_v_lg": 11.0, "v_lg": 185.0})
    assert row["v_lg_kms"] == 210.0
    assert row["e_v_lg_kms"] is None


def test_legacy_velocity_pair_only_when_native_absent():
    row = derived_adopted_uncertainties({"v_lg": -33.0, "e_v_lg": 3.0})
    assert row["v_lg_kms"] == -33.0
    assert row["e_v_lg_kms"] == 3.0


def test_missing_invalid_and_zero_inputs():
    row = derived_adopted_uncertainties(
        {"mu": 30, "e_mu": -0.3, "lvg_v_lg_kms": 100, "lvg_v_hel_kms": 55, "lvg_e_v_hel_kms": float("nan")}
    )
    assert row["e_distance_plus_mpc"] is None
    assert row["e_v_lg_kms"] is None
    zero = derived_adopted_uncertainties({"mu": 30.0, "e_mu": 0})
    assert math.isclose(zero["e_distance_minus_mpc"], 0)
    assert math.isclose(zero["e_distance_plus_mpc"], 0)


def test_pathological_modulus_error_cannot_crash_full_refresh():
    row = derived_adopted_uncertainties({"mu": 30.0, "e_mu": 1e9})
    assert row["distance_mpc"] == pytest.approx(10.0)
    assert row["e_distance_plus_mpc"] is None
