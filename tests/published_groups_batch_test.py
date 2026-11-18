from collections.abc import Sequence
from typing import Any, cast

from lv_backend.data import groups as data_groups
from lv_backend.data.storage import Storage
from lv_backend.domain import groups as domain_groups
from lv_backend.domain.physical_calculations import FORMULA_VERSION


def _group(group_id: int, name: str) -> dict[str, object]:
    return {
        "group_id": group_id,
        "root_pgc": group_id * 100,
        "root_name": name,
        "root_ra": 15.0,
        "root_dec": 5.0,
        "root_dist_mpc": 6.5,
        "definition": "published",
        "data_status": "validated",
        "source_catalog": "fixture",
        "source_version": "1",
        "source_sha256": "sha",
        "source_description": "Published group fixture",
    }


def _member(group_id: int, index: int, *, missing_ra: bool = False) -> dict[str, object]:
    return {
        "group_id": group_id,
        "pgc": group_id * 100 + index,
        "parent_md_pgc": None if index == 0 else group_id * 100,
        "hierarchy_depth": 0 if index == 0 else 1,
        "membership_status": "unconfirmed" if index == 2 else ("root" if index == 0 else "supported"),
        "source_status": "published",
        "theta1_source": None,
        "name": f"Member {index}",
        "ra": None if missing_ra else 15.0 + index * 0.08,
        "dec": 5.0 + index * 0.08,
        "dist_mpc": 6.5,
        "morphology_t": 4.0,
        "b_mag": 16.2,
        "lvg_v_lg_kms": 420.0,
        "distance_method": "TRGB",
        "abs_b_mag": -13.0,
        "log_mhi_msun": None if index == 2 else 7.0,
        "log_m26_msun": 8.5,
        "log_lks_lsun": 7.2,
        "e_distance_minus_mpc": None,
        "e_distance_plus_mpc": None,
        "e_v_lg_kms": 8.0,
        "distance_error_basis": None,
        "velocity_error_basis": "observed",
        "hi_mass_is_upper_limit": index == 2,
        "theta1_computed": 1.0,
        "md_pgc_computed": group_id * 100,
        "environment_coverage": "complete",
    }


class _PublishedStorage:
    def __init__(self, sizes: dict[int, int]) -> None:
        names = {10: "Zeta", 20: "Beta", 30: "Alpha", 40: "Tiny"}
        self.groups = [_group(group_id, names[group_id]) for group_id in sorted(sizes)]
        self.members = {
            group_id: [_member(group_id, index, missing_ra=group_id == 30 and index == 2) for index in range(size)]
            for group_id, size in sizes.items()
        }
        self.calls: list[tuple[str, Sequence[Any] | None]] = []

    def query(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        self.calls.append((sql, params))
        if "FROM lv.groups g" in sql:
            return [dict(group) for group in self.groups]
        if "FROM lv.group_members gm" in sql:
            assert params is not None
            assert params[0] == FORMULA_VERSION
            if "gm.group_id = ANY(%s)" in sql:
                assert "ORDER BY gm.group_id, gm.hierarchy_depth, o.name, o.pgc" in sql
                group_ids = cast(list[int], params[1])
                return [dict(member) for group_id in sorted(group_ids) for member in self.members[group_id]]
            assert "WHERE gm.group_id = %s" in sql
            return [dict(member) for member in self.members[int(params[1])]]
        if "MIN(p.theta1) AS min_theta" in sql:
            return [{"min_theta": -0.5, "max_theta": 2.25}]
        raise AssertionError(f"Unexpected SQL: {sql[:80]}")


def test_published_bulk_preserves_all_members_and_source_fields() -> None:
    storage = _PublishedStorage({10: 4, 20: 3, 30: 3, 40: 2})
    bulk = data_groups.select_published_members_bulk(cast(Storage, storage), [10, 20, 30, 40])
    grouped: dict[int, list[dict[str, object]]] = {group_id: [] for group_id in (10, 20, 30, 40)}
    for member in bulk:
        grouped[int(member["group_id"])].append(member)
    for group_id in grouped:
        original = data_groups.select_published_members(cast(Storage, storage), group_id)
        assert grouped[group_id] == original
    assert grouped[10][2]["hi_mass_is_upper_limit"] is True
    assert grouped[20][2]["log_mhi_msun"] is None
    assert grouped[20][0]["distance_method"] == "TRGB"
    assert grouped[30][2]["ra"] is None


def test_published_list_same_science_output_as_original_get_group_path() -> None:
    sizes = {10: 4, 20: 3, 30: 3, 40: 2}
    expected_storage = _PublishedStorage(sizes)
    details = [
        domain_groups.get_group(cast(Storage, expected_storage), group_id * 100, "published") for group_id in sizes
    ]
    expected = [
        {key: value for key, value in detail.items() if key not in ("members", "source_description")}
        for detail in details
        if detail is not None and int(detail["member_count"]) >= 3
    ]
    expected.sort(key=lambda x: (-int(x["member_count"]), str(x["name"])))
    optimized_storage = _PublishedStorage(sizes)
    actual = domain_groups.list_groups(cast(Storage, optimized_storage), "published")
    assert actual == expected
    assert [group["name"] for group in actual] == ["Zeta", "Alpha", "Beta"]
    assert actual[1]["extent_kpc"] is None
    assert all(group["unconfirmed_count"] == 1 for group in actual)
    assert [group["tidal_min"] for group in actual] == [-0.5] * 3
    assert len(optimized_storage.calls) == 3
    assert sum("FROM lv.group_members gm" in sql for sql, _ in optimized_storage.calls) == 1
    assert sum("MIN(p.theta1)" in sql for sql, _ in optimized_storage.calls) == 1


def test_published_list_empty_avoids_unnecessary_queries() -> None:
    storage = _PublishedStorage({})
    assert domain_groups.list_groups(cast(Storage, storage), "published") == []
    assert len(storage.calls) == 1


def test_published_list_filters_groups_below_three_without_tidal_query() -> None:
    storage = _PublishedStorage({40: 2})
    assert domain_groups.list_groups(cast(Storage, storage), "published") == []
    assert len(storage.calls) == 2
    assert all("MIN(p.theta1)" not in sql for sql, _ in storage.calls)


def test_single_published_group_detail_keeps_original_query_and_member_order() -> None:
    storage = _PublishedStorage({10: 4, 20: 3})
    group = domain_groups.get_group(cast(Storage, storage), 1000, "published")
    assert group is not None
    assert group["root_pgc"] == 1000
    assert group["member_count"] == 4
    members = cast(list[dict[str, object]], group["members"])
    assert [member["pgc"] for member in members] == [1000, 1001, 1002, 1003]
    assert len(storage.calls) == 3
    assert sum("gm.group_id = ANY(%s)" in sql for sql, _ in storage.calls) == 0


def test_bulk_empty_ids_does_not_hit_database() -> None:
    storage = _PublishedStorage({})
    assert data_groups.select_published_members_bulk(cast(Storage, storage), []) == []
    assert storage.calls == []
