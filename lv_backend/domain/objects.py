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
            bt=[row["bt"] for row in rows],
            b_mag=[row["b_mag"] for row in rows],
            ks_mag=[row["ks_mag"] for row in rows],
            a26_arcmin=[row["a26_arcmin"] for row in rows],
            w50_kms=[row["w50_kms"] for row in rows],
            lvg_v_hel_kms=[row["lvg_v_hel_kms"] for row in rows],
            v_hel=[row["v_hel"] for row in rows],
            type_name=[row["type_name"] for row in rows],
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
            bt=row["bt"],
            e_bt=row["e_bt"],
            kt=row["kt"],
            e_kt=row["e_kt"],
            v_hel=row["v_hel"],
            e_v_hel=row["e_v_hel"],
            v_lg=row["v_lg"],
            e_v_lg=row["e_v_lg"],
            a50=row["a50"],
            e_a50=row["e_a50"],
            b50=row["b50"],
            e_b50=row["e_b50"],
            dist=row["dist"],
            source_catalog=row["source_catalog"],
            source_name=row["source_name"],
            mu=row["mu"],
            e_mu=row["e_mu"],
            distance_method=row["distance_method"],
            modulus_method=row["modulus_method"],
            distance_reference=row["distance_reference"],
            morphology_t=row["morphology_t"],
            dwarf_morphology=row["dwarf_morphology"],
            dwarf_sb_class=row["dwarf_sb_class"],
            a26_arcmin=row["a26_arcmin"],
            axis_ratio=row["axis_ratio"],
            a_b_galactic_mag=row["a_b_galactic_mag"],
            fuv_mag=row["fuv_mag"],
            e_fuv_mag=row["e_fuv_mag"],
            fuv_limit=row["fuv_limit"],
            b_mag=row["b_mag"],
            e_b_mag=row["e_b_mag"],
            ha_mag=row["ha_mag"],
            e_ha_mag=row["e_ha_mag"],
            ha_limit=row["ha_limit"],
            ks_mag=row["ks_mag"],
            e_ks_mag=row["e_ks_mag"],
            ks_estimated=row["ks_estimated"],
            hi21_mag=row["hi21_mag"],
            e_hi21_mag=row["e_hi21_mag"],
            hi21_limit=row["hi21_limit"],
            w50_kms=row["w50_kms"],
            e_w50_kms=row["e_w50_kms"],
            lvg_v_hel_kms=row["lvg_v_hel_kms"],
            lvg_e_v_hel_kms=row["lvg_e_v_hel_kms"],
            lvg_v_lg_kms=row["lvg_v_lg_kms"],
            lvg_source_catalog=row["lvg_source_catalog"],
            lvg_source_name=row["lvg_source_name"],
            type_name=row["type_name"],
            names=row["names"],
        ),
        schema=column_schema,
    )
