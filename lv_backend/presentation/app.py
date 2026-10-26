from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import fastapi

from lv_backend.data import storage as data_storage
from lv_backend.domain import objects
from lv_backend.presentation import schemas


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI) -> AsyncIterator[None]:
    storage = data_storage.Storage(data_storage.StorageConfig())
    storage.connect()
    app.state.storage = storage
    try:
        yield
    finally:
        storage.close()


app = fastapi.FastAPI(lifespan=lifespan)


@app.get("/v1/objects", response_model_exclude_none=True)
def list_objects(request: fastapi.Request) -> schemas.ObjectsListResponse:
    return objects.list_objects(request.app.state.storage)


@app.get("/v1/object/{pgc}", response_model_exclude_none=True)
def get_object(request: fastapi.Request, pgc: int) -> schemas.ObjectGetResponse:
    response = objects.get_object(request.app.state.storage, pgc)
    if response is None:
        raise fastapi.HTTPException(status_code=404)
    return response
