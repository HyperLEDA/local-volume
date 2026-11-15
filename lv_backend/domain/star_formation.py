"""Local Volume H-alpha/FUV SFR calibrations (Karachentsev et al. 2013)."""

import math
from typing import Any

_HA_MAG_ZERO_POINT = 13.64
_HA_SFR_FACTOR = 0.945e9
_HA_EXTINCTION_FACTOR = 0.538
_FUV_EXTINCTION_FACTOR = 1.93
_FUV_SFR_ZERO_POINT = 2.78


def _number(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        result = float(value)  # PostgreSQL NUMERIC may arrive as Decimal or string.
    except (TypeError, ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def _qualifier(value: object) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str) and value.strip() in ("", ">"):
        return value.strip() or None
    return "invalid"


def log_sfr(
    *,
    distance_mpc: object,
    magnitude: object,
    galactic_b_extinction_mag: object,
    internal_b_extinction_mag: object,
    tracer: str,
    magnitude_qualifier: object = None,
) -> tuple[float | None, bool]:
    """Return log10[SFR/(solar mass/yr)] and whether it is an upper limit.

    The catalog's magnitude qualifier '>' means a flux/SFR upper limit.
    Unavailable/invalid inputs do not become zero-extinction estimates.
    """
    distance = _number(distance_mpc)
    mag = _number(magnitude)
    a_g = _number(galactic_b_extinction_mag)
    a_i = _number(internal_b_extinction_mag)
    qualifier = _qualifier(magnitude_qualifier)
    if (
        distance is None
        or distance <= 0
        or mag is None
        or a_g is None
        or a_g < 0
        or a_i is None
        or a_i < 0
        or qualifier == "invalid"
    ):
        return None, False

    if tracer == "halpha":
        # m(Ha) = -2.5 log10 F(Ha) - 13.64 [F in erg cm^-2 s^-1].
        log_flux = -0.4 * (mag + _HA_MAG_ZERO_POINT)
        log_rate = (
            math.log10(_HA_SFR_FACTOR)
            + log_flux
            + 2.0 * math.log10(distance)
            + 0.4 * _HA_EXTINCTION_FACTOR * (a_g + a_i)
        )
    elif tracer == "fuv":
        # m(FUV,c) = m(FUV) - 1.93 * (A_B^G + A_B^i).
        corrected_mag = mag - _FUV_EXTINCTION_FACTOR * (a_g + a_i)
        log_rate = _FUV_SFR_ZERO_POINT - 0.4 * corrected_mag + 2.0 * math.log10(distance)
    else:
        raise ValueError(f"Unsupported SFR tracer: {tracer}")

    return log_rate, qualifier == ">"


def derived_sfr_values(observed: dict[str, Any], physical: dict[str, Any]) -> dict[str, object]:
    """Calculate two UI-preview SFRs, without persisting changes to lv.physical."""
    shared = {
        "distance_mpc": observed.get("dist"),
        "galactic_b_extinction_mag": observed.get("a_b_galactic_mag"),
        "internal_b_extinction_mag": physical.get("a_b_internal_mag_published"),
    }
    h_alpha, ha_upper = log_sfr(
        **shared,
        magnitude=observed.get("ha_mag"),
        magnitude_qualifier=observed.get("ha_limit"),
        tracer="halpha",
    )
    fuv, fuv_upper = log_sfr(
        **shared,
        magnitude=observed.get("fuv_mag"),
        magnitude_qualifier=observed.get("fuv_limit"),
        tracer="fuv",
    )
    return {
        "log_sfr_halpha_msun_yr": h_alpha,
        "log_sfr_fuv_msun_yr": fuv,
        "log_sfr_halpha_upper_limit": ha_upper,
        "log_sfr_fuv_upper_limit": fuv_upper,
    }
