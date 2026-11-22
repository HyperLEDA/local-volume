import { describe, expect, test } from "bun:test";
import {
  needsInitialFovCorrection,
  objectFovDecision,
  objectFovDegrees,
} from "../src/lib/objectFov.ts";

describe("objectFovDegrees", () => {
  test("uses precisely the adopted a26 diameter as BOTH square field sides", () => {
    expect(objectFovDegrees({ a26_arcmin: 4 })).toBeCloseTo(4 / 60, 10);
    expect(objectFovDegrees({ a26_arcmin: 20 })).toBeCloseTo(20 / 60, 10);
    expect(objectFovDegrees({ a26_arcmin: 19.5 })).toBeCloseTo(0.325, 10);
  });

  test("ignores the legacy a50/b50 axes and allows small galaxies", () => {
    const withLegacyAxes = { a26_arcmin: 8, a50: 2000, b50: 1000 };
    expect(objectFovDegrees(withLegacyAxes)).toBeCloseTo(8 / 60, 10);
    expect(objectFovDegrees({ a26_arcmin: 0.1 })).toBeCloseTo(0.1 / 60, 10);
    expect(objectFovDecision({ a26_arcmin: 0.1 }).exactA26).toBe(true);
  });

  test("documents missing/invalid values and exceptional guard limits", () => {
    for (const diameter of [null, undefined, 0, NaN, Infinity, -20]) {
      const result = objectFovDecision({ a26_arcmin: diameter });
      expect(result.degrees).toBe(1);
      expect(result.exactA26).toBe(false);
      expect(result.note).toContain("unavailable");
    }
    expect(objectFovDecision({ a26_arcmin: 0.0001 }).exactA26).toBe(false);
    expect(objectFovDecision({ a26_arcmin: 10000 }).degrees).toBe(60);
    expect(objectFovDecision({ a26_arcmin: 10000 }).exactA26).toBe(false);
  });
});

describe("needsInitialFovCorrection", () => {
  test("corrects significantly wrong measured FoV", () => {
    const requested = objectFovDegrees({ a26_arcmin: 5.4707377778 });
    expect(requested * 60).toBeCloseTo(5.4707377778, 6);
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
