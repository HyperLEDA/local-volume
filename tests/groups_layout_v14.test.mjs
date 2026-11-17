import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const params = readFileSync("frontend/src/components/GroupParameters.tsx", "utf8");
const css = readFileSync("frontend/src/styles/groups.css", "utf8");
const figs = readFileSync("frontend/src/components/GroupFigures.tsx", "utf8");
const jpeg = readFileSync("frontend/src/lib/groupFigureJpeg.ts", "utf8");

const source = params.split("  const rows: Cell[][] = [")[1]?.split("  ];\n  return (")[0] ?? "";
const rowKeys = source.split(/^    \],$/m).map(row => [...row.matchAll(/cell\("([^\"]+)"/g)].map(m => m[1])).filter(x => x.length);

test("six exact rows with requested variable column counts and no unavailable footer", () => {
  expect(rowKeys).toEqual([
    ["md", "n", "nested"],
    ["nv", "nd"],
    ["dmean", "vmean", "sigma"],
    ["rmax", "rmean", "r50", "crossing"],
    ["morb", "lk", "mhi"],
    ["gap", "fearly"],
  ]);
  expect(params).toContain("colSpan={12 / fields.length}");
  expect(params).not.toContain('cell("mstar"');
  expect(params).not.toContain('cell("ratio"');
  expect(params).not.toContain('cell("r0"');
  expect(css).toContain("width: auto; /* v11 fixed 33.333%");
});

test("scientific subscripts rendered as actual HTML and canvas baseline shifts", () => {
  expect(params).toContain("V<sub>LG</sub>");
  expect(params).toContain("M<sub>HI,det</sub>");
  expect(params).toContain("f<sub>T≤2</sub>");
  expect(figs).toContain("scientificText(figure.title)");
  // Subtitles belong to scientific provenance, not the visual heading.
  expect(figs).not.toContain("scientificText(figure.subtitle)");
  expect(figs).toContain("scientificText(expandedFigure?.title");
  expect(jpeg).toContain("function drawScientificAxisLabel");
  expect(jpeg).toContain("drawScientificAxisLabel(ctx, plot.xLabel");
  expect(jpeg).toContain("drawScientificAxisLabel(ctx, plot.yLabel");
  expect(css).toContain("/* v14: scientific group matrix and true subscripts. */");
});
