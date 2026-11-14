from collections.abc import Sequence
from typing import Any

from lv_backend.data.storage import Storage
from lv_backend.presentation import schemas

SUMMARY_COLUMNS: tuple[str, ...] = (
    "pgc",
    "name",
    "ra",
    "dec",
    "bt",
    "b_mag",
    "ks_mag",
    "a26_arcmin",
    "morphology_t",
    "w50_kms",
    "lvg_v_hel_kms",
    "v_hel",
    "type_name",
    "names",
)
DETAIL_COLUMNS: tuple[str, ...] = (
    "pgc",
    "name",
    "ra",
    "e_ra",
    "dec",
    "e_dec",
    "bt",
    "e_bt",
    "kt",
    "e_kt",
    "v_hel",
    "e_v_hel",
    "v_lg",
    "e_v_lg",
    "a50",
    "e_a50",
    "b50",
    "e_b50",
    "dist",
    "source_catalog",
    "source_name",
    "mu",
    "e_mu",
    "distance_method",
    "modulus_method",
    "distance_reference",
    "morphology_t",
    "dwarf_morphology",
    "dwarf_sb_class",
    "a26_arcmin",
    "axis_ratio",
    "a_b_galactic_mag",
    "fuv_mag",
    "e_fuv_mag",
    "fuv_limit",
    "b_mag",
    "e_b_mag",
    "ha_mag",
    "e_ha_mag",
    "ha_limit",
    "ks_mag",
    "e_ks_mag",
    "ks_estimated",
    "hi21_mag",
    "e_hi21_mag",
    "hi21_limit",
    "w50_kms",
    "e_w50_kms",
    "lvg_v_hel_kms",
    "lvg_e_v_hel_kms",
    "lvg_v_lg_kms",
    "lvg_source_catalog",
    "lvg_source_name",
    "type_name",
    "names",
)

_OBJECT_COLUMNS = frozenset(("pgc", "name", "ra", "e_ra", "dec", "e_dec", "type_name"))

_SCHEMA_QUERY = """
SELECT column_name, param
FROM meta.column_info
WHERE schema_name = 'lv'
  AND (
    (table_name = 'objects' AND column_name = ANY(%s))
    OR (table_name = 'observed' AND column_name = ANY(%s))
  )
"""

_NAMES_SCHEMA_QUERY = """
SELECT param
FROM meta.column_info
WHERE schema_name = 'lv'
  AND table_name = 'names'
  AND column_name = 'name'
"""

_NAMES_AGG = """
COALESCE(
    array_agg(n.name ORDER BY n.name) FILTER (WHERE n.name IS NOT NULL),
    '{}'
) AS names
"""

_OBJECTS_QUERY = f"""
SELECT o.pgc, o.name, o.ra, o.dec, obs.bt, obs.b_mag, obs.ks_mag,
       obs.a26_arcmin, obs.morphology_t, obs.w50_kms, obs.lvg_v_hel_kms, obs.v_hel,
       o.type_name, {_NAMES_AGG}
FROM lv.objects AS o
LEFT JOIN lv.observed AS obs ON obs.pgc = o.pgc
LEFT JOIN lv.names AS n ON n.pgc = o.pgc
GROUP BY o.pgc, obs.pgc
ORDER BY o.pgc
"""

_OBJECT_QUERY = f"""
SELECT
    o.pgc,
    o.name,
    o.ra,
    o.e_ra,
    o.dec,
    o.e_dec,
    obs.bt,
    obs.e_bt,
    obs.kt,
    obs.e_kt,
    obs.v_hel,
    obs.e_v_hel,
    obs.v_lg,
    obs.e_v_lg,
    obs.a50,
    obs.e_a50,
    obs.b50,
    obs.e_b50,
    obs.dist,
    obs.source_catalog,
    obs.source_name,
    obs.mu,
    obs.e_mu,
    obs.distance_method,
    obs.modulus_method,
    obs.distance_reference,
    obs.morphology_t,
    obs.dwarf_morphology,
    obs.dwarf_sb_class,
    obs.a26_arcmin,
    obs.axis_ratio,
    obs.a_b_galactic_mag,
    obs.fuv_mag,
    obs.e_fuv_mag,
    obs.fuv_limit,
    obs.b_mag,
    obs.e_b_mag,
    obs.ha_mag,
    obs.e_ha_mag,
    obs.ha_limit,
    obs.ks_mag,
    obs.e_ks_mag,
    obs.ks_estimated,
    obs.hi21_mag,
    obs.e_hi21_mag,
    obs.hi21_limit,
    obs.w50_kms,
    obs.e_w50_kms,
    obs.lvg_v_hel_kms,
    obs.lvg_e_v_hel_kms,
    obs.lvg_v_lg_kms,
    obs.lvg_source_catalog,
    obs.lvg_source_name,
    o.type_name,
    {_NAMES_AGG}
FROM lv.objects AS o
LEFT JOIN lv.observed AS obs ON obs.pgc = o.pgc
LEFT JOIN lv.names AS n ON n.pgc = o.pgc
WHERE o.pgc = %s
GROUP BY o.pgc, obs.pgc
"""


def select_schema(storage: Storage, columns: Sequence[str]) -> dict[str, schemas.ColumnMeta]:
    selected = [column for column in columns if column != "names"]
    object_columns = [column for column in selected if column in _OBJECT_COLUMNS]
    observed_columns = [column for column in selected if column not in _OBJECT_COLUMNS]
    rows = storage.query(_SCHEMA_QUERY, [object_columns, observed_columns])
    by_name = {row["column_name"]: _as_param(row["param"]) for row in rows}
    result = {column: _column_meta(by_name.get(column, {})) for column in selected}
    if "names" in columns:
        meta_rows = storage.query(_NAMES_SCHEMA_QUERY)
        param = _as_param(meta_rows[0]["param"]) if meta_rows else {}
        result["names"] = _column_meta(param)
    return {name: result[name] for name in columns}


def select_objects(storage: Storage) -> list[dict[str, Any]]:
    return storage.query(_OBJECTS_QUERY)


def select_object(storage: Storage, pgc: int) -> dict[str, Any] | None:
    rows = storage.query(_OBJECT_QUERY, [pgc])
    if not rows:
        return None
    return rows[0]


def _as_param(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _column_meta(param: dict[str, Any]) -> schemas.ColumnMeta:
    description = param.get("description")
    unit = param.get("unit")
    ucd = param.get("ucd")
    nice = param.get("nice")
    return schemas.ColumnMeta(
        description=description if isinstance(description, str) else "",
        unit=unit if isinstance(unit, str) else None,
        ucd=ucd if isinstance(ucd, str) else None,
        nice=nice if isinstance(nice, str) else None,
    )
