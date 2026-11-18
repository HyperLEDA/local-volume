import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

describe("issue #49: object layout contracts", () => {
  test("object page uses its container width for the mobile transition", () => {
    expect(css).toContain("container-type: inline-size;");
    expect(css).toMatch(/@container galaxy-page \(max-width: 680px\)/);
    expect(css).not.toMatch(/@media \(max-width: 1200px\) \{\s*\.object-layout/);
  });

  test("Aladin keeps a square box and parameter tables stay scrollable", () => {
    expect(css).toMatch(/\.catalog--object \.aladin-frame \{[^}]*aspect-ratio: 1 \/ 1;/s);
    expect(css).toMatch(/\.object-details > \.object-params \{[^}]*overflow-x: auto;/s);
  });
});

// Regression: the secondary stylesheet must not override laptop grid sizing.
test("issue #49: no 1590px forced mobile layout", () => {
  const physicalCss = readFileSync(
    new URL("../src/components/physicalParameters.css", import.meta.url),
    "utf8",
  );
  expect(physicalCss).not.toContain("@media (max-width: 1590px)");
  expect(physicalCss).not.toContain("714px max-content");
  expect(physicalCss).toContain("@container galaxy-page (max-width: 1050px)");
});
