"""Uncertainty propagation for the adopted Local Volume kinematics and distances.

The provenance rule is strict: never borrow the uncertainty of a different
measurement just because its numerical value is similar. Missing source errors
remain NULL; no cosmological or group-distance uncertainty is invented.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any


def finite(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(value)
    except (ValueError, TypeError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def nonnegative(value: object) -> float | None:
    number = finite(value)
    return number if number is not None and number >= 0 else None


def derived_adopted_uncertainties(observed: Mapping[str, Any]) -> dict[str, object]:
    """Derive D and VLG with matched observational-error provenance.

    Distance uses the very same mu-first policy as physical_from_observed().
    e_mu is symmetric in magnitudes but yields asymmetric errors in D.
    When only a bare catalogue distance exists, no uncertainty is assumed.

    A Local Group velocity correction is additive for a fixed sky position,
    so the measurement error of the *paired* heliocentric measurement passes
    through unchanged; this excludes uncertainties of the frame definition.
    """
    mu = finite(observed.get("mu"))
    d_source = "missing"
    dist: float | None = None
    err_minus: float | None = None
    err_plus: float | None = None
    distance_error_basis: str | None = None

    if mu is not None:
        candidate = 10 ** ((mu - 25.0) / 5.0)
        if math.isfinite(candidate) and candidate > 0:
            dist = candidate
            d_source = "observed_mu"
            e_mu = nonnegative(observed.get("e_mu"))
            if e_mu is not None:
                # Extremely large/invalid catalogue errors must not crash a
                # full physical refresh. Preserve a NULL uncertainty instead.
                try:
                    high = 10.0 ** (e_mu / 5.0)
                except OverflowError:
                    high = float("inf")
                if math.isfinite(high):
                    err_minus = dist * (1.0 - 1.0 / high)
                    err_plus = dist * (high - 1.0)
                    if math.isfinite(err_minus) and math.isfinite(err_plus):
                        distance_error_basis = "observed_mu_e_mu_exact"
                    else:
                        err_minus = err_plus = None
    if dist is None:
        direct = finite(observed.get("dist"))
        if direct is not None and direct > 0:
            dist = direct
            d_source = "observed_dist"
            # lv.observed has no source-paired e_dist. Its e_mu, if any,
            # must not be used without a usable mu.

    adopted_native = finite(observed.get("lvg_v_lg_kms"))
    native_hel = finite(observed.get("lvg_v_hel_kms"))
    legacy = finite(observed.get("v_lg"))
    vlg: float | None = None
    e_vlg: float | None = None
    velocity_error_basis: str | None = None
    if adopted_native is not None:
        vlg = adopted_native
        if native_hel is not None:
            paired = nonnegative(observed.get("lvg_e_v_hel_kms"))
            if paired is not None:
                e_vlg = paired
                velocity_error_basis = "lvg_e_v_hel_kms_paired"
        # Do NOT fall back to an unrelated legacy e_v_lg if no native error.
    elif legacy is not None:
        vlg = legacy
        paired = nonnegative(observed.get("e_v_lg"))
        if paired is not None:
            e_vlg = paired
            velocity_error_basis = "observed_v_lg_e_v_lg"
        elif finite(observed.get("v_hel")) is not None:
            paired_hel = nonnegative(observed.get("e_v_hel"))
            if paired_hel is not None:
                e_vlg = paired_hel
                velocity_error_basis = "observed_v_hel_e_v_hel_paired"

    return {
        "distance_mpc": dist,
        "e_distance_minus_mpc": err_minus,
        "e_distance_plus_mpc": err_plus,
        "distance_error_basis": distance_error_basis,
        "v_lg_kms": vlg,
        "e_v_lg_kms": e_vlg,
        "velocity_error_basis": velocity_error_basis,
        "adopted_distance_basis": d_source,
    }
