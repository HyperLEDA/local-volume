import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../src/components/physicalParameters.css", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/pages/ObjectPage.tsx", import.meta.url),
  "utf8",
);

describe("#70: Galaxy Page geometry: balanced map and legible scientific data", () => {
  test("prefers 56% map width but caps it at 670px to balance map and table space", () => {
    expect(css).toContain("--galaxy-workspace-max-width: 1740px;");
    expect(css).toContain("grid-template-columns: minmax(0, min(56%, 670px)) minmax(0, 1fr);");
    expect(css).toContain("max-width: 670px;");
    expect(css).not.toContain("max-width: 1900px");
    expect(css).not.toContain("min(45%, 700px)");
    expect(css).not.toContain("min(44%, var(--galaxy-map-max-size, 620px))");
  });

  test("uses the wider galaxy-only workspace while leaving the map cap unchanged", () => {
    const workspace = css.match(
      /body:has\(\.catalog--object\) \.app-workspace \{([^}]+)\}/,
    )?.[1];
    const page = css.match(/\.catalog\.catalog--object \{([^}]+)\}/)?.[1];
    expect(workspace).toContain("--galaxy-workspace-max-width: 1740px;");
    expect(workspace).toContain("max-width: var(--galaxy-workspace-max-width);");
    expect(page).toContain("max-width: var(--galaxy-workspace-max-width, 1740px);");
    expect(css).toContain("grid-template-columns: minmax(0, min(56%, 670px)) minmax(0, 1fr);");
    expect(css).toContain("max-width: 670px;");
  });

  test("stacking the map responds to page container width rather than viewport", () => {
    expect(css).toContain("@container galaxy-page (max-width: 880px)");
    expect(css).not.toContain("@container galaxy-page (max-width: 680px)");
    expect(css).toContain(".catalog--object .object-layout--no-map");
  });

  test("scientific tables require at least 352px per column, without implicit grid columns", () => {
    expect(css).toContain("repeat(auto-fit, minmax(min(100%, 352px), 1fr))");
    expect(css).toContain("grid-column: auto;");
    expect(css).not.toContain('grid-column: 2;\n  justify-self: start;');
    expect(css).not.toContain("@container galaxy-page (max-width: 1050px)");
  });

  test("coordinates use three horizontal systems with two full-precision values each", () => {
    expect(css).not.toContain("width: 404px");
    expect(css).toContain("grid-template-columns: minmax(360px, 2.3fr)");
    expect(css).toContain("@container galaxy-details (max-width: 520px)");
    expect(css).toContain(".coordinate-equatorial-table");
    expect(css).toContain("border-left: 1px solid var(--line);");
    expect(css).toContain("font-size: 0.95rem;");
    expect(page).toContain("<ObjectCoordinates object={data} />");
  });

  test("places ICRS values to the right of its heading on wide panels", () => {
    const icrs = css.match(
      /\.coordinate-system:first-child \{([^}]+)\}/,
    )?.[1];
    expect(icrs).toContain("display: grid;");
    expect(icrs).toContain("grid-template-columns: max-content minmax(0, 1fr);");
    expect(css).toContain(".coordinate-system:first-child > .coordinate-equatorial-table");
    expect(css).toContain("@container galaxy-details (max-width: 520px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  test("keeps raw astronomical values, map FoV and both property components unchanged", () => {
    // The page uses a validated FoV decision (and documented fallbacks),
    // not the older direct helper call. Exact a26 is tested in object-fov.test.ts.
    expect(page).toContain("const initialFov = data === null ? null : objectFovDecision(data);");
    expect(page).toContain("fov={initialFov?.degrees}");
    expect(page).toContain("<ObservedParameterCards rows={rows} pgc={pgc} />");
    expect(page).toContain("<PhysicalParametersTable pgc={pgc} />");
    expect(css).toContain("overflow-wrap: anywhere");
  });
});
