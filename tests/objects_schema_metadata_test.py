from collections.abc import Sequence
from typing import Any, cast

from lv_backend.data.objects import select_schema
from lv_backend.data.storage import Storage


class _RecordingStorage:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, Sequence[Any] | None]] = []

    def query(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        self.calls.append((sql, params))
        return self.rows


def test_catalog_schema_fetches_main_and_alias_metadata_once() -> None:
    storage = _RecordingStorage(
        [
            {"column_name": "name", "param": {"description": "Main designation"}},
            {"column_name": "names", "param": {"description": "Additional name", "nice": "Aliases"}},
            {"column_name": "pgc", "param": {"description": "PGC identifier"}},
            {"column_name": "b_mag", "param": {"description": "B magnitude", "unit": "mag"}},
            {"column_name": "theta1", "param": {"description": "Tidal index"}},
        ]
    )
    columns = ("pgc", "name", "b_mag", "theta1", "names")
    schema = select_schema(cast(Storage, storage), columns)

    assert list(schema) == list(columns)
    assert schema["name"].description == "Main designation"
    assert schema["names"].description == "Additional name"
    assert schema["names"].nice == "Aliases"
    assert schema["b_mag"].unit == "mag"
    assert schema["theta1"].description == "Tidal index"
    assert len(storage.calls) == 1
    sql, params = storage.calls[0]
    assert "CASE WHEN table_name = 'names' THEN 'names' ELSE column_name END" in sql
    assert params == [["pgc", "name"], ["b_mag"], ["theta1"], True]


def test_catalog_schema_does_not_request_alias_metadata_if_absent() -> None:
    storage = _RecordingStorage([{"column_name": "name", "param": {"description": "Main designation"}}])
    schema = select_schema(cast(Storage, storage), ("name",))

    assert list(schema) == ["name"]
    assert schema["name"].description == "Main designation"
    assert len(storage.calls) == 1
    assert storage.calls[0][1] == [["name"], [], [], False]


def test_catalog_schema_retains_empty_metadata_fallbacks() -> None:
    storage = _RecordingStorage([{"column_name": "pgc", "param": {"description": 2, "unit": False}}])
    schema = select_schema(cast(Storage, storage), ("names", "pgc", "unknown"))

    assert list(schema) == ["names", "pgc", "unknown"]
    for field in ("names", "pgc", "unknown"):
        assert schema[field].description == ""
        assert schema[field].unit is None
        assert schema[field].nice is None
        assert schema[field].ucd is None
    assert len(storage.calls) == 1
    assert storage.calls[0][1] == [["pgc"], ["unknown"], [], True]
