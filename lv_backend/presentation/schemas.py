import pydantic


class ColumnMeta(pydantic.BaseModel):
    description: str
    unit: str | None = None
    ucd: str | None = None
    nice: str | None = None


class ObjectSummaryColumns(pydantic.BaseModel):
    pgc: list[int]
    name: list[str]
    ra: list[float | None]
    dec: list[float | None]
    bt: list[float | None]
    v_hel: list[float | None]
    type_name: list[str | None]
    names: list[list[str]]


class ObjectDetail(pydantic.BaseModel):
    pgc: int
    name: str
    ra: float | None
    e_ra: float | None
    dec: float | None
    e_dec: float | None
    bt: float | None
    e_bt: float | None
    kt: float | None
    e_kt: float | None
    v_hel: float | None
    e_v_hel: float | None
    v_lg: float | None
    e_v_lg: float | None
    a50: float | None
    e_a50: float | None
    b50: float | None
    e_b50: float | None
    dist: float | None
    type_name: str | None
    names: list[str]


class ObjectsListResponse(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(populate_by_name=True)

    data: ObjectSummaryColumns
    schema_: dict[str, ColumnMeta] = pydantic.Field(alias="schema")


class ObjectGetResponse(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(populate_by_name=True)

    data: ObjectDetail
    schema_: dict[str, ColumnMeta] = pydantic.Field(alias="schema")
