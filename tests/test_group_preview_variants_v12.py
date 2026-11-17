"""Preview variant contract tested through the public functions."""

from inspect import signature
from typing import cast

import pytest

from lv_backend.data import group_previews
from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION


class RecordingStorage:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[object] | None]] = []

    def query(self, sql: str, args: list[object] | None = None) -> list[dict[str, object]]:
        self.calls.append((sql, args))
        if "lv.physical_refresh_state" in sql:
            return [{"source_revision": 7, "applied_revision": 7, "formula_version": FORMULA_VERSION}]
        return []


def test_render_versions_are_distinct_and_legacy_hierarchy_is_stable() -> None:
    assert group_previews.preview_render_version("hierarchy") == group_previews.RENDER_VERSION
    assert group_previews.preview_render_version("portrait") != group_previews.RENDER_VERSION


def test_invalid_variant_is_rejected() -> None:
    with pytest.raises(ValueError):
        group_previews.preview_render_version("anything")


def test_read_key_includes_variant_and_revision() -> None:
    fake = RecordingStorage()
    assert group_previews.select_preview(cast(Storage, fake), 46957, "physical", "portrait") is None
    sql, args = fake.calls[-1]
    assert "variant = %s" in sql
    assert "source_revision = %s" in sql
    assert "render_version = %s" in sql
    assert args is not None and args[2] == "portrait" and args[3] == 7


def test_old_callers_default_to_hierarchy() -> None:
    assert signature(group_previews.select_preview).parameters["variant"].default == "hierarchy"
    assert signature(group_previews.save_preview).parameters["variant"].default == "hierarchy"
