from pathlib import Path

import fastapi
import fastapi.testclient

from lv_backend.presentation.app import _PreviewSafeGZipMiddleware, _VersionedStaticFiles
from lv_backend.presentation.app import app as production_app

_JS_BODY = ("const galaxy = 'LV LEDA';\n" * 8000).encode("utf-8")
_WEBP_BODY = b"RIFF" + b"0" * 4096


def _client(tmp_path: Path) -> fastapi.testclient.TestClient:
    (tmp_path / "index-CmwTCsLX.js").write_bytes(_JS_BODY)
    (tmp_path / "image-CwBMIs-4.webp").write_bytes(_WEBP_BODY)

    application = fastapi.FastAPI()
    application.add_middleware(_PreviewSafeGZipMiddleware, minimum_size=1024, compresslevel=5)
    application.mount("/assets", _VersionedStaticFiles(directory=tmp_path), name="assets")

    def objects() -> dict[str, object]:
        return {"data": {"pgc": list(range(800)), "name": ["LV LEDA"] * 800}}

    application.add_api_route("/api/v1/objects", objects, methods=["GET"])

    def preview() -> fastapi.Response:
        return fastapi.Response(
            content=_WEBP_BODY,
            media_type="image/webp",
            headers={"ETag": '"preview"', "Cache-Control": "no-cache"},
        )

    application.add_api_route("/api/v1/group-preview/42", preview, methods=["GET"])

    return fastapi.testclient.TestClient(application)


def test_production_application_enables_gzip() -> None:
    middleware = [item for item in production_app.user_middleware if item.cls is _PreviewSafeGZipMiddleware]
    assert len(middleware) == 1
    assert middleware[0].kwargs["minimum_size"] == 1024
    assert middleware[0].kwargs["compresslevel"] == 5


def test_large_js_is_gzipped_and_cache_policy_is_preserved(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/index-CmwTCsLX.js", headers={"Accept-Encoding": "gzip, br"})
        assert response.status_code == 200
        assert response.content == _JS_BODY  # HTTPX transparently decompresses the body.
        assert response.headers["content-encoding"] == "gzip"
        assert "Accept-Encoding" in response.headers["vary"]
        assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
        # Streaming gzip may omit Content-Length and use chunked transfer encoding.
        if "content-length" in response.headers:
            assert int(response.headers["content-length"]) < len(_JS_BODY) // 3


def test_json_api_is_gzipped_without_changing_values(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/api/v1/objects", headers={"Accept-Encoding": "gzip"})
        assert response.status_code == 200
        assert response.headers["content-encoding"] == "gzip"
        assert response.json()["data"]["pgc"] == list(range(800))
        assert len(response.json()["data"]["name"]) == 800


def test_identity_request_is_not_compressed(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/index-CmwTCsLX.js", headers={"Accept-Encoding": "identity"})
        assert response.status_code == 200
        assert response.content == _JS_BODY
        assert "content-encoding" not in response.headers
        assert int(response.headers["content-length"]) == len(_JS_BODY)


def test_range_request_keeps_original_content_range(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get(
            "/assets/index-CmwTCsLX.js",
            headers={"Accept-Encoding": "gzip", "Range": "bytes=0-127"},
        )
        assert response.status_code == 206
        assert response.content == _JS_BODY[:128]
        assert response.headers["content-range"] == f"bytes 0-127/{len(_JS_BODY)}"
        assert "content-encoding" not in response.headers


def test_conditional_request_retains_304_and_etag(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        original = client.get("/assets/index-CmwTCsLX.js", headers={"Accept-Encoding": "gzip"})
        unchanged = client.get(
            "/assets/index-CmwTCsLX.js",
            headers={"Accept-Encoding": "gzip", "If-None-Match": original.headers["etag"]},
        )
        assert unchanged.status_code == 304
        assert unchanged.content == b""
        assert unchanged.headers["cache-control"] == "public, max-age=31536000, immutable"
        assert unchanged.headers["etag"] == original.headers["etag"]


def test_head_retains_empty_body_and_valid_length(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        head = client.head("/assets/index-CmwTCsLX.js", headers={"Accept-Encoding": "gzip"})
        assert head.status_code == 200
        assert head.content == b""
        assert head.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_api_preview_webp_bypasses_gzip_and_retains_etag(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/api/v1/group-preview/42", headers={"Accept-Encoding": "gzip"})
        assert response.status_code == 200
        assert response.content == _WEBP_BODY
        assert response.headers["content-type"] == "image/webp"
        assert "content-encoding" not in response.headers
        assert response.headers["content-length"] == str(len(_WEBP_BODY))
        assert response.headers["etag"] == '"preview"'
        assert response.headers["cache-control"] == "no-cache"


def test_webp_files_are_not_compressed(tmp_path: Path) -> None:
    with _client(tmp_path) as client:
        response = client.get("/assets/image-CwBMIs-4.webp", headers={"Accept-Encoding": "gzip"})
        assert response.status_code == 200
        assert response.content == _WEBP_BODY
        assert "content-encoding" not in response.headers
