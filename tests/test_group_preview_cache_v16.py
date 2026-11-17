"""No database required; checks source-version invalidation and read-only cache status."""

from typing import cast

from lv_backend.data import group_previews
from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION


class FakeStorage:
    def __init__(self):
        self.calls = []

    def query(self, sql, args=None):
        self.calls.append((sql, args))
        if "lv.physical_refresh_state" in sql:
            return [{"source_revision": 7, "applied_revision": 7, "formula_version": FORMULA_VERSION}]
        if "FROM lv.group_previews" in sql:
            return [
                {
                    "root_pgc": 46957,
                    "variant": "portrait",
                    "source_revision": 7,
                    "formula_version": FORMULA_VERSION,
                    "render_version": group_previews.PORTRAIT_RENDER_VERSION,
                    "size_bytes": 40000,
                },
                {
                    "root_pgc": 46957,
                    "variant": "hierarchy",
                    "source_revision": 7,
                    "formula_version": FORMULA_VERSION,
                    "render_version": "sin-dss2-atlas-markers-v8-trimmed",
                    "size_bytes": 60000,
                },
            ]
        raise AssertionError(sql)


def test_cache_manifest_reports_current_and_stale_without_writing():
    storage = FakeStorage()
    manifest = group_previews.cache_manifest(cast(Storage, storage), "physical")
    assert manifest["revision"] == 7
    entries = cast(list[dict[str, object]], manifest["entries"])
    assert [(e["variant"], e["current"]) for e in entries] == [
        ("portrait", True),
        ("hierarchy", False),
    ]
    assert all("INSERT " not in sql.upper() and "UPDATE " not in sql.upper() for sql, _ in storage.calls)


def test_cache_manifest_rejects_unknown_definition():
    try:
        group_previews.cache_manifest(cast(Storage, FakeStorage()), "published")
    except ValueError:
        pass
    else:
        raise AssertionError("Unknown preview cache mode must be rejected")
