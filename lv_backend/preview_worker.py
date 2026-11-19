"""Generate the existing Aladin group thumbnails without enabling public image writes."""

from __future__ import annotations

import argparse
import importlib
import json
import os
from collections.abc import Callable
from typing import Any, cast
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from lv_backend.data import group_previews, storage
from lv_backend.domain import groups
from lv_backend.domain.physical_calculations import FORMULA_VERSION

ALLOWED_BATCHES = ("1", "24", "96", "all")


def cache_counts(
    group_rows: list[dict[str, object]],
    entries: list[dict[str, object]],
    variant: str,
) -> tuple[int, int, int]:
    current = {(int(row["root_pgc"]), str(row["variant"])) for row in entries if row["current"]}
    variants = ("portrait", "hierarchy") if variant == "both" else (variant,)
    wanted = [
        (int(group["root_pgc"]), mode)
        for group in group_rows
        for mode in variants
        if mode != "hierarchy" or int(group["root_pgc"]) not in group_previews.NO_HIERARCHY_PREVIEW_ROOTS
    ]
    ready = len(set(wanted) & current)
    return len(group_rows), len(wanted), len(wanted) - ready


def batch_selection(batch: str, group_count: int) -> tuple[str, str]:
    """Use the exact UI option for bounded batches or the current full group count."""
    if batch not in ALLOWED_BATCHES or group_count < 0:
        raise ValueError("Invalid preview batch selection")
    if batch == "all":
        return "label", f"All {group_count} groups"
    return "value", batch


def capture_target(url: str, base_url: str) -> tuple[int, str, str]:
    """Accept only the existing same-origin group image endpoint."""
    parsed = urlparse(url)
    base = urlparse(base_url)
    if (parsed.scheme, parsed.netloc) != (base.scheme, base.netloc):
        raise ValueError("Preview request is not same-origin")
    prefix = "/api/v1/group-preview/"
    if not parsed.path.startswith(prefix):
        raise ValueError("Preview request has the wrong path")
    root_text = parsed.path.removeprefix(prefix)
    if not root_text.isascii() or not root_text.isdigit() or int(root_text) < 1:
        raise ValueError("Invalid preview PGC")
    query = parse_qs(parsed.query, strict_parsing=True)
    if set(query) != {"definition", "variant"}:
        raise ValueError("Unexpected preview query parameters")
    definition, variant = query["definition"], query["variant"]
    if len(definition) != 1 or definition[0] not in ("physical", "suite"):
        raise ValueError("Invalid group definition")
    if len(variant) != 1 or variant[0] not in ("portrait", "hierarchy"):
        raise ValueError("Invalid preview variant")
    return int(root_text), definition[0], variant[0]


def _server_revision(base_url: str) -> int:
    url = base_url.rstrip("/") + "/api/v1/physical/refresh-status"
    with urlopen(url, timeout=30) as response:  # noqa: S310 - base URL is the configured internal LV service.
        payload = json.load(response)["data"]
    if not payload["ready"] or payload["expected_formula_version"] != FORMULA_VERSION:
        raise RuntimeError("LV API physical catalogue is not ready or has a different formula")
    revision = int(payload["applied_revision"])
    if revision != int(payload["source_revision"]):
        raise RuntimeError("LV API physical generation is inconsistent")
    return revision


def run_generation(
    database: storage.Storage,
    base_url: str,
    definition: str,
    variant: str,
    batch: str,
    catalogue_revision: int,
    expected_roots: set[int],
    launch: Callable[[], Any] | None = None,
) -> int:
    # Playwright is installed only in the isolated preview-worker image.
    if launch is None:
        launch = importlib.import_module("playwright.sync_api").sync_playwright
    saved = 0
    with launch() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 1000}, device_scale_factor=1)
        page.set_default_timeout(30000)

        def enable_private_capture(route: Any) -> None:
            response = route.fetch()
            if not response.ok:
                raise RuntimeError(f"Cache manifest HTTP {response.status}")
            payload = response.json()
            if int(payload["data"]["revision"]) != catalogue_revision:
                raise RuntimeError("The web UI reads a different physical generation")
            # Browser only: permit the existing builder button. The public
            # API remains read-only; PUT requests are intercepted below.
            payload["data"]["write_enabled"] = True
            route.fulfill(response=response, json=payload)

        def save_capture(route: Any) -> None:
            nonlocal saved
            request = route.request
            if request.method != "PUT":
                route.continue_()
                return
            try:
                pgc, requested_definition, requested_variant = capture_target(request.url, base_url)
                if (
                    requested_definition != definition
                    or (variant != "both" and requested_variant != variant)
                    or pgc not in expected_roots
                ):
                    raise ValueError("Captured group/variant falls outside requested scope")
                if request.headers.get("content-type") != "image/webp":
                    raise ValueError("Capture did not submit image/webp")
                if int(request.headers.get("x-lv-physical-revision", "-1")) != catalogue_revision:
                    raise ValueError("Capture used a different physical revision")
                image = request.post_data_buffer
                if not image:
                    raise ValueError("Capture image is empty")
                digest = group_previews.save_preview(
                    database, pgc, requested_definition, image, catalogue_revision, requested_variant
                )
                saved += 1
                print(f"SAVED {saved}: {definition}/{pgc}/{requested_variant} sha256={digest}", flush=True)
                route.fulfill(status=200, json={"sha256": digest})
            except Exception as error:  # noqa: BLE001 - fail closed and keep earlier successful images.
                route.fulfill(status=409, json={"detail": str(error)})
                print(f"FAILED: {request.url}: {error}", flush=True)

        page.route("**/api/v1/group-preview-cache*", enable_private_capture)
        page.route("**/api/v1/group-preview/*", save_capture)
        page.goto(base_url + "/groups/preview-builder", wait_until="domcontentloaded", timeout=60000)
        page.get_by_role("combobox", name="Preview definition").select_option(definition)
        page.get_by_role("combobox", name="Preview variants").select_option(variant)
        selection_type, selection_value = batch_selection(batch, len(expected_roots))
        batch_control = page.get_by_role("combobox", name="Number of groups")
        if selection_type == "label":
            batch_control.select_option(label=selection_value)
        else:
            batch_control.select_option(value=selection_value)
        page.get_by_role("button", name="Generate missing previews").click(timeout=60000)
        # The client advances sequentially, with a bounded capture retry policy.
        # A page timeout is a failure, not an indication that uploads succeeded.
        page.wait_for_function(
            """() => {
              const status = document.querySelector('.group-preview-builder > p[role="status"]');
              const text = status?.textContent ?? '';
              return /Stored \\d+ WebP images|All \\d+ groups have current/.test(text) ||
                     !!document.querySelector('.group-preview-builder p[role="alert"]:not(.catalog-status)');
            }""",
            timeout=3_600_000,
        )
        alerts = page.locator(".group-preview-builder p[role='alert']").all_text_contents()
        status_text = page.locator(".group-preview-builder > p[role='status']").first.text_content() or ""
        browser.close()
        if any("Rendering stopped" in item for item in alerts) or status_text.startswith("Cannot "):
            raise RuntimeError(f"Generation halted: {status_text}; {alerts}")
        print(status_text, flush=True)
    return saved


def main() -> int:
    parser = argparse.ArgumentParser(description="LV WebP group preview cache administration")
    parser.add_argument("--mode", choices=("audit", "generate"), default="audit")
    parser.add_argument("--definition", choices=("physical", "suite"), required=True)
    parser.add_argument("--variant", choices=("portrait", "hierarchy", "both"), default="portrait")
    parser.add_argument("--batch", choices=ALLOWED_BATCHES, default="1")
    args = parser.parse_args()
    base_url = os.environ.get("LV_PREVIEW_BASE_URL", "http://lv:8000").rstrip("/")
    if urlparse(base_url).scheme != "http" or urlparse(base_url).hostname not in (
        "lv",
        "localhost",
        "127.0.0.1",
    ):
        parser.error("LV_PREVIEW_BASE_URL must be an internal http://lv:8000 (or loopback) URL")
    database = storage.Storage(storage.StorageConfig())
    database.connect()
    try:
        revision = group_previews.current_revision(database)
        rows = groups.list_groups(database, args.definition)
        snapshot = group_previews.cache_manifest(database, args.definition)
        groups_count, expected, missing = cache_counts(
            rows, cast(list[dict[str, object]], snapshot["entries"]), args.variant
        )
        print(
            f"{args.definition}: {groups_count} groups; {expected} {args.variant} images; "
            f"{expected - missing} current, {missing} missing/stale; revision={revision}",
            flush=True,
        )
        api_revision = _server_revision(base_url)
        if api_revision != revision:
            raise RuntimeError(f"API generation={api_revision} differs from PostgreSQL={revision}")
        if args.mode == "audit":
            return 0
        roots = {int(item["root_pgc"]) for item in rows}
        saved = run_generation(database, base_url, args.definition, args.variant, args.batch, revision, roots)
        updated = group_previews.cache_manifest(database, args.definition)
        _, _, remaining = cache_counts(rows, cast(list[dict[str, object]], updated["entries"]), args.variant)
        print(f"Completed: {saved} saved, {remaining} remaining for {args.definition}/{args.variant}")
        return 0
    finally:
        database.close()


if __name__ == "__main__":
    raise SystemExit(main())
