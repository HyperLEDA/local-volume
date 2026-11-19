import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import {
  CatalogHeader,
  resolveHeaderContext,
} from "../src/components/CatalogHeader.tsx";
import { ExternalCatalogLinks } from "../src/components/ExternalCatalogLinks.tsx";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function renderHeader(route: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <CatalogHeader />
    </MemoryRouter>,
  );
}

describe("contextual navigation in the single-row shared header", () => {
  test("keeps the same four sections on galaxy, group and reference pages", () => {
    for (const route of [
      "/",
      "/object/29146",
      "/groups",
      "/groups/29146?definition=suite",
      "/documents",
    ]) {
      const html = renderHeader(route);
      expect(html).toContain("catalog-header--unified");
      expect(html).toContain('aria-label="Main sections"');
      expect(html).toContain('aria-label="Reference sections"');
    }
  });

  test("places context in the left/right header clusters, not a second row", () => {
    const header = source("../src/components/CatalogHeader.tsx");
    const object = source("../src/pages/ObjectPage.tsx");
    const group = source("../src/pages/GroupPage.tsx");
    const css = source("../src/components/scientificNavigation.css");
    expect(header).toContain(
      'className="catalog-header-edge catalog-header-edge--left"',
    );
    expect(header).toContain(
      'className="catalog-header-edge catalog-header-edge--right"',
    );
    expect(header).toContain('className="catalog-header-context-steps"');
    expect(header).not.toContain("<ObjectCollectionNavigation");
    expect(object).not.toContain("<ObjectCollectionNavigation");
    expect(group).toContain("saveGroupNavigation");
    expect(css).toContain(
      "/* #52: one-row contextual navigation for object and group pages.",
    );
    expect(css).toContain(
      ".catalog-header--contextual .catalog-header-quicknav",
    );
  });

  test("direct group URLs have a safe Back to Groups with their definition", () => {
    expect(
      resolveHeaderContext("/groups/29146", "?definition=suite")?.backHref,
    ).toBe("/groups?definition=suite");
    expect(
      resolveHeaderContext("/groups/29146", "?definition=suite")?.previousHref,
    ).toBeNull();
    expect(renderHeader("/groups/29146?definition=suite")).toContain(
      "Back to Groups",
    );
    expect(resolveHeaderContext("/object/29146", "")).toBeNull();
  });

  test("keeps external catalogue links without the discarded disclaimer", () => {
    const html = renderToStaticMarkup(<ExternalCatalogLinks pgc={29146} />);
    for (const catalog of ["LEDA", "NED", "SIMBAD"])
      expect(html).toContain(catalog);
    expect(html).not.toContain(
      "Identifier searches; cross-identifications are not verified here.",
    );
    expect(html).toContain('rel="noopener noreferrer"');
  });
});
