import csv
import math
from pathlib import Path

import pytest

from scripts.import_lv_sao_distances import (
    COLUMNS,
    SOURCE_CATALOG,
    DistanceRow,
    plan_import,
    read_rows,
)


def _record(**changes: str) -> dict[str, str]:
    row = {
        "pgc": "29146",
        "source_catalog": SOURCE_CATALOG,
        "source_name": "NGC3077",
        "distance_modulus": "27.93",
        "e_distance_modulus": "0.07",
        "distance_mpc": "",
        "method": "TRGB",
        "reference": "2016EDD...........S",
        "basis": "modulus",
    }
    row.update(changes)
    return row


def _write(path: Path, records: list[dict[str, str]]) -> Path:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)
    return path


def _distance_row() -> DistanceRow:
    return DistanceRow(29146, 10 ** ((27.93 - 25) / 5), "TRGB", "modulus", "NGC3077", None)


def test_modulus_to_distance(tmp_path: Path) -> None:
    rows = read_rows(_write(tmp_path / "pilot.csv", [_record()]))
    assert len(rows) == 1
    assert rows[0].distance_mpc == pytest.approx(3.854783576657718)
    assert rows[0].method == "TRGB"


def test_distance_only(tmp_path: Path) -> None:
    rows = read_rows(
        _write(
            tmp_path / "pilot.csv",
            [_record(distance_modulus="", e_distance_modulus="", distance_mpc="7.5", basis="distance_only")],
        )
    )
    assert rows[0].distance_mpc == 7.5


def test_missing_formal_error_allowed(tmp_path: Path) -> None:
    rows = read_rows(_write(tmp_path / "pilot.csv", [_record(e_distance_modulus="")]))
    assert len(rows) == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"pgc": "0"},
        {"pgc": "oops"},
        {"source_catalog": "OTHER"},
        {"source_name": ""},
        {"method": ""},
        {"basis": "unknown"},
        {"distance_modulus": ""},
        {"distance_modulus": "NaN"},
        {"distance_modulus": "Infinity"},
        {"distance_modulus": "2500"},
        {"e_distance_modulus": "-0.1"},
        {"distance_mpc": "-1"},
        {"distance_modulus": "", "basis": "distance_only"},
    ],
)
def test_invalid_rows_rejected(tmp_path: Path, changes: dict[str, str]) -> None:
    with pytest.raises(ValueError):
        read_rows(_write(tmp_path / "pilot.csv", [_record(**changes)]))


def test_duplicate_pgc_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="duplicate PGC"):
        read_rows(_write(tmp_path / "pilot.csv", [_record(), _record()]))


def test_empty_csv_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="no distances"):
        read_rows(_write(tmp_path / "pilot.csv", []))


def test_plan_new_distance() -> None:
    row = _distance_row()
    plan = plan_import([row], {row.pgc: None})
    assert plan.pending == (row,)
    assert plan.identical == 0


def test_plan_identical_distance() -> None:
    row = _distance_row()
    plan = plan_import([row], {row.pgc: row.distance_mpc})
    assert not plan.pending
    assert plan.identical == 1


def test_plan_missing_pgc_rejected() -> None:
    with pytest.raises(ValueError, match="Unmatched PGC"):
        plan_import([_distance_row()], {})


def test_plan_conflicting_distance_rejected() -> None:
    with pytest.raises(ValueError, match="Conflicting"):
        plan_import([_distance_row()], {29146: 99.0})


def test_derived_value_is_finite() -> None:
    assert math.isfinite(_distance_row().distance_mpc)
