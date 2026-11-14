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
    b_mag: list[float | None]
    ks_mag: list[float | None]
    a26_arcmin: list[float | None]
    morphology_t: list[int | None]
    w50_kms: list[float | None]
    lvg_v_hel_kms: list[float | None]
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
    source_catalog: str | None
    source_name: str | None
    mu: float | None
    e_mu: float | None
    distance_method: str | None
    modulus_method: str | None
    distance_reference: str | None
    morphology_t: int | None
    dwarf_morphology: str | None
    dwarf_sb_class: str | None
    a26_arcmin: float | None
    axis_ratio: float | None
    a_b_galactic_mag: float | None
    fuv_mag: float | None
    e_fuv_mag: float | None
    fuv_limit: str | None
    b_mag: float | None
    e_b_mag: float | None
    ha_mag: float | None
    e_ha_mag: float | None
    ha_limit: str | None
    ks_mag: float | None
    e_ks_mag: float | None
    ks_estimated: bool | None
    hi21_mag: float | None
    e_hi21_mag: float | None
    hi21_limit: str | None
    w50_kms: float | None
    e_w50_kms: float | None
    lvg_v_hel_kms: float | None
    lvg_e_v_hel_kms: float | None
    lvg_v_lg_kms: float | None
    lvg_source_catalog: str | None
    lvg_source_name: str | None
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
