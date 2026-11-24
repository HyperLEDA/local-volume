import math
from dataclasses import replace
from decimal import Decimal

import pytest

from lv_backend.domain.distance_evidence import (
    Axis,
    Evidence,
    apply_distance_evidence,
    build_registry,
    evidence_fingerprint,
)


def _row() -> dict[str, object]:
    distance = 10 ** ((28.0 - 25.0) / 5.0)
    factor = 10 ** (0.15 / 5)
    return {
        "pgc": 123,
        "ra": 120.0,
        "dec": -40.0,
        "dist_mpc": distance,
        "derived_distance_mpc": distance,
        "observed_distance_mpc": 3.98,
        "observed_mu": Decimal("28.0000"),
        "observed_e_mu": Decimal("0.1500"),
        "distance_method": "TRGB",
        "modulus_method": "TRGB",
        "distance_reference": "test-reference",
        "distance_source_catalog": "test-catalogue",
        "distance_source_name": "test-object",
        "derived_distance_method": "observed_mu",
        "distance_formula_version": "test-v1",
        "distance_computed_revision": 7,
        "distance_error_basis": "observed_mu_e_mu_exact",
        "e_distance_minus_mpc": distance * (1 - 1 / factor),
        "e_distance_plus_mpc": distance * (factor - 1),
    }


def _evidence(row: dict[str, object], axis: Axis = "value") -> Evidence:
    return Evidence(
        int(str(row["pgc"])),
        axis,
        evidence_fingerprint(row, axis),
        "VERIFIED",
        "test-reference",
        "Test table 1, object row",
        "Synthetic test reviewer",
        "2026-11-24",
        "Synthetic fixture only; never a production approval.",
    )


def test_default_closed() -> None:
    out = apply_distance_evidence(_row())
    assert out["distance_value_review_status"] == "NOT_REVIEWED"
    assert out["distance_3d_eligible"] is False
    assert out["distance_interval_verified"] is False


def test_numeric_fingerprint_csv_db_equivalence_and_revision_independence() -> None:
    row = _row()
    other = {**row, "observed_mu": "28.0", "observed_e_mu": "0.15", "pgc": "123", "distance_computed_revision": 8}
    axes: tuple[Axis, ...] = ("value", "interval")
    for axis in axes:
        assert evidence_fingerprint(row, axis) == evidence_fingerprint(other, axis)


def test_independent_value_and_interval_reviews() -> None:
    row = _row()
    value, interval = _evidence(row), _evidence(row, "interval")
    out = apply_distance_evidence(row, build_registry((value,)))
    assert out["distance_3d_eligible"] is True
    assert out["distance_interval_verified"] is False
    registry = build_registry((value, interval))
    assert apply_distance_evidence(row, registry)["distance_interval_verified"] is True
    changed = {**row, "observed_e_mu": 0.20}
    out = apply_distance_evidence(changed, registry)
    assert out["distance_3d_eligible"] is True
    assert out["distance_interval_review_status"] == "STALE"
    assert out["distance_interval_verified"] is False


@pytest.mark.parametrize(
    "key,value",
    [
        ("observed_mu", 28.01),
        ("distance_reference", "changed"),
        ("modulus_method", "SBF"),
        ("distance_formula_version", "test-v2"),
        ("distance_source_name", "other-object"),
        ("distance_method", "TF"),
        ("observed_distance_mpc", 4.0),
    ],
)
def test_source_change_revokes_both_axes(key: str, value: object) -> None:
    row = _row()
    registry = build_registry((_evidence(row), _evidence(row, "interval")))
    out = apply_distance_evidence({**row, key: value}, registry)
    assert out["distance_value_review_status"] == "STALE"
    assert out["distance_interval_review_status"] == "STALE"
    assert out["distance_3d_eligible"] is False


@pytest.mark.parametrize("method", ["mem", "NAM", "txt"])
def test_review_cannot_override_non_independent_or_unknown_method(method: str) -> None:
    row = {**_row(), "modulus_method": method}
    registry = build_registry((_evidence(row),))
    assert apply_distance_evidence(row, registry)["distance_3d_eligible"] is False


def test_hold_and_interval_without_approved_value() -> None:
    row = _row()
    interval = _evidence(row, "interval")
    assert apply_distance_evidence(row, build_registry((interval,)))["distance_interval_review_status"] == "BLOCKED"
    registry = build_registry((_evidence(row), replace(interval, decision="HOLD")))
    out = apply_distance_evidence(row, registry)
    assert out["distance_3d_eligible"] is True
    assert out["distance_interval_review_status"] == "HOLD"
    assert out["distance_interval_verified"] is False


def test_corrupt_derived_values_and_errors_fail_closed() -> None:
    row = _row()
    registry = build_registry((_evidence(row), _evidence(row, "interval")))
    assert apply_distance_evidence({**row, "dist_mpc": 9.0}, registry)["distance_3d_eligible"] is False
    assert (
        apply_distance_evidence({**row, "distance_computed_revision": None}, registry)["distance_3d_eligible"] is False
    )
    out = apply_distance_evidence({**row, "e_distance_plus_mpc": 0.0}, registry)
    assert out["distance_3d_eligible"] is True
    assert out["distance_interval_verified"] is False
    out = apply_distance_evidence({**row, "observed_e_mu": math.nan}, registry)
    assert out["distance_3d_eligible"] is True
    assert out["distance_interval_review_status"] == "UNAVAILABLE"


def test_host_and_invalid_coordinates_do_not_get_3d() -> None:
    row = {**_row(), "pgc": 5064336}
    assert apply_distance_evidence(row, build_registry((_evidence(row),)))["distance_3d_eligible"] is False
    row = {**_row(), "dec": 95}
    assert apply_distance_evidence(row, build_registry((_evidence(row),)))["distance_3d_eligible"] is False


def test_registry_rejects_duplicates_missing_evidence_and_wrong_reference() -> None:
    row = _row()
    value = _evidence(row)
    with pytest.raises(ValueError):
        build_registry((value, value))
    with pytest.raises(ValueError):
        build_registry((replace(value, locator=""),))
    with pytest.raises(ValueError):
        build_registry((replace(value, fingerprint="abc"),))
    out = apply_distance_evidence(row, build_registry((replace(value, reference="wrong"),)))
    assert out["distance_value_review_status"] == "STALE"
