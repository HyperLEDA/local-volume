from unittest.mock import patch

import pytest

from lv_backend.data import objects as data_objects
from lv_backend.domain import objects as domain_objects
from lv_backend.presentation import schemas


def _object_row(dist: float | None) -> dict:
    row = dict.fromkeys(data_objects.DETAIL_COLUMNS)
    row.update(pgc=29146, name="NGC 3077", ra=150.8285, dec=68.7338, dist=dist, names=[])
    return row


def _get_object(dist: float | None):
    with (
        patch.object(data_objects, "select_object", return_value=_object_row(dist)),
        patch.object(
            data_objects,
            "select_schema",
            return_value={
                "dist": schemas.ColumnMeta(
                    description="Adopted distance", unit="Mpc", ucd="pos.distance"
                )
            },
        ),
    ):
        return domain_objects.get_object(None, 29146)


def test_adopted_distance_in_api() -> None:
    response = _get_object(3.854783576657718)
    assert response is not None
    assert response.data.dist == pytest.approx(3.854783576657718)
    assert response.schema_["dist"].unit == "Mpc"


def test_missing_distance_omitted_from_serialized_api() -> None:
    response = _get_object(None)
    assert response is not None
    assert response.data.dist is None
    payload = response.model_dump(by_alias=True, exclude_none=True)
    assert "dist" not in payload["data"]
    assert payload["schema"]["dist"]["unit"] == "Mpc"
