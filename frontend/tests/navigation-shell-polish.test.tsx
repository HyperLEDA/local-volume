import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CatalogHeader } from "../src/components/CatalogHeader.tsx";
import { CatalogSidebar } from "../src/components/CatalogSidebar.tsx";

function markup(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <CatalogHeader />
    </MemoryRouter>,
  );
}

function activeLink(html: string, destination: string): boolean {
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  return anchors.some(
    (tag) =>
      tag.includes(`href="${destination}"`) &&
      tag.includes('aria-current="page"'),
  );
}

describe("shared section navigation and sidebar polish", () => {
  test("all four header destinations appear on every implemented page", () => {
    for (const path of [
      "/",
      "/object/29146",
      "/groups",
      "/groups/29146?definition=suite",
      "/documents",
      "/acknowledgements",
      "/publications",
    ]) {
      const html = markup(path);
      expect(html).toContain('aria-label="Main sections"');
      expect(html).toContain('aria-label="Reference sections"');
      expect(html).toContain('href="/groups"');
      expect(html).toContain('href="/documents"');
      expect(html).toContain('href="/acknowledgements"');
      expect(html).toContain('class="catalog-header-identity"');
    }
  });

  test("the current scientific section is indicated by aria-current", () => {
    for (const path of ["/", "/object/29146"])
      expect(activeLink(markup(path), "/")).toBe(true);
    for (const path of ["/groups", "/groups/29146"])
      expect(activeLink(markup(path), "/groups")).toBe(true);
    expect(activeLink(markup("/documents"), "/documents")).toBe(true);
    expect(activeLink(markup("/acknowledgements"), "/acknowledgements")).toBe(
      true,
    );
    expect(
      markup("/publications").match(/aria-current="page"/g) ?? [],
    ).toHaveLength(0);
  });

  test("flyout constrains horizontal overflow and respects reduced motion", () => {
    const css = readFileSync(
      new URL("../src/components/scientificNavigation.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("scrollbar-width: thin");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("aria-current");
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CatalogSidebar />
      </MemoryRouter>,
    );
    expect(html).toContain("M81/M82: NASA/ESA/Z. Levay/R. Gendler");
    expect(html.indexOf("Images:")).toBeLessThan(
      html.indexOf('aria-label="Resources"'),
    );
  });
});
