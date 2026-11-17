import { describe, expect, test } from "bun:test";
import { needsInitialFovCorrection, objectFovDegrees } from "../src/lib/objectFov.ts";

describe("objectFovDegrees", () => {
  test("converts Holmberg angular diameter in arcminutes into the map field", () => {
    expect(objectFovDegrees({ a26_arcmin: 4 })).toBeCloseTo(0.1, 10);
    expect(objectFovDegrees({ a26_arcmin: 20 })).toBeCloseTo(0.5, 10);
  });

  test("ignores the legacy a50 and b50 semi-axes", () => {
    const withLegacyAxes = { a26_arcmin: 8, a50: 2000, b50: 1000 };
    expect(objectFovDegrees(withLegacyAxes)).toBeCloseTo(0.2, 10);
  });

  test("uses a one-degree fallback if the adopted diameter is unavailable", () => {
    for (const diameter of [null, undefined, 0, NaN, Infinity, -20]) {
      expect(objectFovDegrees({ a26_arcmin: diameter })).toBe(1);
    }
  });

  test("respects the field limits for very small and very large galaxies", () => {
    expect(objectFovDegrees({ a26_arcmin: 0.1 })).toBe(0.025);
    expect(objectFovDegrees({ a26_arcmin: 10_000 })).toBe(60);
  });
});

describe("needsInitialFovCorrection", () => {
  test("corrects a view that Aladin initialized much narrower than the requested field", () => {
    const requested = objectFovDegrees({ a26_arcmin: 5.4707377778 });
    expect(requested * 60).toBeCloseTo(8.2061066667, 6);
    expect(needsInitialFovCorrection(1.986 / 60, requested)).toBe(true);
  });
  test("does not modify an already correct field", () => {
    expect(needsInitialFovCorrection(0.135, 0.136)).toBe(false);
    expect(needsInitialFovCorrection(0.136, 0.136)).toBe(false);
  });
  test("rejects nonfinite or nonpositive measurements", () => {
    expect(needsInitialFovCorrection(NaN, 0.1)).toBe(false);
    expect(needsInitialFovCorrection(0, 0.1)).toBe(false);
    expect(needsInitialFovCorrection(0.1, Infinity)).toBe(false);
    expect(needsInitialFovCorrection(0.1, 0)).toBe(false);
  });
});
