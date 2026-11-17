import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

test("source JPEG is 16:9 and figure modal is viewport limited", () => {
  const renderer = readFileSync("frontend/src/lib/groupFigureJpeg.ts", "utf8");
  const css = readFileSync("frontend/src/styles/groups.css", "utf8");
  expect(renderer).toContain("const W = 1600;");
  expect(renderer).toContain("const H = 900;");
  expect(css).toContain("/* v13: wide figure previews and bounded image dialog. */");
  expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  expect(css).toContain("max-height: min(58vh, 540px)");
});

test("uncertainties are displayed in observed, not physical, parameter matrix", () => {
  const observed = readFileSync("frontend/src/components/ObservedParameterCards.tsx", "utf8");
  const physical = readFileSync("frontend/src/components/PhysicalParametersTable.tsx", "utf8");
  expect(observed).toContain("observedUncertainty(row, physical)");
  expect(observed).toContain('observed-error-stack"');
  expect(physical).not.toContain('key: "adopted-kinematics-and-distance"');
});
