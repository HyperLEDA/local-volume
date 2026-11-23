#!/usr/bin/env python3
"""Capture documented, high-resolution LV LEDA interface figures.

HTTP GET and screenshots only: never connects to PostgreSQL or mutates a catalogue.
Run while the local read-only server on 127.0.0.1:8000 is available.

Dependencies: uv run --with playwright --with pillow python scripts/capture_about_figures.py
Requires a local Chromium/Edge-family browser installed. Images come only from the
actual pages at /, /object/28630 and /groups/<root>?definition=suite.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import urlopen

try:
    from PIL import Image, ImageStat
    from playwright.sync_api import sync_playwright
except ImportError as exc:
    raise SystemExit(
        "Install runtime dependencies with: uv run --with playwright --with pillow python "
        "scripts/capture_about_figures.py"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "about" / "captures"


def get_json(base: str, route: str):
    with urlopen(base + route, timeout=30) as resp:
        if resp.status != 200:
            raise RuntimeError(f"GET {route}: HTTP {resp.status}")
        return json.load(resp)


def group_example(base: str):
    groups = get_json(base, "/api/v1/groups?definition=suite")["data"]
    candidates = sorted(
        [
            g
            for g in groups
            if isinstance(g.get("root_pgc"), int) and g["root_pgc"] > 0 and g.get("member_count", 0) >= 3
        ],
        key=lambda g: (-g.get("subgroup_count", 0), -g.get("member_count", 0), g["root_pgc"]),
    )
    fallback = None
    for candidate in candidates[:8]:
        root = candidate["root_pgc"]
        try:
            group = get_json(base, f"/api/v1/group/{root}?definition=suite")["data"]
            members = group["members"]
            by_pgc = {m["pgc"]: m for m in members}
            centre = by_pgc.get(root)
            if (
                centre is None
                or not isinstance(centre.get("ra"), (float, int))
                or not isinstance(centre.get("dec"), (float, int))
            ):
                continue
            usable = [
                m for m in members if isinstance(m.get("ra"), (int, float)) and isinstance(m.get("dec"), (int, float))
            ]
            if len(usable) < 3:
                continue
            edges = [
                (m["parent_md_pgc"], m["pgc"])
                for m in members
                if m.get("parent_md_pgc") in by_pgc and m["parent_md_pgc"] != m["pgc"]
            ]
            direct = {child for parent, child in edges if parent == root}
            if fallback is None and direct:
                fallback = group
            if any(parent in direct for parent, _ in edges):
                return group
        except Exception:
            continue
    if fallback is not None:
        return fallback
    raise RuntimeError("No verified group with at least one Main Disturber link found in local catalogue")


def choose_browser(playwright, executable: str | None):
    if executable:
        path = Path(executable)
        if not path.is_file():
            raise FileNotFoundError(f"Browser executable not found: {path}")
        return playwright.chromium.launch(
            executable_path=str(path),
            headless=True,
            args=["--hide-scrollbars", "--enable-webgl", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        )
    candidates = [
        Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path.home() / "AppData/Local/Yandex/YandexBrowser/Application/browser.exe",
    ]
    for path in candidates:
        if path.is_file():
            print("Browser:", path)
            return playwright.chromium.launch(
                executable_path=str(path),
                headless=True,
                args=["--hide-scrollbars", "--enable-webgl", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
            )
    try:
        return playwright.chromium.launch(
            headless=True,
            args=["--hide-scrollbars", "--enable-webgl", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        )
    except Exception as exc:
        raise RuntimeError(
            "No Chromium browser. Install Microsoft Edge or run: "
            "uv run --with playwright python -m playwright install chromium"
        ) from exc


def wait_for_sky(page, settle: float):
    """Issue #85 v15.1: wait for a painted Aladin frame, not a hidden inner div.

    Atlas intentionally hides its WebGL container until the first stable frame.
    A visibility wait for `.aladin-lite-div` can therefore time out even when
    React has mounted the map. Fail closed if there is no rendered map canvas.
    """
    page.locator(".aladin-frame").first.wait_for(state="attached", timeout=45000)
    page.wait_for_function(
        """() => {
            const root = document.querySelector('.aladin-frame');
            if (!root) return false;
            if (root.getAttribute('aria-busy') === 'true') return false;
            const css = window.getComputedStyle(root);
            if (css.visibility === 'hidden' || css.display === 'none') return false;
            return [...root.querySelectorAll('canvas')].some(
                c => c.width >= 500 && c.height >= 350
            );
        }""",
        timeout=60000,
    )
    page.wait_for_timeout(int(settle * 1000))
    errors = page.locator(".catalog-status-error, .group-sky-map[data-layer-error]")
    if errors.count():
        raise RuntimeError("Scientific sky layer error: " + errors.first.inner_text()[:300])


def dump_capture_failure(page, name: str, error: Exception, events: list[str]) -> None:
    """Local diagnostic artifacts only, never write a missing-figure placeholder."""
    folder = ROOT / ".about-capture-diagnostics"
    folder.mkdir(parents=True, exist_ok=True)
    try:
        page.screenshot(path=str(folder / f"{name}-failure.png"), animations="disabled", timeout=15000)
    except Exception as failure:
        events.append(f"Diagnostic screenshot failed: {str(failure)[:300]}")
    info = {"step": name, "url": page.url, "error": str(error)[:1000], "browser_events": events[-25:]}
    try:
        info["title"] = page.title()
        info["map_elements"] = page.locator(".aladin-frame").count()
        info["canvases"] = page.locator("canvas").count()
        info["map_error_text"] = page.locator(".catalog-status-error").all_inner_texts()
        info["visible_text_excerpt"] = page.locator("body").inner_text(timeout=4000)[:1200]
    except Exception as diag_error:
        info["diagnostic_error"] = str(diag_error)[:400]
    (folder / f"{name}-failure.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"CAPTURE FAILURE DIAGNOSTICS: {folder / (name + '-failure.json')}", file=sys.stderr)
    print(f"CAPTURE FAILURE SCREENSHOT: {folder / (name + '-failure.png')}", file=sys.stderr)
    for event in events[-8:]:
        print("  BROWSER:", event[:350], file=sys.stderr)


def screenshot_png(page, selector: str, *, max_height: int | None = None) -> bytes:
    target = page.locator(selector).first
    target.wait_for(state="visible", timeout=25000)
    # Align the inspected component just below the sticky site header.
    target.evaluate("el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 122)")
    page.wait_for_timeout(400)
    box = target.bounding_box()
    if box is None or box["width"] < 450 or box["height"] < 240:
        raise RuntimeError(f"Invalid capture geometry for {selector}: {box}")
    if max_height is None:
        return target.screenshot(type="png", animations="disabled", timeout=60000)
    viewport = page.viewport_size
    if viewport is None:
        raise RuntimeError("Missing viewport")
    # Capture a strictly native screen region, not a composite or reconstructed UI.
    x = max(0, box["x"])
    y = max(0, box["y"])
    width = min(box["width"], viewport["width"] - x)
    height = min(max_height, box["height"], viewport["height"] - y)
    if width < 450 or height < 240:
        raise RuntimeError(f"Cannot capture visible viewport of {selector}")
    return page.screenshot(
        type="png", animations="disabled", clip={"x": x, "y": y, "width": width, "height": height}, timeout=60000
    )


def encode_png(png: bytes, file: Path, quality: int) -> dict:
    image = Image.open(io.BytesIO(png)).convert("RGB")
    if image.width < 1600 or image.height < 700:
        raise RuntimeError(f"Capture resolution too low: {image.width}x{image.height} for {file.name}")
    # Reject blank or nearly uniform captures. This is a smoke check, not image vetting.
    stat = ImageStat.Stat(image.resize((150, 90)))
    if max(stat.stddev) < 7:
        raise RuntimeError(f"Capture looks blank: {file.name}")
    file.parent.mkdir(parents=True, exist_ok=True)
    image.save(file, "WEBP", quality=quality, method=6)
    if file.stat().st_size < 65_000:
        raise RuntimeError(f"Suspiciously small capture: {file.name} ({file.stat().st_size} bytes)")
    return {
        "width_px": image.width,
        "height_px": image.height,
        "bytes": file.stat().st_size,
        "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--browser", default=None, help="Path to Edge/Chrome/Yandex/Chromium binary")
    ap.add_argument("--settle", type=float, default=6.0, help="Seconds for DSS2 tiles and WebGL to paint")
    ap.add_argument("--quality", type=int, default=94)
    args = ap.parse_args()
    if not (0 < args.settle <= 60):
        ap.error("settle must be in (0,60]")
    if not (80 <= args.quality <= 100):
        ap.error("quality must be 80..100")
    base = args.base.rstrip("/")
    if base not in ("http://127.0.0.1:8000", "http://localhost:8000"):
        ap.error("Only the explicit local server on port 8000 is permitted")
    catalog = get_json(base, "/api/v1/objects")["data"]
    # /api/v1/objects is column-oriented: data.pgc is an array, not data itself.
    pgcs = catalog.get("pgc") if isinstance(catalog, dict) else None
    if not isinstance(pgcs, list) or len(pgcs) < 10 or not all(isinstance(pgc, int) and pgc > 0 for pgc in pgcs):
        raise RuntimeError("No valid PGC array in the local catalogue response")
    group = group_example(base)
    print(f"Catalogue: {len(pgcs)} real records; group: {group['name']} (PGC {group['root_pgc']})")
    captured_at = datetime.now(UTC).isoformat()
    with tempfile.TemporaryDirectory(prefix="lv-leda-about-v14-") as tmp:
        target = Path(tmp)
        with sync_playwright() as pw:
            browser = choose_browser(pw, args.browser)
            try:
                context = browser.new_context(
                    viewport={"width": 1760, "height": 1040},
                    device_scale_factor=2,
                    reduced_motion="reduce",
                    color_scheme="dark",
                )
                page = context.new_page()
                page.set_default_timeout(45000)
                browser_events = []
                page.on("pageerror", lambda exc: browser_events.append("JS ERROR: " + str(exc)[:400]))
                page.on(
                    "console",
                    lambda msg: browser_events.append("CONSOLE: " + msg.text[:400]) if msg.type == "error" else None,
                )
                page.on(
                    "requestfailed", lambda req: browser_events.append("REQUEST FAILED: " + req.url.split("?")[0][:220])
                )

                captures = {}
                for label, route, selector, maxheight in [
                    ("atlas", "/", "main", 880),
                    ("galaxy-pgc28630", "/object/28630", ".object-layout", 860),
                    ("group-suite", f"/groups/{group['root_pgc']}?definition=suite", ".group-overview-layout", 860),
                ]:
                    response = page.goto(base + route, wait_until="domcontentloaded", timeout=60000)
                    if response is None or response.status != 200:
                        raise RuntimeError(f"Page failed to load: {route}")
                    if label == "galaxy-pgc28630":
                        page.locator(".object-layout").wait_for(timeout=60000)
                    if label == "group-suite":
                        page.locator(".group-overview-layout").wait_for(timeout=60000)
                    try:
                        wait_for_sky(page, args.settle)
                    except Exception as exc:
                        dump_capture_failure(page, label, exc, browser_events)
                        raise RuntimeError(f"Cannot capture real sky map for {label}: {exc}") from exc
                    png = screenshot_png(page, selector, max_height=maxheight)
                    metrics = encode_png(png, target / f"{label}.webp", args.quality)
                    captures[label] = {"route": route, **metrics}
                    print(
                        f"CAPTURED {label}: {metrics['width_px']}x{metrics['height_px']} px, "
                        f"{metrics['bytes'] // 1024} KiB"
                    )
            finally:
                browser.close()
        metadata = {
            "root_pgc": group["root_pgc"],
            "name": group["name"],
            "member_count": group["member_count"],
            "source_catalog": group.get("source_catalog") or "LV LEDA",
            "source_version": group.get("source_version") or "unversioned",
            "captured_at": captured_at,
            "captures": captures,
        }
        (target / "group-suite.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        OUT.mkdir(parents=True, exist_ok=True)
        for path in target.iterdir():
            path.replace(OUT / path.name)
    print("PASS: 3 authentic, high-DPR scientific UI figures and group metadata:", OUT)
    print("Read-only HTTP access only. Rebuild the frontend to publish these static files locally.")


if __name__ == "__main__":
    main()
