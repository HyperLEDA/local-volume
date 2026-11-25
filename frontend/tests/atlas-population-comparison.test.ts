import { describe, expect, test } from "bun:test";
import { populationMembership } from "../src/lib/atlasPopulation.ts";
import {
  comparePopulations,
  comparisonMatch,
  decodeComparison,
  defaultComparison,
  COMPARISON_COLORS,
} from "../src/lib/atlasPopulationComparison.ts";
import { decodeAtlasPreferences } from "../src/lib/atlasSession.ts";
const membership = populationMembership({
  catalogue_pgcs: [1, 2, 3, 4],
  groups: [{ root_pgc: 1, member_pgcs: [1, 2] }],
});
const points = [
  { object: { pgc: 1, abs_b_mag: -17, theta1: 1 } },
  { object: { pgc: 2, abs_b_mag: -20, theta1: -1 } },
  { object: { pgc: 3, abs_b_mag: -14, theta1: -1 } },
  { object: { pgc: 4, abs_b_mag: -20, theta1: 0 } },
  { object: { pgc: 5, abs_b_mag: null, theta1: -1 } },
];
describe("Population comparison", () => {
  test("exclusive classes, overlap, unknown and unique identities", () => {
    const result = comparePopulations(
      [...points, points[2]],
      membership,
      defaultComparison(),
    );
    expect(result.counts).toEqual({
      aOnly: 1,
      bOnly: 1,
      both: 1,
      neither: 1,
      unknown: 1,
    });
    expect(result.colors.get(3)).toBe(COMPARISON_COLORS.both);
    expect(result.classes.size).toBe(5);
  });
  test("unknowns are propagated only when logically necessary", () => {
    const object = points[4].object;
    expect(
      comparisonMatch(object, membership, {
        ids: ["dwarf", "negativeTheta"],
        mode: "any",
      }),
    ).toBe(true);
    expect(
      comparisonMatch(object, membership, {
        ids: ["dwarf", "negativeTheta"],
        mode: "all",
      }),
    ).toBeNull();
    expect(
      comparisonMatch(object, membership, {
        ids: ["dwarf", "late"],
        mode: "any",
      }),
    ).toBeNull();
    expect(
      comparisonMatch(points[3].object, membership, {
        ids: ["late", "negativeTheta"],
        mode: "all",
      }),
    ).toBe(false);
  });
  test("uncovered membership is unknown, covered field is a valid classification", () => {
    expect(
      comparisonMatch(points[4].object, membership, {
        ids: ["field"],
        mode: "any",
      }),
    ).toBeNull();
    expect(
      comparisonMatch(points[3].object, membership, {
        ids: ["field"],
        mode: "any",
      }),
    ).toBe(true);
    expect(
      comparisonMatch(points[0].object, membership, {
        ids: ["field"],
        mode: "any",
      }),
    ).toBe(false);
  });
  test("empty comparison side is unconfigured, not the whole sample", () => {
    expect(
      comparisonMatch(points[0].object, membership, { ids: [], mode: "any" }),
    ).toBeNull();
  });
  test("comparison does not mutate or filter input", () => {
    const original = JSON.stringify(points);
    comparePopulations(points, membership, defaultComparison());
    expect(JSON.stringify(points)).toBe(original);
  });
  test("session validation and reset", () => {
    const comparison = defaultComparison();
    expect(
      decodeComparison({
        a: comparison.a,
        b: { ids: ["invalid"], mode: "any" },
      }),
    ).toBeNull();
    expect(decodeComparison(comparison)).toEqual(comparison);
    expect(
      decodeAtlasPreferences(
        { displayMode: "galaxies", comparison },
        new Set(),
        "dark",
      ).comparison,
    ).toEqual(comparison);
    expect(
      decodeAtlasPreferences(
        { displayMode: "groups", comparison },
        new Set(),
        "dark",
      ).comparison,
    ).toBeNull();
    expect(
      decodeAtlasPreferences(null, new Set(), "dark").comparison,
    ).toBeNull();
  });
});
