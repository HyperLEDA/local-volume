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
from starlette.types import Receive, Scope, Send

from lv_backend.data import group_previews as data_group_previews
from lv_backend.data import migrations as data_migrations
from lv_backend.data import physical as data_physical
from lv_backend.data import physical_refresh as data_physical_refresh
from lv_backend.data import storage as data_storage
from lv_backend.domain import groups as domain_groups
from lv_backend.domain import objects
from lv_backend.presentation import discovery, schemas

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


class _PreviewSafeGZipMiddleware(GZipMiddleware):
    # Starlette's GZipMiddleware does not automatically exclude image/webp
    # returned by a normal Response, unlike static FileResponse pathsend.
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] in ("GET", "HEAD")
            and scope["path"].startswith("/api/v1/group-preview/")
        ):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


app = fastapi.FastAPI(lifespan=lifespan)
# Compress textual responses while preserving raw WebP bytes and their ETags.
app.add_middleware(_PreviewSafeGZipMiddleware, minimum_size=1024, compresslevel=5)
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
def get_group(
    request: fastapi.Request, root_pgc: int, definition: str = "physical", group_id: int | None = None
) -> dict[str, object]:
    if definition not in ("physical", "suite", "published"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported group definition")
    if group_id is not None and (group_id <= 0 or definition != "published"):
        raise fastapi.HTTPException(status_code=422, detail="Invalid group_id selector")
    try:
        group = domain_groups.get_group(request.app.state.storage, root_pgc, definition, group_id)
    except ValueError as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    if group is None:
        raise fastapi.HTTPException(status_code=404)
    return {"data": domain_groups.detail_with_distance_lineage(group)}


@api.get("/group-memberships/{member_pgc}")
def get_group_memberships(request: fastapi.Request, member_pgc: int) -> dict[str, object]:
    if member_pgc <= 0:
        raise fastapi.HTTPException(status_code=422, detail="Invalid member PGC")
    try:
        matches = domain_groups.find_member_groups(request.app.state.storage, member_pgc)
    except (RuntimeError, ValueError) as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    return {"data": matches}


def _preview_definition(definition: str) -> str:
    if definition not in ("physical", "suite"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported preview definition")
    return definition


def _preview_variant(variant: str) -> str:
    if variant not in ("hierarchy", "portrait"):
        raise fastapi.HTTPException(status_code=422, detail="Unsupported preview variant")
    return variant


def _preview_row(
    storage: data_storage.Storage,
    pgc: int,
    definition: str,
    variant: str,
    *,
    metadata_only: bool,
) -> dict[str, object]:
    variant = _preview_variant(variant)
    validated_definition = _preview_definition(definition)
    lookup = data_group_previews.select_preview_metadata if metadata_only else data_group_previews.select_preview
    try:
        row = lookup(storage, pgc, validated_definition, variant)
    except RuntimeError as exc:
        raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
    if row is None:
        raise fastapi.HTTPException(status_code=404, detail="Preview missing or outdated")
    return row


def _preview_response(
    storage: data_storage.Storage,
    pgc: int,
    definition: str,
    variant: str = "hierarchy",
) -> fastapi.Response:
    row = _preview_row(storage, pgc, definition, variant, metadata_only=False)
    return fastapi.Response(
        content=row["image_webp"],
        media_type="image/webp",
        headers={"ETag": '"' + str(row["image_sha256"]) + '"', "Cache-Control": "no-cache"},
    )


def _preview_metadata_response(
    storage: data_storage.Storage,
    pgc: int,
    definition: str,
    variant: str = "hierarchy",
) -> fastapi.Response:
    row = _preview_row(storage, pgc, definition, variant, metadata_only=True)
    return fastapi.Response(
        status_code=200,
        headers={"ETag": '"' + str(row["image_sha256"]) + '"', "Cache-Control": "no-cache"},
    )


@api.get("/group-preview/{root_pgc}")
def get_group_preview(
    request: fastapi.Request,
    root_pgc: int,
    definition: str = "physical",
    variant: str = "hierarchy",
) -> fastapi.Response:
    validators = request.headers.get("if-none-match")
    if validators is not None:
        metadata = _preview_metadata_response(request.app.state.storage, root_pgc, definition, variant)
        # Weak comparison is valid for If-None-Match on GET (RFC 9110).
        expected = metadata.headers["ETag"]
        matches = any(
            candidate.strip().removeprefix("W/").strip() in ("*", expected) for candidate in validators.split(",")
        )
        if matches:
            return fastapi.Response(
                status_code=304,
                headers={"ETag": expected, "Cache-Control": "no-cache"},
            )
    return _preview_response(request.app.state.storage, root_pgc, definition, variant)


@api.head("/group-preview/{root_pgc}")
def head_group_preview(
    request: fastapi.Request,
    root_pgc: int,
    definition: str = "physical",
    variant: str = "hierarchy",
) -> fastapi.Response:
    return _preview_metadata_response(request.app.state.storage, root_pgc, definition, variant)


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


# ISSUE72_HTTP_FIRST: accurate HTML metadata, HTTP statuses and opted-in crawlability.
def _catalogue_sitemap_paths(storage: data_storage.Storage) -> list[str]:
    pgcs = objects.list_objects(storage).data.pgc
    groups: dict[str, list[int]] = {}
    for definition in ("physical", "suite"):
        groups[definition] = [int(row["root_pgc"]) for row in domain_groups.list_groups(storage, definition)]
    return discovery.sitemap_paths(pgcs, groups)


@app.api_route("/robots.txt", methods=["GET", "HEAD"], include_in_schema=False)
def get_robots(request: fastapi.Request) -> fastapi.Response:
    origin = discovery.public_origin_for_host(request.headers.get("host"))
    return fastapi.Response(
        content=discovery.robots_text(origin),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache"},
    )


@app.api_route("/sitemap.xml", methods=["GET", "HEAD"], include_in_schema=False)
def get_sitemap(request: fastapi.Request) -> fastapi.Response:
    origin = discovery.public_origin_for_host(request.headers.get("host"))
    if origin is None:
        raise fastapi.HTTPException(status_code=404)
    paths = _catalogue_sitemap_paths(request.app.state.storage)
    parts = discovery.sitemap_chunks(paths)
    xml = (
        discovery.sitemap_xml(origin, parts[0]) if len(parts) == 1 else discovery.sitemap_index_xml(origin, len(parts))
    )
    return fastapi.Response(
        content=xml,
        media_type="application/xml",
        headers={"Cache-Control": "no-cache"},
    )


@app.api_route("/sitemap-part/{number}.xml", methods=["GET", "HEAD"], include_in_schema=False)
def get_sitemap_part(number: int, request: fastapi.Request) -> fastapi.Response:
    origin = discovery.public_origin_for_host(request.headers.get("host"))
    if origin is None:
        raise fastapi.HTTPException(status_code=404)
    parts = discovery.sitemap_chunks(_catalogue_sitemap_paths(request.app.state.storage))
    if len(parts) < 2 or not (1 <= number <= len(parts)):
        raise fastapi.HTTPException(status_code=404)
    return fastapi.Response(
        content=discovery.sitemap_xml(origin, parts[number - 1]),
        media_type="application/xml",
        headers={"Cache-Control": "no-cache"},
    )


def _frontend_page(full_path: str, request: fastapi.Request) -> fastapi.Response:
    if full_path == "api" or full_path.startswith("api/"):
        raise fastapi.HTTPException(status_code=404)
    dist_dir = _DIST_DIR.resolve()
    candidate = (dist_dir / full_path).resolve()
    if full_path and candidate.is_relative_to(dist_dir) and candidate.is_file():
        # /index.html must not create a second generic indexable application URL.
        if candidate.suffix.lower() == ".html":
            raise fastapi.HTTPException(status_code=404)
        return fastapi.responses.FileResponse(candidate)

    object_match = re.fullmatch(r"object/([1-9][0-9]*)/?", full_path)
    group_match = re.fullmatch(r"groups/([1-9][0-9]*)/?", full_path)
    page: discovery.PageInfo | None = None
    if object_match:
        pgc = int(object_match.group(1))
        if pgc > 9223372036854775807:
            raise fastapi.HTTPException(status_code=404)
        entity = objects.get_object(request.app.state.storage, pgc)
        if entity is None:
            raise fastapi.HTTPException(status_code=404)
        page = discovery.object_page(entity.data, pgc)
    elif group_match:
        root_pgc = int(group_match.group(1))
        if root_pgc > 9223372036854775807:
            raise fastapi.HTTPException(status_code=404)
        definition = request.query_params.get("definition", "physical")
        # The current GroupPage only renders physical groups and MD suites.
        if definition not in ("physical", "suite"):
            raise fastapi.HTTPException(status_code=404)
        try:
            group = domain_groups.get_group(request.app.state.storage, root_pgc, definition)
        except ValueError as exc:
            raise fastapi.HTTPException(status_code=409, detail=str(exc)) from exc
        if group is None:
            raise fastapi.HTTPException(status_code=404)
        page = discovery.group_page(group, root_pgc, definition)
    else:
        definition = request.query_params.get("definition", "physical")
        page = discovery.static_page(full_path.strip("/"), definition=definition)
    if page is None:
        raise fastapi.HTTPException(status_code=404)

    template = (dist_dir / "index.html").read_text(encoding="utf-8")
    origin = discovery.public_origin_for_host(request.headers.get("host"))
    indexable = bool(origin and page.indexable and page.canonical_path)
    headers = {"Cache-Control": "no-cache"}
    if not indexable:
        headers["X-Robots-Tag"] = "noindex, nofollow"
    return fastapi.responses.HTMLResponse(
        content=discovery.html_document(template, page, origin),
        headers=headers,
    )


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
        methods=["GET", "HEAD"],
        include_in_schema=False,
    )


_mount_frontend(app, _DIST_DIR)
