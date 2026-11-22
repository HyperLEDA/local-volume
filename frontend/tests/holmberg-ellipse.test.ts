import { describe, expect, test } from "bun:test";
import {
  holmbergEllipse,
  type HolmbergEllipseInput,
} from "../src/lib/holmbergEllipse.ts";

const valid: HolmbergEllipseInput = {
  raDeg: 120,
  decDeg: 0,
  a26Arcmin: 20,
  axisRatio: 0.5,
  axisRatioIsophote: "B26.5",
  positionAngle: {
    angleDeg: 0,
    convention: "north-through-east",
    band: "B",
    isophoteMagArcsec2: 26.5,
    sourceId: "verified-catalog-measurement",
  },
};

function deltaRa(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

describe("future Holmberg isophote geometry (not wired to UI)", () => {
  test("a26 is a FULL major-axis diameter and PA=0 points north", () => {
    const result = holmbergEllipse(valid)!;
    expect(result.majorDiameterArcmin).toBe(20);
    expect(result.minorDiameterArcmin).toBe(10);
    expect(result.vertices).toHaveLength(129);
    expect(result.vertices[0][0]).toBeCloseTo(120, 8);
    expect(result.vertices[0][1]).toBeCloseTo(10 / 60, 8);
    expect(result.vertices[32][0]).toBeCloseTo(120 + 5 / 60, 8);
    expect(result.vertices[32][1]).toBeCloseTo(0, 8);
    expect(result.vertices[128]).toEqual(result.vertices[0]);
  });

  test("PA=90 points east; 180° is the same unoriented ellipse", () => {
    const angle = valid.positionAngle!;
    const east = holmbergEllipse({ ...valid, positionAngle: { ...angle, angleDeg: 90 } })!;
    expect(deltaRa(east.vertices[0][0], valid.raDeg!)).toBeCloseTo(10 / 60, 8);
    expect(east.vertices[0][1]).toBeCloseTo(0, 8);
    expect(east.vertices[32][1]).toBeCloseTo(-5 / 60, 8);
    const twice = holmbergEllipse({ ...valid, positionAngle: { ...angle, angleDeg: 180 } })!;
    expect(twice.positionAngleDeg).toBe(0);
    expect(twice.vertices[0]).toEqual(holmbergEllipse(valid)!.vertices[0]);
  });

  test("handles RA wrap and positions near celestial poles", () => {
    const result = holmbergEllipse({ ...valid, raDeg: 359.999, decDeg: 89.9 });
    expect(result).not.toBeNull();
    for (const [ra, dec] of result!.vertices) {
      expect(Number.isFinite(ra)).toBe(true);
      expect(Number.isFinite(dec)).toBe(true);
      expect(ra).toBeGreaterThanOrEqual(0);
      expect(ra).toBeLessThan(360);
      expect(dec).toBeGreaterThanOrEqual(-90);
      expect(dec).toBeLessThanOrEqual(90);
    }
  });

  test("missing PA and unspecified axis-ratio isophote never draw a contour", () => {
    for (const broken of [
      { positionAngle: null },
      { positionAngle: undefined },
      { axisRatioIsophote: "unknown" },
      { axisRatioIsophote: "other" },
      { a26Arcmin: null },
      { axisRatio: null },
      { axisRatio: 0 },
      { axisRatio: 1.1 },
      { raDeg: Number.NaN },
      { decDeg: 90.1 },
    ] as const) {
      expect(holmbergEllipse({ ...valid, ...broken })).toBeNull();
    }
  });

  test("a D25 PA, blank provenance and invalid conventions are rejected", () => {
    const pa = valid.positionAngle!;
    for (const broken of [
      { sourceId: "" },
      { sourceId: "   " },
      { isophoteMagArcsec2: 25 },
      { band: "Ks" },
      { convention: "east-through-north" },
      { angleDeg: NaN },
      { angleDeg: -1 },
      { angleDeg: 360 },
    ]) {
      expect(holmbergEllipse({
        ...valid,
        positionAngle: { ...pa, ...broken },
      })).toBeNull();
    }
    // A PA of 0° is a valid measurement, not missingness.
    expect(holmbergEllipse(valid)).not.toBeNull();
  });
});
