from typing import cast

from lv_backend.domain.groups import derive_live_groups


def galaxy(pgc: int, md: int | None, theta: float | None = 1, lum: float | None = 9) -> dict[str, object]:
    return {
        "pgc": pgc,
        "name": f"PGC {pgc}",
        "ra": float(pgc) / 10,
        "dec": -20.0,
        "dist_mpc": 9.0,
        "morphology_t": 2,
        "b_mag": 15.0,
        "lvg_v_lg_kms": None,
        "theta1_computed": theta,
        "md_pgc_computed": md,
        "log_lks_lsun": lum,
        "environment_coverage": "complete",
    }


def test_mutual_md_pair_uses_more_luminous_root_and_preserves_nested_links() -> None:
    rows = [galaxy(100, 101, 2, 11), galaxy(101, 100, 4, 7), galaxy(102, 100, 3, 8), galaxy(103, 102, 0.5, 7)]
    result = derive_live_groups(rows, "physical")
    assert len(result) == 1
    group = result[0]
    assert group["root_pgc"] == 100
    assert group["member_count"] == 4
    assert group["subgroup_count"] == 1
    assert group["data_status"] == "computed"
    assert group["unconfirmed_count"] is None
    members = cast(list[dict[str, object]], group["members"])
    by_pgc = {member["pgc"]: member for member in members}
    assert by_pgc[100]["parent_md_pgc"] is None
    assert by_pgc[101]["parent_md_pgc"] == 100
    assert by_pgc[103]["parent_md_pgc"] == 102
    assert by_pgc[103]["hierarchy_depth"] == 2
    assert by_pgc[100]["md_pgc_computed"] == 101


def test_theta_threshold_changes_physical_but_not_suite_edges() -> None:
    rows = [galaxy(100, None), galaxy(101, 100, -0.5), galaxy(102, 101, 1), galaxy(103, 101, 1)]
    physical = derive_live_groups(rows, "physical")
    suite = derive_live_groups(rows, "suite")
    assert [group["root_pgc"] for group in physical] == [101]
    assert [group["member_count"] for group in physical] == [3]
    assert [group["root_pgc"] for group in suite] == [100]
    assert [group["member_count"] for group in suite] == [4]


def test_ambiguous_mutual_pair_excluded() -> None:
    rows = [galaxy(100, 101, 2, None), galaxy(101, 100, 2, None), galaxy(102, 100)]
    assert derive_live_groups(rows, "physical") == []


def test_missing_sky_coordinate_does_not_silently_crop_group() -> None:
    rows = [galaxy(100, None), galaxy(101, 100), galaxy(102, 100)]
    rows[2]["ra"] = None
    assert derive_live_groups(rows, "physical") == []


def test_minimum_richness_three() -> None:
    assert derive_live_groups([galaxy(100, None), galaxy(101, 100)], "suite") == []


def test_suite_cannot_make_cycles_with_no_unique_luminosity_peak() -> None:
    rows = [galaxy(1, 2, lum=10), galaxy(2, 3, lum=10), galaxy(3, 1, lum=10), galaxy(4, 1)]
    assert derive_live_groups(rows, "suite") == []
