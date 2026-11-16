"""Backward route-level regression after switching to precomputed physical data."""

from typing import Any

from lv_backend.data import physical
from lv_backend.domain.physical_calculations import FORMULA_VERSION


class FakeStorage:
    def __init__(self, record: dict[str, Any] | None):
        self.record = record

    def query(self, sql: str, params: object = None) -> list[dict[str, Any]]:
        assert "lv.physical" in sql
        assert "lv.observed" not in sql
        return [self.record] if self.record is not None else []


def test_precomputed_physical_returns_ready_record() -> None:
    row = {
        "pgc": 29146,
        "source_revision": 3,
        "applied_revision": 3,
        "computed_revision": 3,
        "formula_version": FORMULA_VERSION,
        "abs_ks_mag": -20.5,
        "theta1": 2.3,
        "md_pgc": 28630,
        "md_name": "M81",
    }
    result = physical.select_physical(FakeStorage(row), 29146)
    assert result is not None and result["physical_status"] == "ready"
    assert result["abs_ks_mag"] == -20.5
    assert result["md_name"] == "M81"


def test_pending_recomputation_does_not_publish_outdated_data() -> None:
    row = {
        "pgc": 29146,
        "source_revision": 5,
        "applied_revision": 4,
        "computed_revision": 4,
        "formula_version": FORMULA_VERSION,
        "theta1": 99.99,
    }
    assert physical.select_physical(FakeStorage(row), 29146) == {"pgc": 29146, "physical_status": "pending"}


def test_unknown_pgc_returns_none() -> None:
    assert physical.select_physical(FakeStorage(None), 8) is None
