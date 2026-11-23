import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CatalogHeader } from "../src/components/CatalogHeader.tsx";

function render(route: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[route]}>
      <CatalogHeader />
    </MemoryRouter>,
  );
}

describe("Issue #85 — centered header identity", () => {
  test("LV LEDA title and subtitle open About from every route", () => {
    for (const route of [
      "/",
      "/about",
      "/object/28630",
      "/groups",
      "/documents",
    ]) {
      const html = render(route);
      expect(html).toMatch(
        /<a\b(?=[^>]*href="\/about")(?=[^>]*aria-label="About LV LEDA")[^>]*>/,
      );
      expect(html).toContain("Galaxies of the Nearby Universe");
      expect(html).toContain('href="/"'); // Atlas retains its own shortcut.
    }
  });
});
