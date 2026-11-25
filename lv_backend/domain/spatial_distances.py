"""Read-only adapter for global spatial data; use the existing group evidence audit."""

import math
from collections.abc import Mapping

from lv_backend.domain.distance_evidence import apply_distance_evidence
from lv_backend.presentation.schemas import SpatialDistance

DISTANCE_CONTRACT = "source_paired_evidence_v3"

_NUMERIC_FIELDS = (
    "dist_mpc",
    "observed_distance_mpc",
    "derived_distance_mpc",
    "e_distance_minus_mpc",
    "e_distance_plus_mpc",
)
_TEXT_FIELDS = (
    "distance_method",
    "modulus_method",
    "distance_reference",
    "distance_source_catalog",
    "distance_source_name",
    "derived_distance_method",
    "distance_formula_version",
    "distance_error_basis",
)


def _finite(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(str(value))
    except (TypeError, ValueError, OverflowError):
        return None
    return number if math.isfinite(number) else None


def spatial_distance(row: Mapping[str, object]) -> SpatialDistance:
    # Audit exact database inputs before converting anything for JSON.
    payload = apply_distance_evidence(row)
    payload["pgc"] = row["pgc"]
    payload.update({key: _finite(row.get(key)) for key in _NUMERIC_FIELDS})
    payload.update({key: row.get(key) for key in _TEXT_FIELDS})
    # Preserve the database decimal representation for provenance.
    for key in ("observed_mu", "observed_e_mu"):
        value = row.get(key)
        payload[key] = str(value) if _finite(value) is not None else None
    payload["distance_computed_revision"] = row.get("distance_computed_revision")
    return SpatialDistance.model_validate(payload)
