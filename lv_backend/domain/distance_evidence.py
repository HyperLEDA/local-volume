"""Versioned evidence for adopted LVG distances; absence of evidence fails closed."""

import hashlib
import json
import math
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Literal

from lv_backend.domain.distance_evidence_records import RECORDS
from lv_backend.domain.distance_lineage import audit_distance_lineage

Axis = Literal["value", "interval"]
Decision = Literal["VERIFIED", "HOLD"]

# Exact source-paired identity. The global revision is checked by the caller's
# SQL snapshot, not hashed: unrelated catalogue edits must not revoke evidence.
_VALUE_TEXT = (
    "distance_source_catalog",
    "distance_source_name",
    "distance_method",
    "modulus_method",
    "distance_reference",
    "derived_distance_method",
    "distance_formula_version",
)
_VALUE_NUM = ("observed_mu", "observed_distance_mpc")
_INTERVAL_NUM = ("observed_e_mu",)


def _number_key(value: object) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean is not a measurement")
    try:
        number = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Invalid numeric source field") from exc
    if not number.is_finite():
        raise ValueError("Non-finite source field")
    return "0" if number.is_zero() else format(number.normalize(), "f")


def _pgc(value: object) -> int:
    key = _number_key(value)
    if key is None or not key.isascii() or not key.isdecimal() or int(key) <= 0:
        raise ValueError("Invalid canonical PGC")
    return int(key)


def _text_key(value: object) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("Invalid source text")
    return value  # Preserve exact raw method, reference and source identity.


def evidence_fingerprint(row: Mapping[str, object], axis: Axis) -> str:
    """Hash source fields, not rounded display values or unrelated revisions."""
    if str(axis) not in ("value", "interval"):
        raise ValueError("Unknown evidence axis")
    if not _text_key(row.get("distance_formula_version")):
        raise ValueError("Missing formula version")
    payload: dict[str, object] = {
        "contract": "lv-distance-evidence-v1",
        "axis": axis,
        "pgc": _pgc(row.get("pgc")),
    }
    payload.update({key: _text_key(row.get(key)) for key in _VALUE_TEXT})
    payload.update({key: _number_key(row.get(key)) for key in _VALUE_NUM})
    if axis == "interval":
        payload.update({key: _number_key(row.get(key)) for key in _INTERVAL_NUM})
        payload["distance_error_basis"] = _text_key(row.get("distance_error_basis"))
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Evidence:
    pgc: int
    axis: Axis
    fingerprint: str
    decision: Decision
    reference: str
    locator: str
    reviewer: str
    reviewed_on: str
    note: str


def build_registry(records: tuple[Evidence, ...]) -> dict[tuple[int, Axis], Evidence]:
    registry: dict[tuple[int, Axis], Evidence] = {}
    for record in records:
        if (
            _pgc(record.pgc) != record.pgc
            or str(record.axis) not in ("value", "interval")
            or str(record.decision) not in ("VERIFIED", "HOLD")
            or len(record.fingerprint) != 64
            or any(c not in "0123456789abcdef" for c in record.fingerprint)
            or not all(
                value.strip()
                for value in (record.reference, record.locator, record.reviewer, record.reviewed_on, record.note)
            )
        ):
            raise ValueError("Invalid evidence record")
        date.fromisoformat(record.reviewed_on)
        key = (record.pgc, record.axis)
        if key in registry:
            raise ValueError("Duplicate evidence record")
        registry[key] = record
    return registry


_REGISTRY = build_registry(tuple(Evidence(*record) for record in RECORDS))


def apply_distance_evidence(
    row: Mapping[str, object],
    registry: Mapping[tuple[int, Axis], Evidence] = _REGISTRY,
) -> dict[str, object]:
    """Always rerun source lineage; a review cannot override missing/invalid data."""
    result = audit_distance_lineage(row)
    fingerprints: dict[Axis, str | None] = {"value": None, "interval": None}
    statuses: dict[Axis, str] = {"value": "NOT_REVIEWED", "interval": "NOT_REVIEWED"}
    entries: dict[Axis, Evidence | None] = {"value": None, "interval": None}
    axes: tuple[Axis, ...] = ("value", "interval")
    for axis in axes:
        try:
            pgc = _pgc(row.get("pgc"))
            fingerprints[axis] = evidence_fingerprint(row, axis)
            entry = registry.get((pgc, axis))
            if entry is not None:
                if entry.fingerprint != fingerprints[axis] or entry.reference != result["distance_reference_for_value"]:
                    statuses[axis] = "STALE"
                else:
                    entries[axis] = entry
                    statuses[axis] = entry.decision
        except (TypeError, ValueError, OverflowError):
            statuses[axis] = "UNAVAILABLE"
    try:
        revision_valid = _number_key(row.get("distance_computed_revision"))
        has_revision = revision_valid is not None and revision_valid.isdecimal()
    except ValueError:
        has_revision = False
    value_allowed = (
        result["distance_origin"] == "DIRECT_MEASURED"
        and result["distance_lineage_status"] == "REVIEW_READY"
        and result["distance_adoption_basis"] == "observed_mu"
        and has_revision
    )
    if statuses["value"] == "VERIFIED" and not value_allowed:
        statuses["value"] = "BLOCKED"
    verified = value_allowed and statuses["value"] == "VERIFIED"
    if statuses["interval"] == "VERIFIED" and not (verified and result["distance_interval_traceable"] is True):
        statuses["interval"] = "BLOCKED"
    interval_verified = verified and statuses["interval"] == "VERIFIED"
    # Geometry also requires a valid direction and excludes the observer's host.
    try:
        ra, dec = float(str(row.get("ra"))), float(str(row.get("dec")))
        valid_position = math.isfinite(ra) and math.isfinite(dec) and -90 <= dec <= 90
        extragalactic = _pgc(row.get("pgc")) != 5064336
    except (TypeError, ValueError, OverflowError):
        valid_position = extragalactic = False
    value_entry, interval_entry = entries["value"], entries["interval"]
    result.update(
        distance_value_fingerprint=fingerprints["value"],
        distance_interval_fingerprint=fingerprints["interval"],
        distance_value_review_status=statuses["value"],
        distance_interval_review_status=statuses["interval"],
        distance_value_evidence_locator=value_entry.locator if value_entry else None,
        distance_interval_evidence_locator=interval_entry.locator if interval_entry else None,
        distance_interval_verified=interval_verified,
        distance_provenance_verified=verified,
        distance_3d_eligible=verified and valid_position and extragalactic,
    )
    return result
