import math
from typing import cast

import pytest

from lv_backend.data.storage import Storage
from lv_backend.domain import groups


def _member(pgc: int, parent: int | None, method: str | None = "TRGB") -> dict[str, object]:
    return {
        "group_id": -100,
        "pgc": pgc,
        "parent_md_pgc": parent,
        "hierarchy_depth": 0 if parent is None else 1,
        "membership_status": "root" if parent is None else "computed",
        "source_status": "live_physical",
        "theta1_source": None,
        "name": f"PGC {pgc}",
        "ra": 10.0,
        "dec": 20.0,
        "dist_mpc": 4.0,
        "distance_method": method,
        "distance_reference": "test ref",
        "distance_source_catalog": "test",
        "distance_source_name": "test",
        "derived_distance_mpc": 4.0,
        "observed_distance_mpc": 4.0,
        "derived_distance_method": "observed_mu",
        "modulus_method": method,
        "observed_mu": 5 * math.log10(4.0) + 25,
        "distance_formula_version": "test-v1",
        "distance_computed_revision": 7,
    }


def _group() -> dict[str, object]:
    return {
        "group_id": -100,
        "root_pgc": 100,
        "name": "Root",
        "definition": "physical",
        "data_status": "computed",
        "source_catalog": "lv.physical",
        "source_version": "v1",
        "source_sha256": None,
        "source_description": "computed",
        "members": [_member(100, None), _member(101, 100)],
    }


def test_detail_provenance_adds_only_fields_and_preserves_original() -> None:
    group = _group()
    output = groups.detail_with_distance_lineage(group)
    center = cast(dict[str, object], output["scene_center"])
    members = cast(list[dict[str, object]], output["members"])
    assert center["center_type"] == "root_md"
    assert output["distance_contract"] == "source_paired_evidence_v3"
    assert output["radius_measurements"] == []
    assert members[1]["distance_origin"] == "DIRECT_MEASURED"
    assert members[1]["distance_value_source"] == "lv.physical"
    assert members[1]["distance_method_for_value"] == "TRGB"
    assert members[1]["distance_lineage_status"] == "REVIEW_READY"
    assert center["distance_lineage_status"] == "REVIEW_READY"
    assert center["distance_value_review_status"] == "NOT_REVIEWED"
    assert members[1]["distance_interval_verified"] is False
    assert members[1]["distance_provenance_verified"] is False
    assert members[1]["distance_3d_eligible"] is False
    assert "distance_origin" not in cast(list[dict[str, object]], group["members"])[1]


def test_missing_and_group_assigned_distance_never_unlock_3d() -> None:
    group = _group()
    original_members = cast(list[dict[str, object]], group["members"])
    original_members[0]["derived_distance_mpc"] = None
    original_members[0]["distance_method"] = "group assigned"
    original_members[0]["derived_distance_method"] = "group assigned"
    original_members[1]["dist_mpc"] = None
    output = groups.detail_with_distance_lineage(group)
    members = cast(list[dict[str, object]], output["members"])
    assert members[0]["distance_origin"] == "GROUP_ASSIGNED"
    assert members[0]["distance_value_source"] == "lv.observed"
    assert members[1]["distance_origin"] == "UNKNOWN"
    assert all(m["distance_3d_eligible"] is False for m in members)


def test_missing_root_position_disables_scene_center() -> None:
    group = _group()
    cast(list[dict[str, object]], group["members"])[0]["ra"] = None
    assert groups.detail_with_distance_lineage(group)["scene_center"] is None


def test_published_membership_preserves_competing_source_definitions(monkeypatch: pytest.MonkeyPatch) -> None:
    saved = [
        {
            "group_id": group_id,
            "root_pgc": 100,
            "name": "Root",
            "definition": "published",
            "data_status": "validated" if group_id == 4 else "pilot",
            "source_catalog": "catalog A" if group_id == 4 else "catalog B",
            "source_version": "v1",
            "source_sha256": None,
            "source_description": "source record",
            "member_pgc": 101,
            "parent_md_pgc": 100,
            "membership_status": "supported",
            "source_status": "published",
            "hierarchy_depth": 1,
        }
        for group_id in (4, 7)
    ]
    monkeypatch.setattr(groups.data_groups, "select_published_memberships", lambda storage, pgc: saved)
    monkeypatch.setattr(groups.data_groups, "select_live_objects", lambda storage: [])
    result = groups.find_member_groups(cast(Storage, object()), 101)
    assert [m["group_id"] for m in result] == [4, 7]
    assert [m["source_catalog"] for m in result] == ["catalog A", "catalog B"]
    assert result[0]["member_pgc"] == 101


def test_computed_memberships_require_actual_member_not_root_guess(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(groups.data_groups, "select_published_memberships", lambda storage, pgc: [])
    monkeypatch.setattr(groups.data_groups, "select_live_objects", lambda storage: [])
    sample = _group()
    monkeypatch.setattr(
        groups, "derive_live_groups", lambda rows, definition: [sample] if definition == "physical" else []
    )
    result = groups.find_member_groups(cast(Storage, object()), 101)
    assert len(result) == 1
    assert result[0]["root_pgc"] == 100
    assert result[0]["membership_status"] == "computed"
    assert groups.find_member_groups(cast(Storage, object()), 999) == []


def test_root_without_provenance_gets_no_invented_radius() -> None:
    out = groups.detail_with_distance_lineage(_group())
    assert out["radius_measurements"] == []
    center = cast(dict[str, object], out["scene_center"])
    assert center["physical_3d_eligible"] is False
