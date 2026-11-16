import pathlib
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import fastapi
import fastapi.responses
import fastapi.staticfiles

from lv_backend.data import migrations as data_migrations
from lv_backend.data import physical as data_physical
from lv_backend.data import physical_refresh as data_physical_refresh
from lv_backend.data import storage as data_storage
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


app.include_router(api)


def _frontend_page(full_path: str) -> fastapi.responses.FileResponse:
    if full_path == "api" or full_path.startswith("api/"):
        raise fastapi.HTTPException(status_code=404)
    dist_dir = _DIST_DIR.resolve()
    candidate = (dist_dir / full_path).resolve()
    if full_path and candidate.is_relative_to(dist_dir) and candidate.is_file():
        return fastapi.responses.FileResponse(candidate)
    return fastapi.responses.FileResponse(dist_dir / "index.html")


def _mount_frontend(application: fastapi.FastAPI, dist_dir: pathlib.Path) -> None:
    if not dist_dir.is_dir():
        return
    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        application.mount(
            "/assets",
            fastapi.staticfiles.StaticFiles(directory=assets_dir),
            name="assets",
        )
    application.add_api_route(
        "/{full_path:path}",
        _frontend_page,
        methods=["GET"],
        include_in_schema=False,
    )


_mount_frontend(app, _DIST_DIR)
