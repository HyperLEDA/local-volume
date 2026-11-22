import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CatalogObjectDetail } from "../src/api/objects.ts";
import { ObjectCoordinates } from "../src/components/ObjectCoordinates.tsx";
import { formatDegrees } from "../src/lib/coordinates.ts";

const galaxy = {
  ra: 12.345678,
  dec: -20.123456,
} as CatalogObjectDetail;

describe("#70: coordinate triptych uses existing scientific formatters", () => {
  const html = renderToStaticMarkup(<ObjectCoordinates object={galaxy} />);

  test("preserves three coordinate systems in the requested order", () => {
    const headings = [...html.matchAll(/<h4>(.*?)<\/h4>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    );
    expect(headings).toEqual([
      "Equatorial ICRS",
      "Galactic",
      "Supergalactic",
    ]);
  });

  test("shows two coordinate rows per system, with both ICRS representations", () => {
    expect((html.match(/class="coordinate-value"/g) ?? []).length).toBe(4);
    expect(html).toContain('class="coordinate-equatorial-table"');
    expect(html).toContain('<th scope="col">Sexagesimal</th>');
    expect(html).toContain('<th scope="col">Degrees</th>');
    expect(html).toContain('<th scope="row">α</th>');
    expect(html).toContain('<th scope="row">δ</th>');
    for (const label of ["l", "b", "SGL", "SGB"])
      expect(html).toContain(`>${label}</span>`);
    // The ICRS decimal values still use the canonical six-decimal formatters.
    expect(html).toContain(formatDegrees(galaxy.ra));
    expect(html).toContain(formatDegrees(galaxy.dec, 6, true));
  });
});
