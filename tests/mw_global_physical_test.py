"""Explicit MW global model; no external-galaxy flux inference."""

import pytest

from lv_backend.domain.physical_calculations import physical_from_observed
from lv_backend.domain.tidal_calculations import MW_PGC, MW_TIDAL_LOG_LK, prepared_environment_donors


def test_mw_global_values_and_provenance() -> None:
    raw = {"pgc": MW_PGC, "ra": 266.4168, "dec": -29.00781, "mu": 14.5, "e_mu": 0.11}
    result = physical_from_observed(raw)
    assert result["abs_b_mag"] == -19.1
    assert result["abs_ks_mag"] == -24.2
    assert result["log_lks_lsun"] == pytest.approx(10.992)
    assert result["log_mhi_msun"] == 9.47
    assert result["log_mhi_limit_flag"] is None
    assert result["ks_estimated"] is True
    assert result["ks_mag_used"] is None
    assert result["ks_method"] == "MW_GLOBAL_K_JUST2015_MODEL"
    assert result["distance_mpc"] == pytest.approx(0.007943282347242814)
    assert result["distance_error_basis"] == "observed_mu_e_mu_exact"
    assert prepared_environment_donors([raw], [result])[0][3] == MW_TIDAL_LOG_LK


def test_mw_external_inputs_never_generate_false_parameters() -> None:
    raw = {
        "pgc": MW_PGC,
        "mu": 14.5,
        "b_mag": 99,
        "ks_mag": 99,
        "axis_ratio": 0.5,
        "morphology_t": 4,
        "w50_kms": 440,
        "a26_arcmin": 100,
        "a_b_galactic_mag": 0,
        "hi21_mag": 3.4,
        "hi21_limit": "-",
        "ha_mag": 12,
        "fuv_mag": 10,
    }
    result = physical_from_observed(raw)
    for key in (
        "a26_kpc",
        "inclination_deg",
        "vrot_kms",
        "a_b_internal_mag",
        "mean_sb_b_mag_arcsec2",
        "log_m26_msun",
        "log_sfr_halpha_msun_yr",
        "log_sfr_fuv_msun_yr",
    ):
        assert result[key] is None
    assert result["log_mhi_msun"] == 9.47
    assert result["abs_ks_mag"] == -24.2


def test_other_pgc_does_not_receive_global_model() -> None:
    result = physical_from_observed({"pgc": 17223})
    assert result["abs_b_mag"] is None
    assert result["abs_ks_mag"] is None
    assert result["log_mhi_msun"] is None
    assert result["physical_method"] != "MW_GLOBAL_LVGDB_TABLE2_JUST2015_V1"
