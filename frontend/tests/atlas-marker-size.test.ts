import { describe, expect, test } from "bun:test";
import {
  atlasMarkerDiameter,
  atlasMarkerHitRadius,
  atlasMarkerHaloDiameter,
} from "../src/lib/atlasMarkerSize.ts";
import { markerDiameter } from "../src/lib/reticle.ts";

describe("Atlas marker size encoding", () => {
  test("fixed size is independent of photometry and defaults to 6 px", () => {
    for (const value of [null, undefined, -30, -10, 0, Number.NaN]) {
      expect(atlasMarkerDiameter("fixed", "small", value)).toBe(4);
      expect(atlasMarkerDiameter("fixed", "normal", value)).toBe(6);
      expect(atlasMarkerDiameter("fixed", "large", value)).toBe(8);
    }
  });
  test("normal B encoding matches the existing overview map", () => {
    for (const magnitude of [-30, -22, -20, -16, -10, -5, null]) {
      expect(atlasMarkerDiameter("absoluteB", "normal", magnitude)).toBe(
        markerDiameter(magnitude, 12),
      );
    }
  });
  test("brighter symbols grow monotonically and remain bounded", () => {
    for (const density of ["small", "normal", "large"] as const) {
      const faint = atlasMarkerDiameter("absoluteB", density, -10);
      const bright = atlasMarkerDiameter("absoluteB", density, -22);
      expect(bright).toBe(faint * 2);
      expect(atlasMarkerDiameter("absoluteB", density, -30)).toBe(bright);
      expect(atlasMarkerDiameter("absoluteB", density, 0)).toBe(faint);
      expect(atlasMarkerDiameter("absoluteB", density, -18)).toBeGreaterThan(
        faint,
      );
      expect(atlasMarkerDiameter("absoluteB", density, -18)).toBeLessThan(
        bright,
      );
    }
  });
  test("missing and nonfinite B photometry fall back to the base symbol", () => {
    for (const value of [null, undefined, Number.NaN, Infinity, -Infinity]) {
      expect(atlasMarkerDiameter("absoluteB", "normal", value)).toBe(6);
      expect(atlasMarkerDiameter("absoluteB", "large", value)).toBe(8);
    }
  });
  test("picking and selection halo follow the marker diameter", () => {
    expect(atlasMarkerHitRadius(4)).toBe(5);
    expect(atlasMarkerHitRadius(6)).toBe(5);
    expect(atlasMarkerHitRadius(16)).toBe(9);
    expect(atlasMarkerHaloDiameter(6)).toBe(17);
    expect(atlasMarkerHaloDiameter(16)).toBe(27);
  });
});
