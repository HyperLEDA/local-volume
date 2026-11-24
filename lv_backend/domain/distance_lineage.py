"""Audit the adopted value and its paired LVG source, without verifying literature."""

import math
from collections.abc import Mapping

# Karachentsev, Makarov & Kaisina (2013), AJ 145, 101, Table 6 notes.
# Individual empirical distance indicators are candidates, not verified depths.
_DIRECT = frozenset({"trgb", "cep", "sn", "sbf", "tf", "fp", "bs", "cmd", "hb", "rr", "pnlf"})
_GROUP = frozenset({"mem", "group assigned", "group membership"})
_MODEL = frozenset({"h", "h'", "nam", "hubble flow model"})


def _finite(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(str(value))
    except (ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def _text(value: object) -> str | None:
    return (value.strip() or None) if isinstance(value, str) else None


def _distance_from_mu(mu: float | None) -> float | None:
    if mu is None:
        return None
    try:
        d = 10.0 ** ((mu - 25.0) / 5.0)
    except OverflowError:
        return None
    return d if math.isfinite(d) and d > 0 else None


def _equal(a: float | None, b: float | None) -> bool:
    return a is not None and b is not None and math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-10)


def classify_method(method: object) -> str:
    value = (_text(method) or "").casefold().replace("′", "'").replace("’", "'")
    if value in _DIRECT:
        return "DIRECT_MEASURED"
    if value in _GROUP:
        return "GROUP_ASSIGNED"
    if value in _MODEL:
        return "MODEL_INFERRED"
    return "UNKNOWN"


def _interval_matches(row: Mapping[str, object], distance: float) -> bool:
    if row.get("distance_error_basis") != "observed_mu_e_mu_exact":
        return False
    error = _finite(row.get("observed_e_mu"))
    if error is None or error < 0:
        return False
    try:
        factor = 10.0 ** (error / 5.0)
        lower = distance * (1.0 - 1.0 / factor)
        upper = distance * (factor - 1.0)
    except OverflowError:
        return False
    return (
        math.isfinite(lower)
        and math.isfinite(upper)
        and lower < distance
        and _equal(_finite(row.get("e_distance_minus_mpc")), lower)
        and _equal(_finite(row.get("e_distance_plus_mpc")), upper)
    )


def audit_distance_lineage(row: Mapping[str, object]) -> dict[str, object]:
    """Return a source-paired audit; REVIEW_READY never means source verified."""
    distance = _finite(row.get("dist_mpc"))
    physical = row.get("derived_distance_mpc") is not None
    observed = _finite(row.get("observed_distance_mpc"))
    from_mu = _distance_from_mu(_finite(row.get("observed_mu")))
    source = "lv.physical" if physical else "lv.observed" if observed is not None else None
    basis = _text(row.get("derived_distance_method")) if physical else "observed_dist" if source else None
    method = None
    reference = None
    expected = None
    if basis == "observed_mu" and physical:
        method = _text(row.get("modulus_method"))
        reference = _text(row.get("distance_reference"))
        expected = from_mu
    elif basis == "observed_dist":
        method = _text(row.get("distance_method"))
        expected = observed
        # distance_reference belongs to Table 6, not automatically Table 1.
    origin = "UNKNOWN"
    status = "HOLD"
    reason = "missing_or_invalid_distance"
    interval = False
    if distance is not None and distance > 0:
        if basis not in ("observed_mu", "observed_dist"):
            reason = "unrecognized_adoption_basis"
        elif physical and not _equal(distance, _finite(row.get("derived_distance_mpc"))):
            reason = "physical_value_mismatch"
        elif not _equal(distance, expected):
            reason = "adopted_source_value_mismatch"
        elif physical and basis == "observed_dist" and from_mu is not None:
            reason = "mu_first_policy_mismatch"
        else:
            origin = classify_method(method)
            interval = physical and basis == "observed_mu" and _interval_matches(row, distance)
            if origin == "UNKNOWN":
                reason = "unknown_or_qualitative_method"
            elif origin in ("GROUP_ASSIGNED", "MODEL_INFERRED"):
                status, reason = "NON_INDEPENDENT", "group_or_model_distance"
            elif basis == "observed_dist":
                reason = "table1_reference_not_paired"
            elif reference is None:
                reason = "missing_modulus_reference"
            elif classify_method(row.get("distance_method")) in ("GROUP_ASSIGNED", "MODEL_INFERRED"):
                reason = "table1_table6_origin_disagreement"
            else:
                status, reason = "REVIEW_READY", "source_row_review_required"
    return {
        "distance_origin": origin,
        "distance_value_source": source,
        "distance_adoption_basis": basis,
        "distance_method_for_value": method,
        "distance_reference_for_value": reference,
        "distance_lineage_status": status,
        "distance_lineage_reason": reason,
        "distance_interval_traceable": interval,
        "distance_provenance_verified": False,
        "distance_3d_eligible": False,
    }
