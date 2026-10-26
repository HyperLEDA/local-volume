from collections.abc import Sequence
from typing import Any

from lv_backend.data.storage import Storage
from lv_backend.presentation import schemas

SUMMARY_COLUMNS: tuple[str, ...] = ("pgc", "name", "ra", "dec")
DETAIL_COLUMNS: tuple[str, ...] = ("pgc", "name", "ra", "e_ra", "dec", "e_dec", "cz", "e_cz", "type_name")

_SCHEMA_QUERY = """
SELECT column_name, param
FROM meta.column_info
WHERE schema_name = 'lv'
  AND table_name = 'objects'
  AND column_name = ANY(%s)
"""

_OBJECTS_QUERY = """
SELECT pgc, name, ra, dec
FROM lv.objects
ORDER BY pgc
"""

_OBJECT_QUERY = """
SELECT pgc, name, ra, e_ra, dec, e_dec, cz, e_cz, type_name
FROM lv.objects
WHERE pgc = %s
"""


def select_schema(storage: Storage, columns: Sequence[str]) -> dict[str, schemas.ColumnMeta]:
    rows = storage.query(_SCHEMA_QUERY, [list(columns)])
    by_name = {row["column_name"]: _as_param(row["param"]) for row in rows}
    return {name: _column_meta(by_name.get(name, {})) for name in columns}


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
