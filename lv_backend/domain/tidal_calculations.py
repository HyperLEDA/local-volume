"""Local-volume-only environment estimators (candidate, incomplete census).

Equations 12–14 of Karachentsev, Makarov & Kaisina (2013), AJ 145, 101.
Values are **not** a reproduction of published full-neighborhood indices.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Any

from lv_backend.domain.physical_calculations import distance_and_modulus, number, physical_from_observed

TIDAL_C = 10.96
GLOBAL_K_DENSITY = 4.28e8  # L_Ksun / Mpc^3; Jones et al. (2006).
SPHERE_1MPC_VOLUME = 4.0 * math.pi / 3.0


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
    return cartesian(ra, dec, distance)


def environment_from_observed(target: Mapping[str, Any], donors: Sequence[Mapping[str, Any]]) -> dict[str, object]:
    """Estimate MD / theta from **available** LV donors only.

    Missing outside-volume giants, galaxies lacking reliable distances or
    luminosities, and Milky Way Galactocentric geometry cannot be recovered
    from a local lv.objects/lv.observed table. Results must remain marked
    provisional; no external identifiers or catalog values are invented.
    """
    result: dict[str, object] = {
        "md_pgc": None,
        "md_name": None,
        "theta1": None,
        "theta5": None,
        "thetaj": None,
        "environment_coverage": "INCOMPLETE_LV_ONLY",
        "environment_donors_used": 0,
        "environment_neighbors_1mpc": 0,
    }
    target_xyz = coordinates(target)
    if target_xyz is None:
        result["environment_coverage"] = "TARGET_GEOMETRY_MISSING"
        return result
    pgc = target.get("pgc")
    neighbors: list[tuple[float, int, str, float, float]] = []
    for donor in donors:
        donor_pgc = donor.get("pgc")
        if donor_pgc == pgc or donor_pgc == 5064336 or not isinstance(donor_pgc, int):
            # MW's Sun-centered RA/Dec do not describe its galactocentric position.
            continue
        xyz = coordinates(donor)
        if xyz is None:
            continue
        log_lk = physical_from_observed(donor)["log_lks_lsun"]
        if not isinstance(log_lk, float):
            continue
        r = math.dist(target_xyz, xyz)
        if r <= 0:
            continue
        strength = log_lk - 3.0 * math.log10(r)
        neighbors.append((strength, donor_pgc, str(donor.get("name") or donor_pgc), r, log_lk))
    result["environment_donors_used"] = len(neighbors)
    if not neighbors:
        return result

    neighbors.sort(key=lambda item: (-item[0], item[1]))
    strongest, best_pgc, best_name, _, _ = neighbors[0]
    result["md_pgc"] = best_pgc
    result["md_name"] = best_name
    result["theta1"] = strongest - TIDAL_C
    if len(neighbors) >= 5:
        weighted = math.fsum(10 ** (item[0] - strongest) for item in neighbors[:5])
        result["theta5"] = strongest + math.log10(weighted) - TIDAL_C

    luminosities = [10 ** item[4] for item in neighbors if item[3] <= 1.0]
    result["environment_neighbors_1mpc"] = len(luminosities)
    # Never fill 2013's artificial -3.0 placeholder for a zero-neighbor region:
    # zero known neighbors does not mean zero true neighbors with incomplete coverage.
    if luminosities:
        result["thetaj"] = math.log10(math.fsum(luminosities) / (SPHERE_1MPC_VOLUME * GLOBAL_K_DENSITY))
    return result


def prepared_environment_donors(
    rows: Sequence[Mapping[str, Any]],
    physical: Sequence[Mapping[str, Any]],
) -> list[tuple[int, str, tuple[float, float, float], float]]:
    """Build one shared in-memory donor census for a full catalog refresh."""
    donors: list[tuple[int, str, tuple[float, float, float], float]] = []
    for row, computed in zip(rows, physical, strict=True):
        pgc = row.get("pgc")
        if not isinstance(pgc, int) or pgc in (5064336, 2807149):
            continue  # The Milky Way needs Galactocentric rather than Sun-centered geometry.
        position = coordinates(row)
        log_lk = computed.get("log_lks_lsun")
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
    if target.get("pgc") == 5064336:
        result["environment_coverage"] = "MW_GEOMETRY_EXCEPTION"
        return result
    xyz = coordinates(target)
    if xyz is None:
        result["environment_coverage"] = "TARGET_GEOMETRY_MISSING"
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
