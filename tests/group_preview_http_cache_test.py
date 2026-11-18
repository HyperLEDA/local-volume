from collections.abc import Sequence
from typing import Any, cast

import fastapi
import fastapi.testclient

from lv_backend.data.storage import Storage
from lv_backend.domain.physical_calculations import FORMULA_VERSION
from lv_backend.presentation.app import api

_IMAGE = b"RIFFexample-preview-bytes"
_DIGEST = "4" * 64
_URL = "/api/v1/group-preview/29146?definition=physical&variant=portrait"


class _RecordingStorage:
    def __init__(self, *, exists: bool = True, current: bool = True) -> None:
        self.exists = exists
        self.current = current
        self.preview_queries: list[str] = []

    def query(self, sql: str, params: Sequence[Any] | None = None) -> list[dict[str, Any]]:
        if "FROM lv.physical_refresh_state" in sql:
            return [
                {
                    "source_revision": 5,
                    "applied_revision": 5 if self.current else 4,
                    "formula_version": FORMULA_VERSION,
                }
            ]
        if "FROM lv.group_previews" in sql:
            self.preview_queries.append(sql)
            if not self.exists:
                return []
            row: dict[str, Any] = {"image_sha256": _DIGEST}
            if "SELECT image_webp" in sql:
                row["image_webp"] = _IMAGE
            return [row]
        raise AssertionError("Unexpected SQL in preview test")


def _client(storage: _RecordingStorage) -> fastapi.testclient.TestClient:
    application = fastapi.FastAPI()
    application.state.storage = cast(Storage, storage)
    application.include_router(api)
    return fastapi.testclient.TestClient(application)


def test_head_returns_etag_without_reading_webp() -> None:
    storage = _RecordingStorage()
    with _client(storage) as client:
        response = client.head(_URL)
    assert response.status_code == 200
    assert response.content == b""
    assert response.headers["etag"] == f'"{_DIGEST}"'
    assert response.headers["cache-control"] == "no-cache"
    assert len(storage.preview_queries) == 1
    assert "image_webp" not in storage.preview_queries[0]


def test_conditional_get_returns_304_without_reading_webp() -> None:
    storage = _RecordingStorage()
    with _client(storage) as client:
        response = client.get(_URL, headers={"If-None-Match": f'W/"unused", W/"{_DIGEST}"'})
    assert response.status_code == 304
    assert response.content == b""
    assert response.headers["etag"] == f'"{_DIGEST}"'
    assert response.headers["cache-control"] == "no-cache"
    assert len(storage.preview_queries) == 1
    assert "image_webp" not in storage.preview_queries[0]


def test_regular_get_preserves_exact_webp_and_does_not_add_lookup() -> None:
    storage = _RecordingStorage()
    with _client(storage) as client:
        response = client.get(_URL)
    assert response.status_code == 200
    assert response.content == _IMAGE
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["etag"] == f'"{_DIGEST}"'
    assert len(storage.preview_queries) == 1
    assert "SELECT image_webp" in storage.preview_queries[0]


def test_unmatched_etag_fetches_current_image() -> None:
    storage = _RecordingStorage()
    with _client(storage) as client:
        response = client.get(_URL, headers={"If-None-Match": '"outdated"'})
    assert response.status_code == 200
    assert response.content == _IMAGE
    assert len(storage.preview_queries) == 2
    assert "image_webp" not in storage.preview_queries[0]
    assert "SELECT image_webp" in storage.preview_queries[1]


def test_missing_and_stale_previews_keep_existing_status_codes() -> None:
    with _client(_RecordingStorage(exists=False)) as client:
        assert client.head(_URL).status_code == 404
        assert client.get(_URL, headers={"If-None-Match": '"test"'}).status_code == 404
    with _client(_RecordingStorage(current=False)) as client:
        assert client.head(_URL).status_code == 409
        assert client.get(_URL, headers={"If-None-Match": '"test"'}).status_code == 409
    with _client(_RecordingStorage()) as client:
        assert client.get("/api/v1/group-preview/29146?variant=unknown").status_code == 422
