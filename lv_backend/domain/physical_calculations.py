"""Precomputed Local Volume derived quantities.

Scientific convention: Karachentsev, Makarov & Kaisina (2013), AJ 145, 101,
with the explicit W50 turbulence-correction candidate from the audited PR #5.
Source observations are immutable. No values are read from lv.physical.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

from lv_backend.domain.star_formation import log_sfr

FORMULA_VERSION = "lv-physical-precomputed-2026-11-16-v1"
M_K_SUN = 3.28
A_KS_OVER_A_B = 0.085
ARC_MIN_TO_RAD = math.pi / (180.0 * 60.0)


def number(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        converted = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return converted if math.isfinite(converted) else None


def positive(value: object) -> float | None:
    converted = number(value)
    return converted if converted is not None and converted > 0 else None


def nonnegative(value: object) -> float | None:
    converted = number(value)
    return converted if converted is not None and converted >= 0 else None


def is_true(value: object) -> bool:
    return value is True or (isinstance(value, str) and value.lower() in ("true", "t", "1"))


def morphological_color(t: float) -> float:
    if t < 3:
        return 4.1
    return 4.6 - 0.25 * t if t <= 8 else 2.35


def distance_and_modulus(observed: Mapping[str, Any]) -> tuple[float | None, float | None, str]:
    """Use unrounded Table-6 mu when available; fall back to LVG distance."""
    mu = number(observed.get("mu"))
    if mu is not None:
        distance = 10 ** ((mu - 25.0) / 5.0)
        if math.isfinite(distance) and distance > 0:
            return distance, mu, "observed_mu"
    distance = positive(observed.get("dist"))
    if distance is not None:
        return distance, 5.0 * math.log10(distance) + 25.0, "observed_dist"
    return None, None, "missing_distance"


def inclination(t: float | None, q: float | None) -> float | None:
    if t is None or q is None or not 0 < q <= 1:
        return None
    if t <= 8:
        q0 = 10 ** -(0.43 + 0.053 * t)
    elif t in (9, 10):
        q0 = 10**-0.38
    else:
        return None  # No approved intrinsic axial-ratio rule for T > 10.
    if not 0 < q0 < 1:
        return None
    sin2 = (1.0 - q * q) / (1.0 - q0 * q0)
    return math.degrees(math.asin(math.sqrt(min(1.0, max(0.0, sin2)))))


def rotation_velocity(w50: float | None, inc_deg: float | None) -> float | None:
    if w50 is None or w50 <= 0 or inc_deg is None or not 0 < inc_deg <= 90:
        return None
    # Audited PR #5: Tully-Fouque profile turbulence correction; candidate parameters.
    e = math.exp(-((w50 / 120.0) ** 2))
    w_corr_sq = w50 * w50 + 24.0**2 * (1.0 - 2.0 * e) - 2.0 * w50 * 24.0 * (1.0 - e)
    w_corr = max(5.0, math.sqrt(max(0.0, w_corr_sq)))
    return w_corr / (2.0 * math.sin(math.radians(inc_deg)))


def internal_extinction(vm: float | None, q: float | None) -> float | None:
    if vm is None or q is None or not 0 < q <= 1:
        return None
    if 2 * vm <= 78:
        return 0.0
    gamma = 1.54 + 2.54 * (math.log10(2.0 * vm) - 2.5)
    return max(0.0, gamma * math.log10(1.0 / q))


def corrected_a26_arcmin(
    diameter_arcmin: float | None,
    galactic_extinction: float | None,
    q: float | None,
    t: float | None,
) -> float | None:
    if diameter_arcmin is None or galactic_extinction is None or q is None or t is None or not 0 < q <= 1:
        return None
    kd = 0.094 if t >= 0 else 0.081 - 0.016 * t
    correction_dex = kd * galactic_extinction - 0.04 * math.log10(1.0 / q)
    return diameter_arcmin * 10**correction_dex


def physical_from_observed(observed: Mapping[str, Any]) -> dict[str, object]:
    """Compute single-galaxy physical quantities from adopted observed inputs.

    Missing inputs propagate as None. The catalog's adopted physical parameters
    (e.g. published M26) are never consulted. A missing W50 implies transparent
    gas-poor / low-linewidth approximation, explicitly flagged in the response.
    """
    distance, mu, distance_method = distance_and_modulus(observed)
    t = number(observed.get("morphology_t"))
    q = positive(observed.get("axis_ratio"))
    if q is not None and q > 1:
        q = None
    w50 = positive(observed.get("w50_kms"))
    b = number(observed.get("b_mag"))
    ks = number(observed.get("ks_mag"))
    a_g = nonnegative(observed.get("a_b_galactic_mag"))
    diameter = positive(observed.get("a26_arcmin"))
    i = inclination(t, q)
    vm = rotation_velocity(w50, i)
    a_i = internal_extinction(vm, q)
    ai_assumption = "measured_w50" if vm is not None else "unavailable"
    if vm is None and w50 is None and i is not None:
        # Legacy LVGDB convention used during P1/P3 staging. Treat this as
        # an assumption, not as a measurement of internal extinction.
        a_i = 0.0
        ai_assumption = "transparent_assumption_no_w50"

    a_corr = corrected_a26_arcmin(diameter, a_g, q, t)
    a26_kpc = a_corr * distance * ARC_MIN_TO_RAD * 1000.0 if a_corr is not None and distance is not None else None
    total_a_b = a_g + a_i if a_g is not None and a_i is not None else None
    mb = b - mu - total_a_b if b is not None and mu is not None and total_a_b is not None else None
    sb = (
        b - total_a_b + 5.0 * math.log10(a_corr) + 8.63
        if b is not None and total_a_b is not None and a_corr is not None
        else None
    )

    ks_is_estimated = is_true(observed.get("ks_estimated"))
    ks_basis = "measured" if ks is not None and not ks_is_estimated else "unavailable"
    if (ks is None or ks_is_estimated) and b is not None and t is not None and total_a_b is not None:
        # B-Ks color refers to extinction-corrected magnitudes.
        ks = b - morphological_color(t) - (1.0 - A_KS_OVER_A_B) * total_a_b
        ks_is_estimated = True
        ks_basis = "B_T_extinction_corrected_estimate"
    elif ks is not None and ks_is_estimated:
        ks_basis = "adopted_estimated_ks"
    elif ks is not None:
        ks_basis = "measured"

    log_lk = (
        0.4 * (M_K_SUN - ks + mu + A_KS_OVER_A_B * total_a_b)
        if ks is not None and mu is not None and total_a_b is not None
        else None
    )
    mk = M_K_SUN - 2.5 * log_lk if log_lk is not None else None
    log_m26 = (
        math.log10(3.31e4 * vm**2 * a_corr * distance)
        if vm is not None and a_corr is not None and distance is not None
        else None
    )

    m21 = number(observed.get("hi21_mag"))
    hi_limit = observed.get("hi21_limit")
    log_mhi: float | None = None
    hi_flag: str | None = None
    if observed.get("pgc") != 5064336 and m21 is not None and distance is not None and hi_limit in (None, "", ">"):
        log_mhi = math.log10(2.356e5) + 2.0 * math.log10(distance) + 0.4 * (17.4 - m21)
        hi_flag = "<" if hi_limit == ">" else None

    ha, ha_upper = log_sfr(
        distance_mpc=distance,
        magnitude=observed.get("ha_mag"),
        galactic_b_extinction_mag=a_g,
        internal_b_extinction_mag=a_i,
        magnitude_qualifier=observed.get("ha_limit"),
        tracer="halpha",
    )
    fuv, fuv_upper = log_sfr(
        distance_mpc=distance,
        magnitude=observed.get("fuv_mag"),
        galactic_b_extinction_mag=a_g,
        internal_b_extinction_mag=a_i,
        magnitude_qualifier=observed.get("fuv_limit"),
        tracer="fuv",
    )
    return {
        "a26_kpc": a26_kpc,
        "inclination_deg": i,
        "vrot_kms": vm,
        "a_b_internal_mag": a_i,
        "abs_b_mag": mb,
        "abs_ks_mag": mk,
        "mean_sb_b_mag_arcsec2": sb,
        "log_lks_lsun": log_lk,
        "log_m26_msun": log_m26,
        "log_mhi_msun": log_mhi,
        "log_mhi_limit_flag": hi_flag,
        "log_sfr_halpha_msun_yr": ha,
        "log_sfr_fuv_msun_yr": fuv,
        "log_sfr_halpha_upper_limit": ha_upper,
        "log_sfr_fuv_upper_limit": fuv_upper,
        "ks_mag_used": ks,
        "ks_estimated": ks_is_estimated,
        "ks_method": ks_basis,
        "distance_method": distance_method,
        "internal_extinction_method": ai_assumption,
        "physical_method": "LVGDB_2013_PRECOMPUTED_CANDIDATE_V1",
    }
