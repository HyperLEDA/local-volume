from typing import cast

import pytest

from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION
from lv_backend.domain.spatial_photometry import spatial_photometry


class Snapshot:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self.rows = rows

    def query(self, sql: str, params: list[str]) -> list[dict[str, object]]:
        assert "s.source_revision = s.applied_revision" in sql
        assert "p.computed_revision = s.applied_revision" in sql
        assert params == [FORMULA_VERSION]
        return self.rows


def row(pgc: int, **patch: object) -> dict[str, object]:
    return {
        "pgc": pgc,
        "computed_pgc": pgc,
        "revision": 7,
        "formula_version": FORMULA_VERSION,
        "log_lks_lsun": 9.0,
        "ks_estimated": False,
        "ks_method": "measured",
        "log_mhi_msun": 8.0,
        "derived_hi_limit_flag": None,
        **patch,
    }


def test_limit_and_estimated_photometry_preserved() -> None:
    data = spatial_photometry(cast(Storage, Snapshot([row(1), row(2, ks_estimated=True, derived_hi_limit_flag="<")])))
    entries = cast(list[dict[str, object]], data["rows"])
    assert data["revision"] == 7
    assert entries[0]["hi_status"] == "detection"
    assert entries[1]["hi_status"] == "upper_limit"
    assert entries[1]["ks_status"] == "estimated"
    assert entries[1]["log_mhi_msun"] == 8.0


def test_invalid_and_missing_values_remain_unavailable() -> None:
    data = spatial_photometry(
        cast(
            Storage,
            Snapshot(
                [row(1, log_lks_lsun=float("nan"), derived_hi_limit_flag="?"), row(2, ks_estimated=None), row(5064336)]
            ),
        )
    )
    entries = cast(list[dict[str, object]], data["rows"])
    assert entries[0]["log_lks_lsun"] is None
    assert entries[0]["log_mhi_msun"] is None
    assert entries[1]["ks_status"] == "unavailable"
    assert entries[2]["hi_status"] == "unavailable"


@pytest.mark.parametrize("rows", [[], [row(1, computed_pgc=None)], [row(1), row(1)], [row(1), row(2, revision=8)]])
def test_incomplete_snapshot_rejected(rows: list[dict[str, object]]) -> None:
    with pytest.raises(RuntimeError):
        spatial_photometry(cast(Storage, Snapshot(rows)))
