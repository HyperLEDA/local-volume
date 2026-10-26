from lv_backend.data import objects as data_objects
from lv_backend.data.storage import Storage
from lv_backend.presentation import schemas


def list_objects(storage: Storage) -> schemas.ObjectsListResponse:
    column_schema = data_objects.select_schema(storage, data_objects.SUMMARY_COLUMNS)
    rows = data_objects.select_objects(storage)
    return schemas.ObjectsListResponse(
        data=schemas.ObjectSummaryColumns(
            pgc=[row["pgc"] for row in rows],
            name=[row["name"] for row in rows],
            ra=[row["ra"] for row in rows],
            dec=[row["dec"] for row in rows],
            names=[row["names"] for row in rows],
        ),
        schema=column_schema,
    )


def get_object(storage: Storage, pgc: int) -> schemas.ObjectGetResponse | None:
    row = data_objects.select_object(storage, pgc)
    if row is None:
        return None
    column_schema = data_objects.select_schema(storage, data_objects.DETAIL_COLUMNS)
    return schemas.ObjectGetResponse(
        data=schemas.ObjectDetail(
            pgc=row["pgc"],
            name=row["name"],
            ra=row["ra"],
            e_ra=row["e_ra"],
            dec=row["dec"],
            e_dec=row["e_dec"],
            cz=row["cz"],
            e_cz=row["e_cz"],
            type_name=row["type_name"],
            names=row["names"],
        ),
        schema=column_schema,
    )
