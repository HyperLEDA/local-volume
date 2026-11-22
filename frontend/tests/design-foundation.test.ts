import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Design System v2.0 foundation", () => {
  const css = source("../src/index.css");
  const entry = source("../src/main.tsx");

  test("declares Observatory Graphite dark/light tokens and legacy aliases", () => {
    expect(css).toContain("--ui-canvas: #101820");
    expect(css).toContain("--ui-canvas: #f2f5f5");
    expect(css).toContain("--ui-accent: #82c4cb");
    expect(css).toContain("--ui-accent: #1b6572");
    expect(css).toContain(":root[data-theme=\"light\"]");
    expect(css).toContain("--card: var(--ui-surface)");
    expect(css).toContain("--line: var(--ui-border)");
    expect(css).toContain("--layout-sidebar-width: 52px");
  });

  test("removes the dotted background instead of hiding it with an overlay", () => {
    expect(css).toContain("background-image: none;");
    expect(css).not.toContain("background-image: radial-gradient(");
    expect(css).not.toContain("--grid-dots:");
  });

  test("bundles all four approved font families locally", () => {
    expect(entry).toContain('import "@fontsource-variable/source-sans-3"');
    expect(entry).toContain('import "@fontsource-variable/source-serif-4"');
    expect(entry).toContain('import "@fontsource/source-code-pro/400.css"');
    expect(entry).toContain('import "@fontsource/stix-two-math/400.css"');
    expect(css).toContain("Source Sans 3 Variable");
    expect(css).toContain("Source Serif 4 Variable");
  });

  test("preserves separate scientific colours and source measurement algorithms", () => {
    const morphology = source("../src/lib/morphologyColors.ts");
    for (const hex of ["#C96D76", "#D99EA4", "#A995A6", "#91A8C6", "#6489BC", "#3F6FAB", "#9AA2AC"])
      expect(morphology.toLowerCase()).toContain(hex.toLowerCase());
  });
});
