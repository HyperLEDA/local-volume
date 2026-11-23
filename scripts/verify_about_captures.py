#!/usr/bin/env python3
"""Publication gate for Issue #85's authentic LV LEDA interface captures.

Read-only inspection of generated assets, optionally the frontend build and
actual loopback HTTP responses. No DB connections, migrations or writes.

Usage:
  uv run --with pillow python scripts/verify_about_captures.py
  uv run --with pillow python scripts/verify_about_captures.py --dist
  uv run --with pillow python scripts/verify_about_captures.py --dist --http
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from PIL import Image, ImageStat, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = Path("about/captures")
NAMES = ("atlas", "galaxy-pgc28630", "group-suite")
EXPECTED_ROUTES = {"atlas": "/", "galaxy-pgc28630": "/object/28630"}
MIN_WIDTH_PX = 1600
MIN_HEIGHT_PX = 700


def check_file(file: Path, entry: dict) -> list[str]:
    errors: list[str] = []
    if not file.is_file():
        return [f"Missing capture: {file}"]
    data = file.read_bytes()
    if len(data) < 65000:
        errors.append(f"Capture too small to trust: {file.name} ({len(data)} bytes)")
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        errors.append(f"Not a WebP image: {file.name}")
        return errors
    if len(data) != entry.get("bytes"):
        errors.append(f"Byte length differs from capture manifest: {file.name}")
    digest = hashlib.sha256(data).hexdigest()
    if digest != entry.get("sha256"):
        errors.append(f"SHA-256 differs from capture manifest: {file.name}")
    try:
        with Image.open(file) as im:
            im.load()
            width, height = im.size
            if im.format != "WEBP":
                errors.append(f"Unexpected image format: {file.name} {im.format}")
            if width < MIN_WIDTH_PX or height < MIN_HEIGHT_PX:
                errors.append(f"Insufficient native resolution: {file.name} {width}x{height}")
            if (width, height) != (entry.get("width_px"), entry.get("height_px")):
                errors.append(f"Dimensions differ from capture manifest: {file.name}")
            preview = im.convert("RGB").resize((150, 90))
            if max(ImageStat.Stat(preview).stddev) < 7:
                errors.append(f"Near-uniform image: {file.name}")
    except (OSError, UnidentifiedImageError) as exc:
        errors.append(f"Cannot decode {file.name}: {exc}")
    return errors


def http_get(url: str) -> tuple[bytes, str]:
    with urlopen(url, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {url}")
        return response.read(), response.headers.get("Content-Type", "")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", action="store_true", help="Also validate frontend/dist files after bun run build")
    parser.add_argument(
        "--http", action="store_true", help="Also verify actual loopback server responses after rebuild"
    )
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    if args.http and not args.dist:
        parser.error("--http requires --dist")
    if args.base not in ("http://127.0.0.1:8000", "http://localhost:8000"):
        parser.error("Only the authorized local server on port 8000 is supported")
    folder = ROOT / "frontend/public" / CAPTURES
    manifest_path = folder / "group-suite.json"
    if not manifest_path.is_file():
        raise SystemExit(
            "FAIL: Missing group-suite.json. First run scripts/capture_about_figures.py and inspect its exit code."
        )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise SystemExit(f"FAIL: Invalid capture manifest: {exc}") from exc
    root_pgc = manifest.get("root_pgc")
    if not isinstance(root_pgc, int) or isinstance(root_pgc, bool) or root_pgc <= 0:
        raise SystemExit("FAIL: No valid group root PGC in capture manifest")
    captures = manifest.get("captures")
    if not isinstance(captures, dict) or set(captures) != set(NAMES):
        raise SystemExit("FAIL: Manifest does not describe all 3 expected captures")
    expected_group = f"/groups/{root_pgc}?definition=suite"
    expected_routes = {**EXPECTED_ROUTES, "group-suite": expected_group}
    errors: list[str] = []
    for name in NAMES:
        entry = captures[name]
        if not isinstance(entry, dict):
            errors.append(f"Invalid capture entry: {name}")
            continue
        if entry.get("route") != expected_routes[name]:
            errors.append(f"Incorrect source route for {name}: {entry.get('route')}")
        file = folder / (name + ".webp")
        errors.extend(check_file(file, entry))
        if args.dist:
            built_file = ROOT / "frontend/dist" / CAPTURES / (name + ".webp")
            if not built_file.is_file():
                errors.append(f"Missing built asset: {built_file}; run bun run build after capture")
            elif file.is_file() and built_file.read_bytes() != file.read_bytes():
                errors.append(f"Stale built asset: {name}.webp; rerun bun run build")
        if args.http:
            try:
                actual, content_type = http_get(args.base + "/" + CAPTURES.as_posix() + "/" + name + ".webp")
                if file.is_file() and actual != file.read_bytes():
                    errors.append(f"HTTP delivers stale/incorrect content for {name}.webp")
                if not content_type.lower().startswith("image/webp"):
                    errors.append(f"HTTP Content-Type is not image/webp for {name}: {content_type}")
            except (RuntimeError, HTTPError, URLError, OSError) as exc:
                errors.append(f"Cannot fetch HTTP image {name}.webp: {exc}")
        print(f"CHECKED {name}: {entry.get('width_px')}x{entry.get('height_px')} pixels · {entry.get('route')}")
    if args.dist:
        built_manifest = ROOT / "frontend/dist" / CAPTURES / "group-suite.json"
        if not built_manifest.is_file() or built_manifest.read_bytes() != manifest_path.read_bytes():
            errors.append("Built group metadata is missing or differs from the captured group")
    if args.http:
        try:
            data, _ = http_get(args.base + "/" + CAPTURES.as_posix() + "/group-suite.json")
            if data != manifest_path.read_bytes():
                errors.append("HTTP delivers stale/incorrect group metadata")
            live, _ = http_get(args.base + f"/api/v1/group/{root_pgc}?definition=suite")
            details = json.loads(live)["data"]
            if details.get("root_pgc") != root_pgc:
                errors.append("Live suite PGC differs from captured suite PGC")
            if details.get("source_version") != manifest.get("source_version"):
                errors.append("Live group source revision differs from captured revision; recapture figures")
            if details.get("member_count") != manifest.get("member_count"):
                errors.append("Live group membership count differs from captured record; recapture figures")
        except (RuntimeError, HTTPError, URLError, OSError, ValueError, KeyError) as exc:
            errors.append(f"Cannot verify live group metadata: {exc}")
    if errors:
        for message in errors:
            print("FAIL: " + message)
        raise SystemExit(
            f"FAILED: {len(errors)} capture integrity check(s). The About figures are NOT ready for review."
        )
    print("PASS: 3 high-resolution LV LEDA captures, group identity and manifest are consistent.")
    if args.dist:
        print("PASS: Frontend build includes the matching binary assets.")
    if args.http:
        print("PASS: Local HTTP serves the exact built files; group PGC/source metadata agree with live read-only API.")


if __name__ == "__main__":
    main()
