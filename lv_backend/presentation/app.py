import hmac
import os
import pathlib
import re
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import fastapi
import fastapi.responses
import fastapi.staticfiles
from starlette.middleware.gzip import GZipMiddleware
from starlette.types import Scope

from lv_backend.data import group_previews as data_group_previews
from lv_backend.data import migrations as data_migrations
from lv_backend.data import physical as data_physical
from lv_backend.data import physical_refresh as data_physical_refresh
from lv_backend.data import storage as data_storage
from lv_backend.domain import groups as domain_groups
from lv_backend.domain import objects
from lv_backend.presentation import schemas

_DIST_DIR = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI) -> AsyncIterator[None]:
    config = data_storage.StorageConfig()
    storage = data_storage.Storage(config)
    storage.connect()
    try:
        data_migrations.apply(config)
        app.state.storage = storage
        stop = threading.Event()
        worker = threading.Thread(
            target=data_physical_refresh.background_refresh,
            args=(config, stop),
            name="lv-physical-refresh",
            daemon=True,
        )
        worker.start()
        try:
            yield
        finally:
            stop.set()
            worker.join(timeout=1)
    finally:
        storage.close()


app = fastapi.FastAPI(lifespan=lifespan)
# Compress textual responses; Starlette preserves byte ranges and excludes image formats.
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)
api = fastapi.APIRouter(prefix="/api/v1")


@api.get("/objects", response_model_exclude_none=True)
def list_objects(request: fastapi.Request) -> schemas.ObjectsListResponse:
    return objects.list_objects(request.app.state.storage)


@api.get("/object/{pgc}", response_model_exclude_none=True)
def get_object(request: fastapi.Request, pgc: int) -> schemas.ObjectGetResponse:
    response = objects.get_object(request.app.state.storage, pgc)
    if response is None:
        raise fastapi.HTTPException(status_code=404)
    return response


@api.get("/object/{pgc}/physical")
def get_physical(request: fastapi.Request, pgc: int) -> dict[str, object]:
    row = data_physical.select_physical(request.app.state.storage, pgc)
    if row is None:
        raise fastapi.HTTPException(status_code=404)
    return {"data": row}


@api.get("/physical/refresh-status")
def get_physical_refresh_status(request: fastapi.Request) -> dict[str, object]:
    return {"data": data_physical.refresh_status(request.app.state.storage)}


@api.get("/groups")
def list_groups(request: fastapi.Request, definition: str = "physical") -> dict[str, object]:
    if definition not in ("physical", "suite", "published"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported group definition")
    return {"data": domain_groups.list_groups(request.app.state.storage, definition)}


@api.get("/group/{root_pgc}")
def get_group(request: fastapi.Request, root_pgc: int, definition: str = "physical") -> dict[str, object]:
    if definition not in ("physical", "suite", "published"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported group definition")
    try:
        group = domain_groups.get_group(request.app.state.storage, root_pgc, definition)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    if group is None:
        raise fastapi.HTTPException(status_code=404)
    return {"data": group}


def _preview_definition(definition: str) -> str:
    if definition not in ("physical", "suite"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported preview definition")
    return definition


def _preview_variant(variant: str) -> str:
    if variant not in ("hierarchy", "portrait"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported preview variant")
    return variant


def _preview_response(
    storage: data_storage.Storage,
    pgc: int,
    definition: str,
    variant: str = "hierarchy",
) -> fastapi.Response:
    variant = _preview_variant(variant)
    try:
        row = data_group_previews.select_preview(storage, pgc, _preview_definition(definition), variant)
    except RuntimeError as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    if row is None:
        raise fastapi.HTTPException(status_code=404, detail="Preview missing or outdated")
    return fastapi.Response(
        content=row["image_webp"],
        media_type="image/webp",
        headers={"ETag": '"' + str(row["image_sha256"]) + '"', "Cache-Control": "no-cache"},
    )


@api.get("/group-preview/{root_pgc}")
def get_group_preview(
    request: fastapi.Request,
    root_pgc: int,
    definition: str = "physical",
    variant: str = "hierarchy",
) -> fastapi.Response:
    return _preview_response(request.app.state.storage, root_pgc, definition, variant)


@api.head("/group-preview/{root_pgc}")
def head_group_preview(
    request: fastapi.Request,
    root_pgc: int,
    definition: str = "physical",
    variant: str = "hierarchy",
) -> fastapi.Response:
    result = _preview_response(request.app.state.storage, root_pgc, definition, variant)
    return fastapi.Response(status_code=200, headers={"ETag": result.headers["ETag"]})


@api.put("/group-preview/{root_pgc}")
async def put_group_preview(
    request: fastapi.Request,
    root_pgc: int,
    definition: str = "physical",
    variant: str = "hierarchy",
) -> dict[str, object]:
    definition = _preview_definition(definition)
    variant = _preview_variant(variant)
    if os.environ.get("LV_GROUP_PREVIEW_WRITE") != "1":
        raise fastapi.HTTPException(status_code=403, detail="Preview writing disabled")
    remote = request.client.host if request.client is not None else ""
    if remote not in ("127.0.0.1", "::1"):
        raise fastapi.HTTPException(status_code=403, detail="Local connections only")
    origin = request.headers.get("origin", "")
    if origin not in (
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ):
        raise fastapi.HTTPException(status_code=403, detail="Invalid origin")
    if not hmac.compare_digest(request.headers.get("content-type", ""), "image/webp"):
        raise fastapi.HTTPException(status_code=415, detail="WebP expected")
    revision_raw = request.headers.get("x-lv-physical-revision", "")
    if not revision_raw.isascii() or not revision_raw.isdigit():
        raise fastapi.HTTPException(status_code=422, detail="X-LV-Physical-Revision required")
    expected_revision = int(revision_raw)
    if expected_revision < 1:
        raise fastapi.HTTPException(status_code=422, detail="Invalid physical revision")
    body = await request.body()
    try:
        data_group_previews.validate_webp(body)
        if domain_groups.get_group(request.app.state.storage, root_pgc, definition) is None:
            raise fastapi.HTTPException(status_code=404, detail="Group not found")
        digest = data_group_previews.save_preview(
            request.app.state.storage, root_pgc, definition, body, expected_revision, variant
        )
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    return {"root_pgc": root_pgc, "definition": definition, "variant": variant, "sha256": digest}


# Groups v16: batch preview-cache inventory (metadata only)
@api.get("/group-preview-cache")
def get_group_preview_cache(request: fastapi.Request, definition: str = "physical") -> dict[str, object]:
    if definition not in ("physical", "suite"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported preview definition")
    try:
        data = data_group_previews.cache_manifest(request.app.state.storage, definition)
    except RuntimeError as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    data["write_enabled"] = os.environ.get("LV_GROUP_PREVIEW_WRITE") == "1"
    return {"data": data}


app.include_router(api)


def _frontend_page(full_path: str) -> fastapi.responses.FileResponse:
    if full_path == "api" or full_path.startswith("api/"):
        raise fastapi.HTTPException(status_code=404)
    dist_dir = _DIST_DIR.resolve()
    candidate = (dist_dir / full_path).resolve()
    if full_path and candidate.is_relative_to(dist_dir) and candidate.is_file():
        return fastapi.responses.FileResponse(candidate)
    return fastapi.responses.FileResponse(dist_dir / "index.html")


# Vite includes content fingerprints in generated /assets filenames.
_FINGERPRINTED_ASSET_RE = re.compile(r"-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$")


class _VersionedStaticFiles(fastapi.staticfiles.StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> fastapi.Response:
        response = await super().get_response(path, scope)
        if response.status_code in (200, 304) and _FINGERPRINTED_ASSET_RE.search(pathlib.PurePosixPath(path).name):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def _mount_frontend(application: fastapi.FastAPI, dist_dir: pathlib.Path) -> None:
    if not dist_dir.is_dir():
        return
    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        application.mount(
            "/assets",
            _VersionedStaticFiles(directory=assets_dir),
            name="assets",
        )
    application.add_api_route(
        "/{full_path:path}",
        _frontend_page,
        methods=["GET"],
        include_in_schema=False,
    )


_mount_frontend(app, _DIST_DIR)
