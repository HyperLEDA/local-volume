from __future__ import annotations

import csv
import hashlib
import math
import pathlib
import re

HOLD_PGC = 2807149
SOURCE_ROWS = 1678
STAGED_ROWS = 1676
SOURCE_SHA256 = "a5e8d0ca8dcf9bb37d5a0f3692d2e61ef79bdb8d21e5e62750256000b2904f0b"
STAGE_SHA256 = "54bbd87a6cdd6a1bbe0bbf231bddca7c68cfc948359f0828dc8e718fa58e3529"
UNMATCHED_SOURCE_NAMES = frozenset(("Dw1339+39", "FASHI1339+39"))

STAGE_FIELDS = (
    "pgc",
    "source_name",
    "source_file",
    "source_sha256",
    "source_line_number",
    "a26_kpc_published",
    "inclination_deg_published",
    "vrot_kms_published",
    "a_b_internal_mag_published",
    "abs_b_mag_published",
    "mean_sb_b_mag_arcsec2_published",
    "log_lks_lsun_published",
    "log_m26_msun_published",
    "log_mhi_limit_flag",
    "log_mhi_msun_published",
    "v_lg_kms_published",
    "theta1_published",
    "md_published",
    "theta5_published",
    "thetaj_published",
)
MAP_FIELDS = ("pgc", "source_name", "source_line_number", "source_sha256")
NUMBER = re.compile(r"^[+-]?(?:\d+\.?\d*|\.\d+)$")
TAIL = re.compile(r"^\s*(?P<t5>[+-]?\d+\.\d{2})?(?:\s+(?P<tj>[+-]?\d+\.\d{2}))?\s*$")


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for part in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def published_number(text: str, column: str, name: str) -> str:
    text = text.strip()
    if not text:
        return ""
    require(bool(NUMBER.fullmatch(text)), f"Invalid {column} for {name}: {text!r}")
    require(math.isfinite(float(text)), f"Non-finite {column} for {name}")
    return text


def parse_table2_line(line: str, number: int, source_sha256: str, source_file: str) -> dict[str, str] | None:
    if len(line) < 117 or not re.fullmatch(r"\d{6}\.\d", line[19:27]):
        return None
    name = line[:18].strip()
    require(bool(name), f"Missing name at source line {number}")
    tail = TAIL.fullmatch(line[117:])
    if tail is None:
        raise ValueError(f"Unparseable theta5/thetaj for {name}: {line[117:]!r}")
    row = {
        "source_name": name,
        "source_file": source_file,
        "source_sha256": source_sha256,
        "source_line_number": str(number),
        "a26_kpc_published": published_number(line[35:40], "a26", name),
        "inclination_deg_published": published_number(line[41:43], "inclination", name),
        "vrot_kms_published": published_number(line[44:47], "Vm", name),
        "a_b_internal_mag_published": published_number(line[48:52], "AB_internal", name),
        "abs_b_mag_published": published_number(line[53:58], "BMag", name),
        "mean_sb_b_mag_arcsec2_published": published_number(line[59:63], "SBB", name),
        "log_lks_lsun_published": published_number(line[64:69], "logKLum", name),
        "log_m26_msun_published": published_number(line[70:75], "logM26", name),
        "log_mhi_limit_flag": line[76:77].strip(),
        "log_mhi_msun_published": published_number(line[77:82], "logMHI", name),
        "v_lg_kms_published": published_number(line[83:87], "VLG", name),
        "theta1_published": published_number(line[88:93], "Theta1", name),
        "md_published": line[93:117].strip(),
        "theta5_published": published_number(tail.group("t5") or "", "Theta5", name),
        "thetaj_published": published_number(tail.group("tj") or "", "Thetaj", name),
    }
    require(row["log_mhi_limit_flag"] in ("", "<"), f"Unexpected HI qualifier for {name}")
    if row["log_mhi_limit_flag"]:
        require(bool(row["log_mhi_msun_published"]), f"Upper limit without value for {name}")
    if row["theta1_published"] and row["theta5_published"]:
        theta1 = float(row["theta1_published"])
        theta5 = float(row["theta5_published"])
        require(-0.02 <= theta5 - theta1 <= math.log10(5) + 0.02, f"Invalid tidal indices for {name}")
    return row


def read_table2(path: pathlib.Path) -> dict[str, dict[str, str]]:
    require(path.is_file(), f"Missing source: {path}")
    require(path.name == "lvg_table2.dat", f"Unexpected source filename: {path.name}")
    source_sha = sha256(path)
    require(source_sha == SOURCE_SHA256, f"Frozen LVGDB Table 2 differs: {source_sha}")
    rows: dict[str, dict[str, str]] = {}
    for lineno, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), start=1):
        row = parse_table2_line(line, lineno, source_sha, path.name)
        if row is None:
            continue
        name = row["source_name"]
        require(name not in rows, f"Duplicate Table 2 source name: {name}")
        rows[name] = row
    require(len(rows) == SOURCE_ROWS, f"Wrong Table 2 cardinality: {len(rows)}")
    require(
        rows["UGCA281"]["theta1_published"] == "-0.92" and rows["UGCA281"]["theta5_published"] == "-0.42",
        "Known Table 2 parser guard failed",
    )
    return rows


def read_approved_map(path: pathlib.Path, source: dict[str, dict[str, str]]) -> list[tuple[int, str]]:
    require(path.is_file(), f"Missing approved PGC map: {path}")
    result: list[tuple[int, str]] = []
    pgcs: set[int] = set()
    names: set[str] = set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        require(tuple(reader.fieldnames or ()) == MAP_FIELDS, "Unexpected approved map header")
        for row in reader:
            require(None not in row and all(v is not None for v in row.values()), "Malformed approved map row")
            pgc = int(row["pgc"])
            name = row["source_name"]
            require(pgc > 0 and pgc != HOLD_PGC and pgc not in pgcs, f"Duplicate/HOLD PGC: {pgc}")
            require(name in source and name not in names, f"Unknown/duplicate source name: {name}")
            require(row["source_sha256"] == SOURCE_SHA256, f"Source fingerprint mismatch at PGC {pgc}")
            require(
                row["source_line_number"] == source[name]["source_line_number"],
                f"Source line mismatch for PGC {pgc}: {name}",
            )
            pgcs.add(pgc)
            names.add(name)
            result.append((pgc, name))
    require(len(result) == STAGED_ROWS, f"Wrong approved PGC cardinality: {len(result)}")
    require(set(source) - names == set(UNMATCHED_SOURCE_NAMES), "Unexpected unused Table 2 rows")
    result.sort()
    return result


def render_stage(source_path: pathlib.Path, approved_map_path: pathlib.Path, output: pathlib.Path) -> str:
    require(not output.exists(), f"Refusing to overwrite output: {output}")
    require(output.parent.is_dir(), f"Output directory is missing: {output.parent}")
    source = read_table2(source_path)
    mapping = read_approved_map(approved_map_path, source)
    rows = [{"pgc": pgc, **source[name]} for pgc, name in mapping]
    require(sum(row["log_mhi_limit_flag"] == "<" for row in rows) == 221, "HI upper-limit count changed")
    require(sum(bool(row["theta1_published"]) for row in rows) == 1675, "Theta1 coverage changed")
    require(sum(bool(row["theta5_published"]) for row in rows) == 1675, "Theta5 coverage changed")
    temp = output.with_name(output.name + ".partial")
    require(not temp.exists(), f"Refusing to overwrite partial output: {temp}")
    try:
        with temp.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=STAGE_FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        actual = sha256(temp)
        require(actual == STAGE_SHA256, f"P0 byte-level mismatch: {actual} (expected {STAGE_SHA256})")
        require(not output.exists(), "Output appeared during staging")
        temp.rename(output)
        return actual
    finally:
        if temp.exists():
            temp.unlink()
