import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../src/styles/groups.css", import.meta.url),
  "utf8",
);

const geometry = css.match(/\.group-overview-layout\s*\{[^}]*\}/g) ?? [];

// Protect the design contract without assuming viewport width === workspace width.
describe("#70: group page geometry", () => {
  test("is container-responsive and retains scientific minimum widths", () => {
    expect(css).toContain(".groups-layout.group-details {");
    expect(css).toContain("container-name: group-detail;");
    expect(css).toContain("max-width: 1740px;");
    expect(css).toContain("@container group-detail (max-width: 1060px)");
    expect(css).toContain("minmax(400px, 1fr)");
    expect(css).toContain("min(50%, var(--group-map-max-size, 800px))");
    expect(css).toContain("gap: var(--layout-column-gap, 24px)");
    expect(css).toContain("group-map-max-size, 800px");
  });

  test("has only one two-column definition and one stacked container override", () => {
    expect(geometry).toHaveLength(2);
    expect(css).not.toContain("minmax(0, 820px)");
    expect(css).not.toContain("minmax(285px, 1fr)");
    expect(css).not.toContain("minmax(270px, 1fr)");
    expect(css).not.toMatch(/\.group-map-panel\s*\{\s*max-width:\s*850px;/);
  });

  test("keeps the group sky map bounded and square", () => {
    expect(css).toContain("max-width: var(--group-map-max-size, 800px)");
    expect(css).toMatch(/\.group-map-panel\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/s);
    expect(css).toContain(".group-sky-map.aladin-frame");
    expect(css).toContain(".group-parameters-matrix");
  });
});
