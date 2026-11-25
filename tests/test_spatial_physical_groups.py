from typing import cast

import pytest

from lv_backend.data.storage import Storage
from lv_backend.domain import groups


def galaxy(pgc: int, md: int | None, theta: float = 1.0) -> dict[str, object]:
    return {
        "pgc": pgc,
        "name": f"PGC {pgc}",
        "ra": pgc / 10.0,
        "dec": -20.0,
        "dist_mpc": 4.0,
        "morphology_t": 2,
        "b_mag": 15.0,
        "lvg_v_lg_kms": None,
        "theta1_computed": theta,
        "md_pgc_computed": md,
        "log_lks_lsun": 9.0,
        "environment_coverage": "complete",
    }


def test_snapshot_uses_physical_hierarchy_and_complete_coverage(monkeypatch: pytest.MonkeyPatch) -> None:
    rows = [galaxy(100, None), galaxy(101, 100), galaxy(102, 101), galaxy(103, 100, -1), galaxy(104, None)]
    storage = cast(Storage, object())
    monkeypatch.setattr(groups.data_groups, "select_live_objects", lambda _storage: rows)
    snapshot = groups.spatial_physical_groups(storage)
    assert snapshot["catalogue_pgcs"] == [100, 101, 102, 103, 104]
    entries = cast(list[dict[str, object]], snapshot["groups"])
    assert len(entries) == 1
    assert entries[0]["member_pgcs"] == [100, 101, 102]
    assert [{k: v for k, v in entry.items() if k != "member_pgcs"} for entry in entries] == groups.list_groups(storage)


def test_snapshot_does_not_mask_stale_physical_catalogue(monkeypatch: pytest.MonkeyPatch) -> None:
    def stale(_storage: Storage) -> list[dict[str, object]]:
        raise RuntimeError("stale physical catalogue")

    monkeypatch.setattr(groups.data_groups, "select_live_objects", stale)
    with pytest.raises(RuntimeError, match="stale"):
        groups.spatial_physical_groups(cast(Storage, object()))
