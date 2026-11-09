import argparse
import csv
import math
from dataclasses import dataclass
from pathlib import Path

import psycopg

from lv_backend.data.storage import StorageConfig

COLUMNS = (
    "pgc",
    "source_catalog",
    "source_name",
    "distance_modulus",
    "e_distance_modulus",
    "distance_mpc",
    "method",
    "reference",
    "basis",
)
SOURCE_CATALOG = "LV_SAO_2026-11-09"


@dataclass(frozen=True)
class DistanceRow:
    pgc: int
    distance_mpc: float
    method: str
    basis: str
    source_name: str
    reference: str | None


@dataclass(frozen=True)
class ImportPlan:
    pending: tuple[DistanceRow, ...]
    identical: int


def optional_float(value: str, field: str, line: int) -> float | None:
    if not value.strip():
        return None
    try:
        result = float(value)
    except ValueError as exc:
        raise ValueError(f"Line {line}: invalid {field}: {value!r}") from exc
    if not math.isfinite(result):
        raise ValueError(f"Line {line}: non-finite {field}")
    return result


def read_rows(path: Path) -> list[DistanceRow]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != list(COLUMNS):
            raise ValueError(f"Unexpected CSV columns: {reader.fieldnames!r}")
        result = []
        seen = set()
        for line, raw in enumerate(reader, start=2):
            if None in raw or any(value is None for value in raw.values()):
                raise ValueError(f"Line {line}: malformed CSV row")
            pgc_text = raw["pgc"].strip()
            if not pgc_text.isdecimal() or int(pgc_text) <= 0:
                raise ValueError(f"Line {line}: invalid PGC: {pgc_text!r}")
            pgc = int(pgc_text)
            if pgc in seen:
                raise ValueError(f"Line {line}: duplicate PGC {pgc}")
            seen.add(pgc)
            if raw["source_catalog"].strip() != SOURCE_CATALOG:
                raise ValueError(f"Line {line}: unexpected source catalog")
            name = raw["source_name"].strip()
            method = raw["method"].strip()
            reference = raw["reference"].strip() or None
            if not name or not method:
                raise ValueError(f"Line {line}: missing source name or method")
            basis = raw["basis"].strip()
            modulus = optional_float(raw["distance_modulus"], "distance_modulus", line)
            modulus_error = optional_float(raw["e_distance_modulus"], "e_distance_modulus", line)
            supplied_distance = optional_float(raw["distance_mpc"], "distance_mpc", line)
            if modulus_error is not None and (
                modulus is None or modulus_error < 0
            ):
                raise ValueError(f"Line {line}: invalid modulus uncertainty")
            if supplied_distance is not None and supplied_distance <= 0:
                raise ValueError(f"Line {line}: non-positive distance")
            if basis == "modulus":
                if modulus is None:
                    raise ValueError(f"Line {line}: missing distance modulus")
                try:
                    distance = 10 ** ((modulus - 25.0) / 5.0)
                except OverflowError as exc:
                    raise ValueError(f"Line {line}: invalid derived distance") from exc
            elif basis == "distance_only":
                if supplied_distance is None:
                    raise ValueError(f"Line {line}: missing distance")
                distance = supplied_distance
            else:
                raise ValueError(f"Line {line}: invalid basis: {basis!r}")
            if not math.isfinite(distance) or distance <= 0:
                raise ValueError(f"Line {line}: invalid derived distance")
            result.append(
                DistanceRow(
                    pgc=pgc,
                    distance_mpc=distance,
                    method=method,
                    basis=basis,
                    source_name=name,
                    reference=reference,
                )
            )
    if not result:
        raise ValueError("CSV contains no distances")
    return result


def plan_import(
    rows: list[DistanceRow], existing: dict[int, float | None]
) -> ImportPlan:
    missing = sorted({row.pgc for row in rows} - existing.keys())
    if missing:
        raise ValueError(f"Unmatched PGC ({len(missing)}): {missing[:20]}")
    pending = []
    identical = 0
    conflicts = []
    for row in rows:
        current = existing[row.pgc]
        if current is None:
            pending.append(row)
        elif math.isclose(current, row.distance_mpc, rel_tol=1e-12, abs_tol=1e-9):
            identical += 1
        else:
            conflicts.append((row.pgc, current, row.distance_mpc))
    if conflicts:
        raise ValueError(f"Conflicting existing distances: {conflicts[:20]}")
    return ImportPlan(pending=tuple(pending), identical=identical)


def run_import(
    rows: list[DistanceRow], config: StorageConfig, expected_database: str, apply: bool
) -> ImportPlan:
    if config.dbname != expected_database:
        raise ValueError(
            f"Target mismatch: STORAGE_DBNAME={config.dbname!r}, "
            f"--database={expected_database!r}"
        )
    with psycopg.connect(config.get_dsn()) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database()")
            actual_database = cursor.fetchone()[0]
            if actual_database != expected_database:
                raise ValueError(f"Connected to unexpected database {actual_database!r}")
            pgcs = [row.pgc for row in rows]
            lock = " FOR UPDATE" if apply else ""
            cursor.execute(
                "SELECT pgc, dist FROM lv.objects "
                f"WHERE pgc = ANY(%s) ORDER BY pgc{lock}",
                (pgcs,),
            )
            existing = dict(cursor.fetchall())
            plan = plan_import(rows, existing)
            if apply:
                for row in plan.pending:
                    cursor.execute(
                        "UPDATE lv.objects SET dist = %s "
                        "WHERE pgc = %s AND dist IS NULL",
                        (row.distance_mpc, row.pgc),
                    )
                    if cursor.rowcount != 1:
                        raise RuntimeError(f"Concurrent change for PGC {row.pgc}")
    print(f"Mode: {'APPLY' if apply else 'DRY RUN'}")
    print(f"Target: {config.endpoint}:{config.port}/{config.dbname}")
    print(f"CSV records: {len(rows)}")
    print(f"Matched PGC: {len(rows)}")
    print(f"New distances: {len(plan.pending)}")
    print(f"Already identical: {plan.identical}")
    print(f"Written: {len(plan.pending) if apply else 0}")
    return plan


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--expected-count", type=int)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        rows = read_rows(args.csv)
        if args.expected_count is not None and len(rows) != args.expected_count:
            raise ValueError(
                f"Unexpected CSV size: {len(rows)}, expected {args.expected_count}"
            )
        run_import(rows, StorageConfig(), args.database, args.apply)
    except (ValueError, OSError, psycopg.Error, RuntimeError) as exc:
        parser.exit(1, f"Import aborted: {exc}\n")


if __name__ == "__main__":
    main()
