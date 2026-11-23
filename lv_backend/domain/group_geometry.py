import math
import re
from typing import Literal

DistanceOrigin = Literal["DIRECT_MEASURED", "GROUP_ASSIGNED", "MODEL_INFERRED", "UNKNOWN"]
Vector3 = tuple[float, float, float]

_DIRECT = re.compile(
    r"trgb|tip of the red giant|cepheid|\bsbf\b|surface brightness fluctuation|"
    r"maser|rr\s*lyrae|tully[ -]?fisher|\bpnlf\b|eclipsing binar",
    re.IGNORECASE,
)
_GROUP = re.compile(r"group|membership|member|assigned|assumed|host distance|suite", re.IGNORECASE)
_MODEL = re.compile(r"hubble|kinematic|redshift|velocity distance|model|flow distance", re.IGNORECASE)


def valid_distance(value: float | int | None) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def distance_origin(distance_mpc: float | None, method: str | None) -> DistanceOrigin:
    if not valid_distance(distance_mpc) or not method or not method.strip():
        return "UNKNOWN"
    direct = _DIRECT.search(method) is not None
    group = _GROUP.search(method) is not None
    model = _MODEL.search(method) is not None
    if sum((direct, group, model)) != 1:
        return "UNKNOWN"
    if group:
        return "GROUP_ASSIGNED"
    if model:
        return "MODEL_INFERRED"
    return "DIRECT_MEASURED"


def icrs_direction(ra_deg: float, dec_deg: float) -> Vector3 | None:
    if not (math.isfinite(ra_deg) and math.isfinite(dec_deg) and -90 <= dec_deg <= 90):
        return None
    ra, dec = math.radians(ra_deg % 360), math.radians(dec_deg)
    return math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)


def angular_separation_deg(ra1: float, dec1: float, ra2: float, dec2: float) -> float | None:
    a, b = icrs_direction(ra1, dec1), icrs_direction(ra2, dec2)
    if a is None or b is None:
        return None
    cross = (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )
    norm_cross = math.hypot(*cross)
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    return math.degrees(math.atan2(norm_cross, dot))


def cartesian_mpc(ra_deg: float, dec_deg: float, distance_mpc: float | None) -> Vector3 | None:
    direction = icrs_direction(ra_deg, dec_deg)
    if direction is None or not valid_distance(distance_mpc):
        return None
    distance = float(distance_mpc)
    return (distance * direction[0], distance * direction[1], distance * direction[2])


def local_position_kpc(
    center_ra: float,
    center_dec: float,
    center_distance_mpc: float | None,
    member_ra: float,
    member_dec: float,
    member_distance_mpc: float | None,
    *,
    center_origin: DistanceOrigin,
    member_origin: DistanceOrigin,
) -> Vector3 | None:
    if center_origin != "DIRECT_MEASURED" or member_origin != "DIRECT_MEASURED":
        return None
    origin = cartesian_mpc(center_ra, center_dec, center_distance_mpc)
    target = cartesian_mpc(member_ra, member_dec, member_distance_mpc)
    if origin is None or target is None:
        return None
    ra, dec = math.radians(center_ra % 360), math.radians(center_dec)
    east: Vector3 = (-math.sin(ra), math.cos(ra), 0.0)
    north: Vector3 = (-math.sin(dec) * math.cos(ra), -math.sin(dec) * math.sin(ra), math.cos(dec))
    los = icrs_direction(center_ra, center_dec)
    if los is None:
        return None
    delta = tuple(t - c for t, c in zip(target, origin, strict=True))
    return (
        1000 * sum(d * basis for d, basis in zip(delta, east, strict=True)),
        1000 * sum(d * basis for d, basis in zip(delta, north, strict=True)),
        1000 * sum(d * basis for d, basis in zip(delta, los, strict=True)),
    )


def spatial_separation_mpc(
    ra1: float,
    dec1: float,
    distance1_mpc: float | None,
    ra2: float,
    dec2: float,
    distance2_mpc: float | None,
    *,
    origin1: DistanceOrigin,
    origin2: DistanceOrigin,
) -> float | None:
    if origin1 != "DIRECT_MEASURED" or origin2 != "DIRECT_MEASURED":
        return None
    a = cartesian_mpc(ra1, dec1, distance1_mpc)
    b = cartesian_mpc(ra2, dec2, distance2_mpc)
    if a is None or b is None:
        return None
    return math.dist(a, b)


def separation_range_mpc(
    ra1: float,
    dec1: float,
    distance1_mpc: float | None,
    minus1_mpc: float | None,
    plus1_mpc: float | None,
    ra2: float,
    dec2: float,
    distance2_mpc: float | None,
    minus2_mpc: float | None,
    plus2_mpc: float | None,
    *,
    origin1: DistanceOrigin,
    origin2: DistanceOrigin,
) -> tuple[float, float] | None:
    if origin1 != "DIRECT_MEASURED" or origin2 != "DIRECT_MEASURED":
        return None
    if not all(
        isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0
        for v in (minus1_mpc, plus1_mpc, minus2_mpc, plus2_mpc)
    ) or not (valid_distance(distance1_mpc) and valid_distance(distance2_mpc)):
        return None
    distance1_mpc = float(distance1_mpc)
    distance2_mpc = float(distance2_mpc)
    minus1_mpc, plus1_mpc = float(minus1_mpc), float(plus1_mpc)
    minus2_mpc, plus2_mpc = float(minus2_mpc), float(plus2_mpc)
    bounds1 = (distance1_mpc - minus1_mpc, distance1_mpc + plus1_mpc)
    bounds2 = (distance2_mpc - minus2_mpc, distance2_mpc + plus2_mpc)
    if bounds1[0] <= 0 or bounds2[0] <= 0:
        return None
    angle = angular_separation_deg(ra1, dec1, ra2, dec2)
    if angle is None:
        return None
    cos_angle = math.cos(math.radians(angle))

    def clamp(value: float, bounds: tuple[float, float]) -> float:
        return min(bounds[1], max(bounds[0], value))

    def distance(d1: float, d2: float) -> float:
        return math.sqrt(max(0, (d1 - d2) ** 2 + 2 * d1 * d2 * (1 - cos_angle)))

    candidates = [(d1, d2) for d1 in bounds1 for d2 in bounds2]
    candidates += [(d1, clamp(d1 * cos_angle, bounds2)) for d1 in bounds1]
    candidates += [(clamp(d2 * cos_angle, bounds1), d2) for d2 in bounds2]
    values = [distance(d1, d2) for d1, d2 in candidates]
    return min(values), max(values)
