from pathlib import Path

import fastapi
import fastapi.testclient

from lv_backend.presentation.app import _VersionedStaticFiles


def _client(tmp_path: Path) -> fastapi.testclient.TestClient:
    (tmp_path / "index-CmwTCsLX.js").write_text("console.log(1);", encoding="utf-8")
    (tmp_path / "sao-CwBMIs-4.png").write_bytes(b"image")
    (tmp_path / "unfingerprinted.js").write_text("console.log(2);", encoding="utf-8")
    app = fastapi.FastAPI()
    app.mount("/assets", _VersionedStaticFiles(directory=tmp_path), name="assets")
    return fastapi.testclient.TestClient(app)


def test_fingerprinted_js_is_cached_immutably(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/index-CmwTCsLX.js")
        assert response.status_code == 200
        assert response.text == "console.log(1);"
        assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
        assert response.headers.get("etag")


def test_hashes_with_a_dash_are_recognized(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/sao-CwBMIs-4.png")
        assert response.status_code == 200
        assert response.content == b"image"
        assert response.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_unfingerprinted_files_keep_default_cache_behavior(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/unfingerprinted.js")
        assert response.status_code == 200
        assert "cache-control" not in response.headers
        assert response.text == "console.log(2);"


def test_versioned_assets_keep_conditional_and_head_behavior(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        original = client.get("/assets/index-CmwTCsLX.js")
        unchanged = client.get("/assets/index-CmwTCsLX.js", headers={"If-None-Match": original.headers["etag"]})
        assert unchanged.status_code == 304
        assert unchanged.content == b""
        assert unchanged.headers["cache-control"] == "public, max-age=31536000, immutable"
        head = client.head("/assets/index-CmwTCsLX.js")
        assert head.status_code == 200
        assert head.content == b""
        assert head.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_missing_assets_remain_404(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/nonexistent-abcdef12.js")
        assert response.status_code == 404
