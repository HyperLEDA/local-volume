import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CatalogSidebar } from "../src/components/CatalogSidebar.tsx";
import { CatalogHeader } from "../src/components/CatalogHeader.tsx";
import { DocumentsPage } from "../src/pages/DocumentsPage.tsx";

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("navigation and scientific documents", () => {
  test("Documents is distinct from Publications and Acknowledgements", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/documents"]}>
        <CatalogSidebar />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="Documents"');
    expect(html).toContain('href="/documents"');
    expect(html).toMatch(
      /<a\b(?=[^>]*href="\/documents")(?=[^>]*aria-current="page")[^>]*>/,
    );
    expect(html).toContain('href="/publications"');
    expect(html).toContain('href="/acknowledgements"');
    expect(html).toContain('id="scientific-sidebar-flyout"');
  });
  test("Documents has a stable section and does not assert a new LV LEDA DOI", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    );
    expect(html).toContain("How to cite LV LEDA");
    expect(html).toContain("Updated Nearby Galaxy Catalog");
    expect(html).toContain('href="/publications"');
    expect(html).toContain("@misc{LVLEDAOnline2026,");
    expect(html).toContain("Accessed 2026-11-20 (UTC)");
    expect(html).not.toContain("doi.org/10.0000");
  });
  test("Atlas header places two shortcuts to each side of the centered identity", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/"]}>
        <CatalogHeader />
      </MemoryRouter>,
    );
    const left = html.match(
      /<nav\b[^>]*catalog-header-quicknav--left[^>]*>(.*?)<\/nav>/,
    )?.[1];
    const right = html.match(
      /<nav\b[^>]*catalog-header-quicknav--right[^>]*>(.*?)<\/nav>/,
    )?.[1];
    expect(left).toContain('href="/"');
    expect(left).toContain('href="/groups"');
    expect(right).toContain('href="/documents"');
    expect(right).toContain('href="/acknowledgements"');
    expect(html).toContain('class="catalog-header-identity"');
  });
  test("Image attribution stands immediately above bottom-aligned resources", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/"]}>
        <CatalogSidebar />
      </MemoryRouter>,
    );
    const panel = html.slice(html.indexOf('id="scientific-sidebar-flyout"'));
    expect(panel).toContain("Images:");
    expect(panel).toContain("M81 (HST): NASA/ESA/STScI");
    expect(panel).toContain("M81/M82: NASA/ESA/Z. Levay/R. Gendler");
    expect(panel.indexOf("Images:")).toBeLessThan(
      panel.indexOf('aria-label="Resources"'),
    );
    const styles = read("../src/components/scientificNavigation.css");
    expect(styles).toContain("margin-top: auto");
    expect(styles).toContain(
      "grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)",
    );
  });
  test("header navigation never links to fictitious Analysis or Galaxies pages", () => {
    const header = read("../src/components/CatalogHeader.tsx");
    expect(header).toContain("catalog-header-quicknav");
    expect(header).toContain('to="/documents"');
    expect(header).not.toContain('to="/analysis"');
    expect(header).not.toContain('to="/galaxies"');
  });
  test("sidebar overlay is a fixed layer and mobile has a separate navigation mode", () => {
    const styles = read("../src/components/scientificNavigation.css");
    expect(styles).toContain("position: fixed");
    expect(styles).toContain("width: 52px");
    expect(styles).toContain("width: 228px");
    expect(styles).toContain("prefers-reduced-motion");
    expect(styles).toContain("scientific-mobile-more");
  });
  test("Aladin popup navigation passes filtered selection context only for listed objects", () => {
    const aladin = read("../src/components/AladinMap.tsx");
    const atlas = read("../src/pages/ObjectsPage.tsx");
    expect(aladin).toContain("onObjectNavigate?.(destinationPgc)");
    expect(atlas).toContain("gridObjects.some((row) => row.pgc === pgc)");
    expect(atlas).toContain("saveAtlasNavigation();");
  });
});
