"""Local-volume-only environment estimators (candidate, incomplete census).

Equations 12–14 of Karachentsev, Makarov & Kaisina (2013), AJ 145, 101.
The MW effective K luminosity is a frozen LVGDB tidal calibration, not
independent photometry. See docs/mw-tidal-calibration.md.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

from lv_backend.domain.physical_calculations import distance_and_modulus, number, physical_from_observed

TIDAL_C = 10.96
GLOBAL_K_DENSITY = 4.28e8  # L_Ksun / Mpc^3; Jones et al. (2006).
SPHERE_1MPC_VOLUME = 4.0 * math.pi / 3.0
MW_PGC = 5064336
SCIENCE_HOLD_PGC = 2807149
# Median from 71 published MW MD rows in the audited frozen Table 2 snapshot.
# Freeze the calibration; never refit it during a normal catalogue refresh.
MW_TIDAL_LOG_LK = 10.553407183824561


def cartesian(ra_deg: float, dec_deg: float, distance_mpc: float) -> tuple[float, float, float]:
    alpha, delta = math.radians(ra_deg), math.radians(dec_deg)
    return (
        distance_mpc * math.cos(delta) * math.cos(alpha),
        distance_mpc * math.cos(delta) * math.sin(alpha),
        distance_mpc * math.sin(delta),
    )


def coordinates(row: Mapping[str, Any]) -> tuple[float, float, float] | None:
    ra, dec = number(row.get("ra")), number(row.get("dec"))
    distance, _, _ = distance_and_modulus(row)
    if ra is None or dec is None or distance is None or not 0 <= ra < 360 or not -90 <= dec <= 90:
        return None
    if row.get("pgc") == MW_PGC:
        # The observed catalogue row is the Galactic centre, not an external
        # integrated source. Refuse implausible centre geometry instead of
        # treating MW as a distant external galaxy or putting it at the Sun.
        if not 0.005 <= distance <= 0.015:
            return None
        centre = cartesian(266.4168, -29.00781, 1.0)
        direction = cartesian(ra, dec, 1.0)
        if math.dist(centre, direction) > 2 * math.sin(math.radians(1.0) / 2):
            return None
    return cartesian(ra, dec, distance)


def prepared_environment_donors(
    rows: Sequence[Mapping[str, Any]],
    physical: Sequence[Mapping[str, Any]],
) -> list[tuple[int, str, tuple[float, float, float], float]]:
    """Build one shared donor census; MW uses the explicit tidal calibration."""
    donors: list[tuple[int, str, tuple[float, float, float], float]] = []
    for row, computed in zip(rows, physical, strict=True):
        pgc = row.get("pgc")
        if not isinstance(pgc, int) or pgc == SCIENCE_HOLD_PGC:
            continue
        position = coordinates(row)
        log_lk = MW_TIDAL_LOG_LK if pgc == MW_PGC else computed.get("log_lks_lsun")
        if position is None or not isinstance(log_lk, float) or not math.isfinite(log_lk):
            continue
        donors.append((pgc, str(row.get("name") or pgc), position, log_lk))
    return donors


def environment_from_prepared(
    target: Mapping[str, Any],
    donors: Sequence[tuple[int, str, tuple[float, float, float], float]],
) -> dict[str, object]:
    """All-neighbor estimate from a snapshot; incomplete spatial census is explicit."""
    result: dict[str, object] = {
        "md_pgc": None,
        "theta1": None,
        "theta5": None,
        "thetaj": None,
        "environment_coverage": "INCOMPLETE_LV_ONLY",
        "environment_donors_used": 0,
        "environment_neighbors_1mpc": 0,
    }
    xyz = coordinates(target)
    if xyz is None:
        result["environment_coverage"] = (
            "MW_GEOMETRY_EXCEPTION" if target.get("pgc") == MW_PGC else "TARGET_GEOMETRY_MISSING"
        )
        return result
    strengths: list[tuple[float, int, float, float]] = []
    for other_pgc, _name, donor_xyz, log_lk in donors:
        if other_pgc == target.get("pgc"):
            continue
        separation = math.dist(xyz, donor_xyz)
        if separation <= 0:
            continue
        strengths.append((log_lk - 3 * math.log10(separation), other_pgc, separation, log_lk))
    result["environment_donors_used"] = len(strengths)
    if not strengths:
        return result
    strengths.sort(key=lambda item: (-item[0], item[1]))
    top = strengths[0][0]
    result["md_pgc"] = strengths[0][1]
    result["theta1"] = top - TIDAL_C
    if len(strengths) >= 5:
        result["theta5"] = top + math.log10(math.fsum(10 ** (s[0] - top) for s in strengths[:5])) - TIDAL_C
    within_1mpc = [s[3] for s in strengths if s[2] <= 1.0]
    result["environment_neighbors_1mpc"] = len(within_1mpc)
    if within_1mpc:
        log_lmax = max(within_1mpc)
        luminosity = 10**log_lmax * math.fsum(10 ** (v - log_lmax) for v in within_1mpc)
        result["thetaj"] = math.log10(luminosity / (SPHERE_1MPC_VOLUME * GLOBAL_K_DENSITY))
    return result


def environment_from_observed(target: Mapping[str, Any], donors: Sequence[Mapping[str, Any]]) -> dict[str, object]:
    """Compatibility entry point; use the same donor and environment policies."""
    if coordinates(target) is None:
        return {**environment_from_prepared(target, []), "md_name": None}
    prepared = prepared_environment_donors(
        donors,
        [
            {} if row.get("pgc") in (MW_PGC, SCIENCE_HOLD_PGC, target.get("pgc")) else physical_from_observed(row)
            for row in donors
        ],
    )
    result = environment_from_prepared(target, prepared)
    result["md_name"] = next((name for pgc, name, _, _ in prepared if pgc == result["md_pgc"]), None)
    return result
