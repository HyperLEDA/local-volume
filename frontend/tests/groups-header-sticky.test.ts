import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const baseCss = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8",
);
const groupsCss = readFileSync(
  new URL("../src/styles/groups.css", import.meta.url),
  "utf8",
);

describe("shared sticky site header on Groups routes", () => {
  test("global header retains its sticky position and top anchor", () => {
    expect(baseCss).toMatch(/\.catalog-header\s*\{[^}]*position:\s*sticky\s*;/);
    expect(baseCss).toMatch(/\.catalog-header\s*\{[^}]*top:\s*0\s*;/);
  });

  test("Groups CSS does not turn the group detail header relative", () => {
    const groupHeaderRules = [
      ...groupsCss.matchAll(/\.catalog-header--group\s*\{([^}]*)\}/g),
    ];
    expect(groupHeaderRules.length).toBeGreaterThan(0);
    expect(
      groupHeaderRules.every(
        ([, declarations]) => !/\bposition\s*:/.test(declarations),
      ),
    ).toBe(true);
    expect(groupsCss).toMatch(
      /\.catalog-header--group \.catalog-header-back\s*\{[^}]*position:\s*absolute\s*;/,
    );
  });
});
