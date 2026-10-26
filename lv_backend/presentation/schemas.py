import pydantic


class ColumnMeta(pydantic.BaseModel):
    description: str
    unit: str | None = None
    ucd: str | None = None


class ObjectSummary(pydantic.BaseModel):
    pgc: int
    name: str
    ra: float | None
    dec: float | None


class ObjectDetail(pydantic.BaseModel):
    pgc: int
    name: str
    ra: float | None
    e_ra: float | None
    dec: float | None
    e_dec: float | None
    cz: float | None
    e_cz: float | None
    type_name: str | None


class ObjectsListResponse(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(populate_by_name=True)

    data: list[ObjectSummary]
    schema_: dict[str, ColumnMeta] = pydantic.Field(alias="schema")


class ObjectGetResponse(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(populate_by_name=True)

    data: ObjectDetail
    schema_: dict[str, ColumnMeta] = pydantic.Field(alias="schema")
