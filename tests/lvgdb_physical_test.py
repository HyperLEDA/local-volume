import csv

import pytest

from lv_backend.data import lvgdb_physical


def test_numeric_parser_retains_published_precision() -> None:
    assert lvgdb_physical.published_number(" 1.20", "x", "galaxy") == "1.20"
    assert lvgdb_physical.published_number("   ", "x", "galaxy") == ""
    with pytest.raises(ValueError, match="Invalid"):
        lvgdb_physical.published_number("<2.3", "x", "galaxy")


def test_approved_map_refuses_duplicate_pgc(tmp_path) -> None:
    source = {
        "A": {"source_line_number": "5"},
        "B": {"source_line_number": "6"},
    }
    path = tmp_path / "identities.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(lvgdb_physical.MAP_FIELDS)
        writer.writerow((10, "A", 5, lvgdb_physical.SOURCE_SHA256))
        writer.writerow((10, "B", 6, lvgdb_physical.SOURCE_SHA256))
    with pytest.raises(ValueError, match="Duplicate/HOLD"):
        lvgdb_physical.read_approved_map(path, source)


def test_approved_map_refuses_line_mismatch(tmp_path) -> None:
    source = {"A": {"source_line_number": "5"}}
    path = tmp_path / "identities.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(lvgdb_physical.MAP_FIELDS)
        writer.writerow((10, "A", 999, lvgdb_physical.SOURCE_SHA256))
    with pytest.raises(ValueError, match="Source line mismatch"):
        lvgdb_physical.read_approved_map(path, source)


def test_approved_map_refuses_held_pgc(tmp_path) -> None:
    source = {"A": {"source_line_number": "5"}}
    path = tmp_path / "identities.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(lvgdb_physical.MAP_FIELDS)
        writer.writerow((lvgdb_physical.HOLD_PGC, "A", 5, lvgdb_physical.SOURCE_SHA256))
    with pytest.raises(ValueError, match="Duplicate/HOLD"):
        lvgdb_physical.read_approved_map(path, source)


def test_source_line_parser_ignores_headers() -> None:
    assert lvgdb_physical.parse_table2_line("Published Table 2", 1, "checksum", "lvg_table2.dat") is None
