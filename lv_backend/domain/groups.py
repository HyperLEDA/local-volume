import math
from collections import defaultdict
from typing import cast

from lv_backend.data import groups as data_groups
from lv_backend.data.storage import Storage
from lv_backend.domain import group_geometry
from lv_backend.domain.physical_calculations import FORMULA_VERSION


def _number(value: object) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return float(value)
    return None


def _position(row: dict[str, object]) -> bool:
    ra = _number(row.get("ra"))
    dec = _number(row.get("dec"))
    return ra is not None and dec is not None and -90 <= dec <= 90


def _angular_sep(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    ra1, dec1, ra2, dec2 = map(math.radians, (ra1, dec1, ra2, dec2))
    dot = math.sin(dec1) * math.sin(dec2) + math.cos(dec1) * math.cos(dec2) * math.cos(ra1 - ra2)
    return math.acos(min(1.0, max(-1.0, dot)))


def _summary(
    row: dict[str, object],
    members: list[dict[str, object]],
    tidal_range: tuple[float | None, float | None],
) -> dict[str, object]:
    root_pgc = int(row["root_pgc"])
    root_ra = _number(row["root_ra"])
    root_dec = _number(row["root_dec"])
    root_dist = _number(row["root_dist_mpc"])
    extent = None
    if (
        root_ra is not None
        and root_dec is not None
        and root_dist is not None
        and root_dist > 0
        and all(_position(m) for m in members)
    ):
        extent = (
            1000.0
            * root_dist
            * max(math.sin(_angular_sep(root_ra, root_dec, float(m["ra"]), float(m["dec"]))) for m in members)
        )
    parents = {m["parent_md_pgc"] for m in members if m["parent_md_pgc"] is not None}
    return {
        "group_id": row["group_id"],
        "root_pgc": root_pgc,
        "name": row["root_name"],
        "definition": row["definition"],
        "data_status": row["data_status"],
        "source_catalog": row["source_catalog"],
        "source_version": row["source_version"],
        "source_sha256": row.get("source_sha256"),
        "root_ra": root_ra,
        "root_dec": root_dec,
        "distance_mpc": root_dist,
        "extent_kpc": extent,
        "member_count": len(members),
        "subgroup_count": len(parents - {root_pgc}),
        "unconfirmed_count": (
            sum(m["membership_status"] == "unconfirmed" for m in members) if row["data_status"] != "computed" else None
        ),
        "tidal_min": tidal_range[0],
        "tidal_max": tidal_range[1],
    }


def _cycle_nodes(parents: dict[int, int | None]) -> list[list[int]]:
    visited: set[int] = set()
    cycles: list[list[int]] = []
    for start in parents:
        if start in visited:
            continue
        path: list[int] = []
        position: dict[int, int] = {}
        current: int | None = start
        while current is not None and current not in visited and current not in position:
            position[current] = len(path)
            path.append(current)
            current = parents.get(current)
        if current is not None and current in position:
            cycles.append(path[position[current] :])
        visited.update(path)
    return cycles


def _hierarchy_depth(pgc: int, parents: dict[int, int | None], depths: dict[int, int]) -> int:
    """Resolve one acyclic MD chain, memoizing the distance to its root."""
    chain: list[int] = []
    cursor = pgc
    while cursor not in depths:
        chain.append(cursor)
        parent = parents[cursor]
        if parent is None:
            raise ValueError("Disconnected live MD chain")
        cursor = parent
    for node in reversed(chain):
        parent = parents[node]
        if parent is None:
            raise ValueError("Unexpected root outside depth map")
        depths[node] = depths[parent] + 1
    return depths[pgc]


def _live_components(rows: list[dict[str, object]], definition: str) -> dict[int, list[dict[str, object]]]:
    by_pgc = {int(row["pgc"]): row for row in rows}
    parents: dict[int, int | None] = {}
    for pgc, row in by_pgc.items():
        md = row["md_pgc_computed"]
        theta1 = _number(row["theta1_computed"])
        edge_allowed = definition == "suite" or (theta1 is not None and theta1 >= 0)
        parents[pgc] = int(md) if edge_allowed and isinstance(md, int) and md in by_pgc else None

    # An MD graph may contain mutual pairs. Only break a cycle when one
    # constituent has a unique, independently calculated Ks luminosity maximum.
    # If not, reject the entire ambiguous chain instead of inventing a group root.
    rejected: set[int] = set()
    for cycle in _cycle_nodes(parents):
        if len(cycle) == 1:
            parents[cycle[0]] = None
            continue
        luminosities = [(_number(by_pgc[node]["log_lks_lsun"]), node) for node in cycle]
        if any(lum is None for lum, _ in luminosities):
            rejected.update(cycle)
            continue
        ranked = sorted(luminosities, reverse=True)
        if ranked[0][0] is None or ranked[1][0] is None or ranked[0][0] - ranked[1][0] <= 0.1:
            rejected.update(cycle)
            continue
        parents[ranked[0][1]] = None

    root_cache: dict[int, int | None] = {}

    def root_of(start: int) -> int | None:
        trail: list[int] = []
        node: int | None = start
        while node is not None and node not in root_cache and node not in rejected:
            trail.append(node)
            node = parents[node]
        root: int | None = None
        if node in root_cache:
            root = root_cache[node]
        elif node is not None and node not in rejected:
            root = node
        elif trail and node is None:
            root = trail[-1]
        for item in trail:
            root_cache[item] = root
        return root

    buckets: dict[int, list[int]] = defaultdict(list)
    for pgc in by_pgc:
        root = root_of(pgc)
        if root is not None:
            buckets[root].append(pgc)

    components: dict[int, list[dict[str, object]]] = {}
    for root, ids in buckets.items():
        if len(ids) < 3 or not all(_position(by_pgc[pgc]) for pgc in ids):
            continue
        depths: dict[int, int] = {root: 0}

        result: list[dict[str, object]] = []
        for pgc in ids:
            row = by_pgc[pgc]
            depth = _hierarchy_depth(pgc, parents, depths)
            result.append(
                {
                    "group_id": -root,
                    "pgc": pgc,
                    "parent_md_pgc": parents[pgc],
                    "hierarchy_depth": depth,
                    "membership_status": "root" if pgc == root else "computed",
                    "source_status": "live_physical" if definition == "physical" else "live_md_suite",
                    "theta1_source": None,
                    "name": row["name"],
                    "ra": row["ra"],
                    "dec": row["dec"],
                    "dist_mpc": row["dist_mpc"],
                    "morphology_t": row["morphology_t"],
                    "b_mag": row["b_mag"],
                    "lvg_v_lg_kms": row["lvg_v_lg_kms"],
                    "distance_method": row.get("distance_method"),
                    "distance_reference": row.get("distance_reference"),
                    "distance_source_catalog": row.get("distance_source_catalog"),
                    "distance_source_name": row.get("distance_source_name"),
                    "observed_distance_mpc": row.get("observed_distance_mpc"),
                    "derived_distance_mpc": row.get("derived_distance_mpc"),
                    "derived_distance_method": row.get("derived_distance_method"),
                    "abs_b_mag": row.get("abs_b_mag"),
                    "log_mhi_msun": row.get("log_mhi_msun"),
                    "log_m26_msun": row.get("log_m26_msun"),
                    "log_lks_lsun": row.get("log_lks_lsun"),
                    "e_distance_minus_mpc": row.get("e_distance_minus_mpc"),
                    "e_distance_plus_mpc": row.get("e_distance_plus_mpc"),
                    "e_v_lg_kms": row.get("e_v_lg_kms"),
                    "distance_error_basis": row.get("distance_error_basis"),
                    "velocity_error_basis": row.get("velocity_error_basis"),
                    "hi_mass_is_upper_limit": row.get("hi_mass_is_upper_limit"),
                    "theta1_computed": row["theta1_computed"],
                    "md_pgc_computed": row["md_pgc_computed"],
                    "environment_coverage": row["environment_coverage"],
                }
            )
        components[root] = sorted(result, key=lambda m: (int(m["hierarchy_depth"]), str(m["name"]), int(m["pgc"])))
    return components


def derive_live_groups(
    rows: list[dict[str, object]],
    definition: str,
    tidal_range: tuple[float | None, float | None] = (None, None),
) -> list[dict[str, object]]:
    if definition not in ("physical", "suite"):
        raise ValueError("Unknown derived group definition")
    by_pgc = {int(row["pgc"]): row for row in rows}
    groups: list[dict[str, object]] = []
    for root, members in _live_components(rows, definition).items():
        root_row = by_pgc[root]
        header: dict[str, object] = {
            "group_id": -root,
            "root_pgc": root,
            "root_name": root_row["name"],
            "root_ra": root_row["ra"],
            "root_dec": root_row["dec"],
            "root_dist_mpc": root_row["dist_mpc"],
            "definition": definition,
            "data_status": "computed",
            "source_catalog": "lv.physical",
            "source_version": FORMULA_VERSION,
            "source_sha256": None,
            "source_description": "Live computed MD relations",
        }
        groups.append({**_summary(header, members, tidal_range), "members": members})
    return sorted(groups, key=lambda item: (-int(item["member_count"]), str(item["name"]), int(item["root_pgc"])))


def _published_group(storage: Storage, root_pgc: int, group_id: int | None = None) -> dict[str, object] | None:
    if group_id is None:
        matches = [r for r in data_groups.select_published_groups(storage) if r["root_pgc"] == root_pgc]
        if len(matches) > 1:
            raise ValueError("Ambiguous published group root; specify group_id")
        if not matches:
            return None
        row = matches[0]
    else:
        row = data_groups.select_published_group_by_id(storage, group_id, root_pgc)
        if row is None:
            return None
    members = data_groups.select_published_members(storage, int(row["group_id"]))
    tidal_range = data_groups.select_tidal_range(storage)
    return {**_summary(row, members, tidal_range), "source_description": row["source_description"], "members": members}


def list_groups(storage: Storage, definition: str = "physical") -> list[dict[str, object]]:
    if definition not in ("physical", "suite", "published"):
        raise ValueError("Unsupported group definition")
    if definition == "published":
        published = data_groups.select_published_groups(storage)
        if not published:
            return []
        members_by_group: dict[int, list[dict[str, object]]] = defaultdict(list)
        group_ids = [int(row["group_id"]) for row in published]
        for member in data_groups.select_published_members_bulk(storage, group_ids):
            members_by_group[int(member["group_id"])].append(member)
        eligible = [
            (row, members_by_group[int(row["group_id"])])
            for row in published
            if len(members_by_group[int(row["group_id"])]) >= 3
        ]
        if not eligible:
            return []
        tidal_range = data_groups.select_tidal_range(storage)
        groups = [_summary(row, members, tidal_range) for row, members in eligible]
        return sorted(groups, key=lambda x: (-int(x["member_count"]), str(x["name"])))
    return [
        {key: value for key, value in group.items() if key not in ("members", "tidal_min", "tidal_max")}
        for group in derive_live_groups(data_groups.select_live_objects(storage), definition)
    ]


def get_group(
    storage: Storage, root_pgc: int, definition: str = "physical", group_id: int | None = None
) -> dict[str, object] | None:
    if definition == "published":
        return _published_group(storage, root_pgc, group_id)
    if group_id is not None:
        raise ValueError("group_id selector is only valid for published groups")
    if definition not in ("physical", "suite"):
        raise ValueError("Unsupported group definition")
    tidal_range = data_groups.select_tidal_range(storage)
    return next(
        (
            group
            for group in derive_live_groups(data_groups.select_live_objects(storage), definition, tidal_range)
            if int(group["root_pgc"]) == root_pgc
        ),
        None,
    )


def _membership_choice(group: dict[str, object], member: dict[str, object]) -> dict[str, object]:
    return {
        "group_id": group["group_id"],
        "root_pgc": group["root_pgc"],
        "name": group["name"],
        "definition": group["definition"],
        "data_status": group["data_status"],
        "source_catalog": group["source_catalog"],
        "source_version": group["source_version"],
        "source_sha256": group.get("source_sha256"),
        "source_description": group.get("source_description"),
        "member_pgc": member["pgc"],
        "parent_md_pgc": member.get("parent_md_pgc"),
        "membership_status": member["membership_status"],
        "source_status": member["source_status"],
        "hierarchy_depth": member["hierarchy_depth"],
    }


def find_member_groups(storage: Storage, member_pgc: int) -> list[dict[str, object]]:
    """Return source-distinct, explicit memberships, never positional guesses."""
    if member_pgc <= 0:
        return []
    results: list[dict[str, object]] = []
    for row in data_groups.select_published_memberships(storage, member_pgc):
        group = {
            "group_id": row["group_id"],
            "root_pgc": row["root_pgc"],
            "name": row["name"],
            "definition": row["definition"],
            "data_status": row["data_status"],
            "source_catalog": row["source_catalog"],
            "source_version": row["source_version"],
            "source_sha256": row.get("source_sha256"),
            "source_description": row.get("source_description"),
        }
        member = {
            "pgc": row["member_pgc"],
            "parent_md_pgc": row["parent_md_pgc"],
            "membership_status": row["membership_status"],
            "source_status": row["source_status"],
            "hierarchy_depth": row["hierarchy_depth"],
        }
        results.append(_membership_choice(group, member))

    # Only one current, revision-checked physical snapshot per request.
    rows = data_groups.select_live_objects(storage)
    for definition in ("physical", "suite"):
        for group in derive_live_groups(rows, definition):
            group_members = cast(list[dict[str, object]], group["members"])
            member = next((m for m in group_members if int(m["pgc"]) == member_pgc), None)
            if member is not None:
                results.append(_membership_choice(group, member))
    return sorted(
        results,
        key=lambda row: (
            {"physical": 0, "suite": 1, "published": 2}[str(row["definition"])],
            int(row["root_pgc"]),
            str(row["source_catalog"]),
            str(row["source_version"]),
            int(row["group_id"]),
        ),
    )


def detail_with_distance_lineage(group: dict[str, object]) -> dict[str, object]:
    """Add data-origin evidence without upgrading method hints to verified distances."""
    members = []
    for item in cast(list[dict[str, object]], group["members"]):
        member = dict(item)
        distance = _number(member.get("dist_mpc"))
        derived_distance = _number(member.get("derived_distance_mpc"))
        observed_distance = _number(member.get("observed_distance_mpc"))
        value_source = (
            "lv.physical" if derived_distance is not None else "lv.observed" if observed_distance is not None else None
        )
        method = (
            member.get("derived_distance_method") or member.get("distance_method")
            if value_source == "lv.physical"
            else member.get("distance_method")
        )
        method_text = method if isinstance(method, str) else None
        member["distance_origin"] = group_geometry.distance_origin(distance, method_text)
        member["distance_value_source"] = value_source
        member["distance_method_for_value"] = method_text
        # This flag stays false pending source-level scientific validation.
        member["distance_provenance_verified"] = False
        member["distance_3d_eligible"] = False
        members.append(member)

    root = next((m for m in members if int(m["pgc"]) == int(group["root_pgc"])), None)
    center = None
    if root is not None and _position(root):
        center = {
            "center_type": "root_md",
            "center_pgc": root["pgc"],
            "ra": root["ra"],
            "dec": root["dec"],
            "distance_mpc": root.get("dist_mpc"),
            "distance_origin": root["distance_origin"],
            "distance_provenance_verified": False,
            "physical_3d_eligible": False,
        }
    return {
        **group,
        "members": members,
        "scene_center": center,
        "distance_contract": "method_classification_unverified_v1",
        "radius_measurements": [],
    }
