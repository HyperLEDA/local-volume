import fastapi

from lv_backend.presentation import schemas

app = fastapi.FastAPI()

_SUMMARY_SCHEMA = {
    "pgc": schemas.ColumnMeta(description="PGC identifier", ucd="meta.id;meta.main"),
    "name": schemas.ColumnMeta(description="Main designation", ucd="meta.id"),
    "ra": schemas.ColumnMeta(description="Right ascension (ICRS)", unit="deg", ucd="pos.eq.ra;meta.main"),
    "dec": schemas.ColumnMeta(description="Declination (ICRS)", unit="deg", ucd="pos.eq.dec;meta.main"),
}

_DETAIL_SCHEMA = {
    **_SUMMARY_SCHEMA,
    "e_ra": schemas.ColumnMeta(description="Right ascension error", unit="deg", ucd="stat.error;pos.eq.ra"),
    "e_dec": schemas.ColumnMeta(description="Declination error", unit="deg", ucd="stat.error;pos.eq.dec"),
    "cz": schemas.ColumnMeta(description="Heliocentric redshift (cz)", unit="km/s"),
    "e_cz": schemas.ColumnMeta(description="Redshift measurement error", unit="km/s"),
    "type_name": schemas.ColumnMeta(description="Object type code", ucd="src.class"),
}

_DUMMY_DETAIL = schemas.ObjectDetail(
    pgc=4321,
    name="NGC 1234",
    ra=12.345678,
    e_ra=0.0001,
    dec=-1.234567,
    e_dec=0.0001,
    cz=123.4,
    e_cz=5.0,
    type_name="G",
)


@app.get("/v1/objects", response_model_exclude_none=True)
def list_objects() -> schemas.ObjectsListResponse:
    return schemas.ObjectsListResponse(
        data=[
            schemas.ObjectSummary(
                pgc=_DUMMY_DETAIL.pgc,
                name=_DUMMY_DETAIL.name,
                ra=_DUMMY_DETAIL.ra,
                dec=_DUMMY_DETAIL.dec,
            )
        ],
        schema=_SUMMARY_SCHEMA,
    )


@app.get("/v1/object/{pgc}", response_model_exclude_none=True)
def get_object(pgc: int) -> schemas.ObjectGetResponse:
    del pgc
    return schemas.ObjectGetResponse(data=_DUMMY_DETAIL, schema=_DETAIL_SCHEMA)
