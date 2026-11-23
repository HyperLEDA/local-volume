from collections.abc import Sequence

from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION

# This snapshot is valid only while lv.physical is in sync with the source tables.
# The live Modes never read lv.group_members / the NGC 2784 family_passport.
_LIVE_SQL = """
SELECT o.pgc, o.name, o.ra, o.dec,
       COALESCE(p.distance_mpc, obs.dist) AS dist_mpc, obs.morphology_t, obs.b_mag,
       COALESCE(p.v_lg_kms, obs.lvg_v_lg_kms) AS lvg_v_lg_kms,
       obs.distance_method, obs.distance_reference,
       obs.source_catalog AS distance_source_catalog,
       obs.source_name AS distance_source_name,
       obs.dist AS observed_distance_mpc, p.distance_mpc AS derived_distance_mpc,
       p.distance_method AS derived_distance_method,
       p.abs_b_mag, p.log_mhi_msun, p.log_m26_msun,
       p.e_distance_minus_mpc, p.e_distance_plus_mpc, p.e_v_lg_kms,
       p.distance_error_basis, p.velocity_error_basis,
       (p.derived_hi_limit_flag IS NOT NULL) AS hi_mass_is_upper_limit,
       p.theta1 AS theta1_computed, p.md_pgc AS md_pgc_computed,
       p.log_lks_lsun, p.environment_coverage
FROM lv.objects o
JOIN lv.physical_refresh_state s
  ON s.singleton = TRUE AND s.source_revision = s.applied_revision
 AND s.formula_version = %s
JOIN lv.physical p ON p.pgc = o.pgc AND p.computed_revision = s.applied_revision
LEFT JOIN lv.observed obs ON obs.pgc = o.pgc
ORDER BY o.pgc
"""

_REFRESH_SQL = """
SELECT s.source_revision, s.applied_revision, s.formula_version,
       (SELECT COUNT(*) FROM lv.objects) AS objects_count
FROM lv.physical_refresh_state s
WHERE s.singleton = TRUE
"""

_PUBLISHED_GROUPS_SQL = """
SELECT g.group_id, g.root_pgc, g.definition, g.data_status, g.source_catalog,
       g.source_version, g.source_sha256, g.source_description,
       o.name AS root_name, o.ra AS root_ra, o.dec AS root_dec,
       obs.dist AS root_dist_mpc
FROM lv.groups g
JOIN lv.objects o ON o.pgc = g.root_pgc
LEFT JOIN lv.observed obs ON obs.pgc = g.root_pgc
WHERE g.definition = %s
ORDER BY g.group_id
"""

_PUBLISHED_MEMBERS_SELECT_SQL = """
SELECT gm.group_id, gm.member_pgc AS pgc, gm.parent_md_pgc, gm.hierarchy_depth,
       gm.membership_status, gm.source_status, gm.theta1_source,
       o.name, o.ra, o.dec, COALESCE(p.distance_mpc, obs.dist) AS dist_mpc, obs.morphology_t, obs.b_mag,
       COALESCE(p.v_lg_kms, obs.lvg_v_lg_kms) AS lvg_v_lg_kms, obs.distance_method,
       p.abs_b_mag, p.log_mhi_msun, p.log_m26_msun,
       p.log_lks_lsun, p.e_distance_minus_mpc, p.e_distance_plus_mpc, p.e_v_lg_kms,
       p.distance_error_basis, p.velocity_error_basis,
       (p.derived_hi_limit_flag IS NOT NULL) AS hi_mass_is_upper_limit,
       p.theta1 AS theta1_computed, p.md_pgc AS md_pgc_computed,
       p.environment_coverage
FROM lv.group_members gm
JOIN lv.objects o ON o.pgc = gm.member_pgc
LEFT JOIN lv.observed obs ON obs.pgc = gm.member_pgc
LEFT JOIN lv.physical_refresh_state s ON s.singleton = TRUE
LEFT JOIN lv.physical p ON p.pgc = gm.member_pgc
 AND s.source_revision = s.applied_revision
 AND s.formula_version = %s
 AND p.computed_revision = s.applied_revision
"""

_PUBLISHED_MEMBERS_SQL = (
    _PUBLISHED_MEMBERS_SELECT_SQL
    + """WHERE gm.group_id = %s
ORDER BY gm.hierarchy_depth, o.name, o.pgc
"""
)

_PUBLISHED_MEMBERS_BATCH_SQL = (
    _PUBLISHED_MEMBERS_SELECT_SQL
    + """WHERE gm.group_id = ANY(%s)
ORDER BY gm.group_id, gm.hierarchy_depth, o.name, o.pgc
"""
)

# A member PGC may occur in multiple versioned published group definitions.
# This lookup preserves each group's stable identifier and membership status.
_PUBLISHED_MEMBERSHIP_LOOKUP_SQL = """
SELECT g.group_id, g.root_pgc, g.definition, g.data_status,
       g.source_catalog, g.source_version, g.source_sha256, g.source_description,
       root.name AS name, gm.member_pgc, gm.parent_md_pgc,
       gm.membership_status, gm.source_status, gm.hierarchy_depth
FROM lv.group_members gm
JOIN lv.groups g ON g.group_id = gm.group_id
JOIN lv.objects root ON root.pgc = g.root_pgc
WHERE gm.member_pgc = %s AND g.definition = 'published'
ORDER BY g.group_id
"""

_PUBLISHED_GROUP_BY_ID_SQL = """
SELECT g.group_id, g.root_pgc, g.definition, g.data_status, g.source_catalog,
       g.source_version, g.source_sha256, g.source_description,
       o.name AS root_name, o.ra AS root_ra, o.dec AS root_dec,
       obs.dist AS root_dist_mpc
FROM lv.groups g
JOIN lv.objects o ON o.pgc = g.root_pgc
LEFT JOIN lv.observed obs ON obs.pgc = g.root_pgc
WHERE g.definition = 'published' AND g.group_id = %s AND g.root_pgc = %s
"""


def select_published_memberships(storage: Storage, member_pgc: int) -> list[dict[str, object]]:
    return storage.query(_PUBLISHED_MEMBERSHIP_LOOKUP_SQL, [member_pgc])


def select_published_group_by_id(storage: Storage, group_id: int, root_pgc: int) -> dict[str, object] | None:
    rows = storage.query(_PUBLISHED_GROUP_BY_ID_SQL, [group_id, root_pgc])
    return rows[0] if len(rows) == 1 else None


_TIDAL_SQL = """
SELECT MIN(p.theta1) AS min_theta, MAX(p.theta1) AS max_theta
FROM lv.physical p
JOIN lv.physical_refresh_state s ON s.singleton = TRUE
 AND s.source_revision = s.applied_revision AND s.formula_version = %s
 AND p.computed_revision = s.applied_revision
"""


def select_live_objects(storage: Storage) -> list[dict[str, object]]:
    status = storage.query(_REFRESH_SQL)
    if not status:
        raise RuntimeError("No lv.physical refresh state")
    state = status[0]
    if state["source_revision"] != state["applied_revision"] or state["formula_version"] != FORMULA_VERSION:
        raise RuntimeError("Physical catalogue is stale; finish lv.physical refresh before constructing groups")
    rows = storage.query(_LIVE_SQL, [FORMULA_VERSION])
    if len(rows) != state["objects_count"]:
        raise RuntimeError("Incomplete current lv.physical snapshot: refuse partial group catalogue")
    return rows


def select_published_groups(storage: Storage) -> list[dict[str, object]]:
    return storage.query(_PUBLISHED_GROUPS_SQL, ["published"])


def select_published_members(storage: Storage, group_id: int) -> list[dict[str, object]]:
    return storage.query(_PUBLISHED_MEMBERS_SQL, [FORMULA_VERSION, group_id])


def select_published_members_bulk(storage: Storage, group_ids: Sequence[int]) -> list[dict[str, object]]:
    if not group_ids:
        return []
    return storage.query(_PUBLISHED_MEMBERS_BATCH_SQL, [FORMULA_VERSION, list(group_ids)])


def select_tidal_range(storage: Storage) -> tuple[float | None, float | None]:
    rows = storage.query(_TIDAL_SQL, [FORMULA_VERSION])
    if not rows:
        return None, None
    return rows[0]["min_theta"], rows[0]["max_theta"]
