import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CatalogHeader } from "../src/components/CatalogHeader.tsx";
import {
  CatalogSidebar,
  parseSavedTheme,
} from "../src/components/CatalogSidebar.tsx";

function renderNavigation(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <CatalogSidebar />
    </MemoryRouter>,
  );
}

describe("fixed navigation rail", () => {
  test("offers Atlas and Publications as accessible icon-only links", () => {
    const html = renderNavigation("/");
    expect(html.match(/href="\/"/g)).toHaveLength(1);
    expect(html.match(/href="\/publications"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Atlas"');
    expect(html).toContain('aria-label="Publications"');
    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('aria-label="Secondary navigation"');
    expect(html).toContain("catalog-nav--footer");
    expect(html).not.toContain("catalog-mobile-menu");
  });

  test("treats object details as part of the Atlas", () => {
    const html = renderNavigation("/object/29146");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<a\b(?=[^>]*href="\/")(?=[^>]*aria-current="page")[^>]*>/,
    );
  });

  test("marks Publications as current on its page", () => {
    const html = renderNavigation("/publications");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<a\b(?=[^>]*href="\/publications")(?=[^>]*aria-current="page")[^>]*>/,
    );
  });

  test("provides a keyboard-accessible theme button and tooltips", () => {
    const html = renderNavigation("/");
    expect(html).toContain('aria-label="Switch to dark theme"');
    expect(html).toContain('aria-pressed="false"');
    expect(html.match(/class="catalog-nav-tooltip"/g)).toHaveLength(3);
  });

  test("defaults to light and recognizes a saved dark preference", () => {
    expect(parseSavedTheme(null)).toBe("light");
    expect(parseSavedTheme("system")).toBe("light");
    expect(parseSavedTheme("dark")).toBe("dark");
  });

  test("places the official LEDA logo to the right of the title", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CatalogHeader />
      </MemoryRouter>,
    );
    const sao = html.indexOf('class="catalog-logo catalog-logo--sao"');
    const title = html.indexOf("<h1>");
    const leda = html.indexOf('class="catalog-logo catalog-logo--leda"');
    expect(sao).toBeGreaterThan(-1);
    expect(sao).toBeLessThan(title);
    expect(leda).toBeGreaterThan(title);
    expect(html).toContain('href="https://leda.sao.ru/"');
  });
});
