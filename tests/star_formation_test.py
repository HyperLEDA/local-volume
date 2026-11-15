import math

import pytest

from lv_backend.domain.star_formation import derived_sfr_values, log_sfr


def test_halpha_catalog_equations() -> None:
    value, upper = log_sfr(
        distance_mpc=3.85,
        magnitude=14.6,
        galactic_b_extinction_mag=0.29,
        internal_b_extinction_mag=0.02,
        tracer="halpha",
    )
    flux = 10 ** (-0.4 * (14.6 + 13.64))
    corrected_flux = flux * 10 ** (0.4 * 0.538 * (0.29 + 0.02))
    expected = math.log10(0.945e9 * 3.85**2 * corrected_flux)
    assert value == pytest.approx(expected, abs=1e-12)
    assert upper is False


def test_fuv_catalog_equations() -> None:
    value, upper = log_sfr(
        distance_mpc="3.85",
        magnitude="14.2",
        galactic_b_extinction_mag="0.29",
        internal_b_extinction_mag="0.02",
        tracer="fuv",
    )
    expected = 2.78 - 0.4 * (14.2 - 1.93 * 0.31) + 2 * math.log10(3.85)
    assert value == pytest.approx(expected, abs=1e-12)
    assert upper is False


def test_fainter_than_magnitude_limit_becomes_sfr_upper_limit() -> None:
    value, upper = log_sfr(
        distance_mpc=3,
        magnitude=20,
        galactic_b_extinction_mag=0.2,
        internal_b_extinction_mag=0,
        tracer="fuv",
        magnitude_qualifier=">",
    )
    assert value is not None and upper


def test_missing_inputs_never_assume_zero_extinction_or_distance() -> None:
    for d, a_g, a_i in ((0, 0.2, 0), (3, None, 0), (3, 0.2, None), (3, -0.1, 0), (3, 0, -0.1)):
        value, upper = log_sfr(
            distance_mpc=d,
            magnitude=16,
            galactic_b_extinction_mag=a_g,
            internal_b_extinction_mag=a_i,
            tracer="halpha",
        )
        assert value is None and upper is False


def test_unsupported_qualifier_does_not_invent_upper_limit() -> None:
    value, _ = log_sfr(
        distance_mpc=3,
        magnitude=16,
        galactic_b_extinction_mag=0.1,
        internal_b_extinction_mag=0,
        tracer="halpha",
        magnitude_qualifier="<",
    )
    assert value is None


def test_derived_sfr_values_handles_missing_photometry() -> None:
    output = derived_sfr_values({"dist": 3, "a_b_galactic_mag": 0.1}, {"a_b_internal_mag_published": 0})
    assert output["log_sfr_halpha_msun_yr"] is None
    assert output["log_sfr_fuv_msun_yr"] is None


def test_invalid_tracer_raises_valueerror() -> None:
    with pytest.raises(ValueError):
        log_sfr(distance_mpc=3, magnitude=16, galactic_b_extinction_mag=0.1, internal_b_extinction_mag=0, tracer="x")
