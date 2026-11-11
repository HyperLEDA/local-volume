import { describe, expect, test } from "bun:test";
import {
  needsInitialFovCorrection,
  objectFovDegrees,
} from "../src/lib/objectFov.ts";

describe("objectFovDegrees", () => {
  test("converts half-light semi-axes from arcseconds into degrees", () => {
    expect(objectFovDegrees({ a50: 45, b50: 20 })).toBeCloseTo(0.1, 10);
    expect(objectFovDegrees({ a50: 300, b50: 150 })).toBeCloseTo(2 / 3, 10);
  });

  test("uses the larger valid axis, even for anomalous axis order", () => {
    expect(objectFovDegrees({ a50: 20, b50: 90 })).toBeCloseTo(0.2, 10);
    expect(objectFovDegrees({ a50: 90, b50: 20 })).toBeCloseTo(0.2, 10);
  });

  test("uses a single valid axis when its counterpart is absent", () => {
    expect(objectFovDegrees({ a50: 45, b50: null })).toBeCloseTo(0.1, 10);
    expect(objectFovDegrees({ a50: null, b50: 45 })).toBeCloseTo(0.1, 10);
    expect(objectFovDegrees({ a50: undefined, b50: 45 })).toBeCloseTo(0.1, 10);
  });

  test("applies the minimum field for very compact objects", () => {
    expect(objectFovDegrees({ a50: 0.5, b50: 0.3 })).toBe(0.025);
    expect(objectFovDegrees({ a50: 10, b50: 5 })).toBe(0.025);
  });

  test("applies the maximum field for very extended objects", () => {
    expect(objectFovDegrees({ a50: 4000, b50: 2000 })).toBe(6);
    expect(objectFovDegrees({ a50: 10000, b50: null })).toBe(6);
  });

  test("retains a one-degree fallback without usable measurements", () => {
    expect(objectFovDegrees({ a50: null, b50: null })).toBe(1);
    expect(objectFovDegrees({ a50: undefined, b50: undefined })).toBe(1);
    expect(objectFovDegrees({ a50: 0, b50: -15 })).toBe(1);
    expect(objectFovDegrees({ a50: NaN, b50: Infinity })).toBe(1);
    expect(objectFovDegrees({ a50: -Infinity, b50: null })).toBe(1);
  });

  test("ignores invalid axes if the other dimension is usable", () => {
    expect(objectFovDegrees({ a50: Infinity, b50: 45 })).toBeCloseTo(0.1, 10);
    expect(objectFovDegrees({ a50: -20, b50: 90 })).toBeCloseTo(0.2, 10);
  });
});

describe("needsInitialFovCorrection", () => {
  test("detects an overly zoomed initial view such as NGC 4449", () => {
    const requested = objectFovDegrees({ a50: 61.5458, b50: 40.00981 });
    expect(requested * 60).toBeCloseTo(8.2061066667, 6);
    expect(needsInitialFovCorrection(1.986 / 60, requested)).toBe(true);
  });

  test("does not modify an already correct initial view", () => {
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
