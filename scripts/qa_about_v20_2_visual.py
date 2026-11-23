#!/usr/bin/env python3
"""Read-only browser audit of the actual About v20.2, including layout and M104.

The read-only LV LEDA server must already be serving the rebuilt frontend at
http://127.0.0.1:8000. Images are saved in .about-qa-v20-2 in this worktree.
No database or repository writes except screenshots in that QA directory.
"""

# Visual QA dependencies are installed separately from the base environment.
# pyright: reportMissingImports=false

from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".about-qa-v20-2"
URL = "http://127.0.0.1:8000/about"
WIDTHS = (1440, 1024, 768, 390)


def inspect(page, width):
    page.goto(URL, wait_until="domcontentloaded", timeout=30_000)
    root = page.locator(".about-v21")
    root.wait_for(state="visible", timeout=20_000)
    page.locator(".about-v21 .about-v6-hero-observation img").wait_for(state="visible")
    title = page.locator(".about-v21 h1").inner_text()
    if "LV LEDA" not in title:
        raise RuntimeError(f"{width}px: project heading missing")
    body = root.inner_text()
    for banned in ("Galaxies, measurements, environments", "RESOLVED LABORATORY", "SAO RAS · HYPERLEDA", "Messier 81"):
        if banned in body:
            raise RuntimeError(f"{width}px: retired page wording remains: {banned}")
    if "Messier 104" not in body or "Catalogue coverage" not in body:
        raise RuntimeError(f"{width}px: science case or catalogue fact missing")
    image = page.locator(".about-v21 .about-v6-hero-observation")
    square = image.bounding_box()
    if square is None or square["height"] <= 0 or abs(square["width"] - square["height"]) > 4:
        raise RuntimeError(f"{width}px: M104 image not square: {square}")
    metrics = page.evaluate("""() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      page: document.querySelector('.about-v21')?.getBoundingClientRect().width ?? 0
    })""")
    if metrics["document"] > metrics["viewport"] + 4:
        raise RuntimeError(f"{width}px: horizontal document overflow: {metrics}")
    if width >= 1024:
        for selector in (
            ".about-v6-object-section .about-v6-section-heading",
            ".about-v6-catalogue-section .about-v6-section-heading",
            ".about-v14-heritage-heading",
            ".about-v11-focus-header",
            ".about-v10-impact-heading",
            ".about-v11-future-heading",
        ):
            box = page.locator(selector)
            box.scroll_into_view_if_needed()
            result = box.evaluate("""el => {
              const h = el.querySelector('h2'); const p = el.querySelector('p');
              return h && p ? {headingTop:h.getBoundingClientRect().top,
                paragraphTop:p.getBoundingClientRect().top} : null;
            }""")
            if result and abs(result["headingTop"] - result["paragraphTop"]) > 65:
                raise RuntimeError(f"{width}px: detached heading and paragraph in {selector}: {result}")
    page.locator(".about-v21 .about-v6-hero").scroll_into_view_if_needed()
    page.screenshot(path=str(OUTPUT / f"about-v20-2-{width}.png"), full_page=True, animations="disabled")
    print(f"PASS width={width}, M104 panel={square['width']:.0f}×{square['height']:.0f}, overflow=0")


def main():
    OUTPUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            for width in WIDTHS:
                page = browser.new_page(
                    viewport={"width": width, "height": 900}, device_scale_factor=2, reduced_motion="reduce"
                )
                inspect(page, width)
                page.close()
        finally:
            browser.close()
    print("Screenshots:", OUTPUT)


if __name__ == "__main__":
    main()
