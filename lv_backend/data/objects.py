from collections.abc import Sequence
from typing import Any

from lv_backend.data.storage import Storage
from lv_backend.presentation import schemas

SUMMARY_COLUMNS: tuple[str, ...] = ("pgc", "name", "ra", "dec", "names")
DETAIL_COLUMNS: tuple[str, ...] = (
    "pgc",
    "name",
    "ra",
    "e_ra",
    "dec",
    "e_dec",
    "cz",
    "e_cz",
    "type_name",
    "names",
)

_SCHEMA_QUERY = """
SELECT column_name, param
FROM meta.column_info
WHERE schema_name = 'lv'
  AND table_name = 'objects'
  AND column_name = ANY(%s)
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
SELECT o.pgc, o.name, o.ra, o.dec, {_NAMES_AGG}
FROM lv.objects AS o
LEFT JOIN lv.names AS n ON n.pgc = o.pgc
GROUP BY o.pgc
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
    o.cz,
    o.e_cz,
    o.type_name,
    {_NAMES_AGG}
FROM lv.objects AS o
LEFT JOIN lv.names AS n ON n.pgc = o.pgc
WHERE o.pgc = %s
GROUP BY o.pgc
"""


def select_schema(storage: Storage, columns: Sequence[str]) -> dict[str, schemas.ColumnMeta]:
    object_columns = [column for column in columns if column != "names"]
    rows = storage.query(_SCHEMA_QUERY, [object_columns])
    by_name = {row["column_name"]: _as_param(row["param"]) for row in rows}
    result = {column: _column_meta(by_name.get(column, {})) for column in object_columns}
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
    return schemas.ColumnMeta(
        description=description if isinstance(description, str) else "",
        unit=unit if isinstance(unit, str) else None,
        ucd=ucd if isinstance(ucd, str) else None,
    )
