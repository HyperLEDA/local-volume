import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DENSITY_CONFIG,
  decodeDensityConfig,
  spatialDensity,
} from "../src/lib/spatialDensity.ts";
import type { EnvironmentPoint } from "../src/lib/spatialEnvironment.ts";
import { nominalEnvironment } from "../src/lib/spatialEnvironment.ts";
function point(pgc: number, x: number, y = 0, z = 0): EnvironmentPoint {
  return { pgc, position: [x, y, z], verified: true };
}
describe("Spatial sample density", () => {
  test("fixed radius agrees with nominal neighbourhood including zero and closed boundary", () => {
    const points = [point(1, 0), point(2, 1), point(3, 4)];
    const result = spatialDensity(points, DEFAULT_DENSITY_CONFIG, null);
    expect(result.values.get(1)).toBeCloseTo(3 / (4 * Math.PI));
    expect(result.values.get(3)).toBe(0);
    for (const p of points)
      expect(result.values.get(p.pgc)).toBe(
        nominalEnvironment(points, p.pgc, 1, null)?.densityPerMpc3,
      );
  });
  test("kNN uses actual kth distance, not target or fixed radius", () => {
    const points = [point(1, 0), point(2, 1), point(3, 2), point(4, 4)];
    const config = { ...DEFAULT_DENSITY_CONFIG, method: "knn" as const, k: 2 };
    const result = spatialDensity(points, config, null);
    expect(result.estimates.get(1)?.supportRadiusMpc).toBe(2);
    expect(result.values.get(1)).toBeCloseTo(2 / ((4 * Math.PI * 8) / 3));
    expect(spatialDensity(points.slice(0, 2), config, null).values.size).toBe(
      0,
    );
  });
  test("edge estimates excluded by default; explicit inclusion does not correct density", () => {
    const points = [point(1, 10.5), point(2, 10)];
    const result = spatialDensity(points, DEFAULT_DENSITY_CONFIG, 11);
    expect(result.boundaryCount).toBe(1);
    expect(result.values.has(1)).toBe(false);
    expect(result.values.has(2)).toBe(true);
    expect(
      spatialDensity(
        points,
        { ...DEFAULT_DENSITY_CONFIG, includeBoundary: true },
        11,
      ).values.get(1),
    ).toBe(result.estimates.get(1)?.densityPerMpc3);
  });
  test("duplicates, invalid coordinates and singular kth distance do not fabricate values", () => {
    const points = [
      point(1, 0),
      point(1, 1),
      point(2, NaN),
      point(3, 2),
      point(4, 2),
      point(5, 2),
    ];
    const result = spatialDensity(
      points,
      { ...DEFAULT_DENSITY_CONFIG, method: "knn", k: 2 },
      null,
    );
    expect(result.eligibleCount).toBe(3);
    expect(result.values.size).toBe(0);
  });
  test("rotation and order preserve physical densities", () => {
    const points = [point(1, 0), point(2, 0, 0.5), point(3, 3, 0, 2)];
    const rotated = points
      .map((p) => point(p.pgc, -p.position[1], p.position[0], p.position[2]))
      .reverse();
    expect(spatialDensity(points, DEFAULT_DENSITY_CONFIG, null).values).toEqual(
      spatialDensity(rotated, DEFAULT_DENSITY_CONFIG, null).values,
    );
  });
  test("session settings reject invalid or incomplete parameters", () => {
    expect(decodeDensityConfig(DEFAULT_DENSITY_CONFIG)).toEqual(
      DEFAULT_DENSITY_CONFIG,
    );
    expect(
      decodeDensityConfig({ ...DEFAULT_DENSITY_CONFIG, k: 2.5 }),
    ).toBeNull();
    expect(
      decodeDensityConfig({ ...DEFAULT_DENSITY_CONFIG, radiusMpc: 0 }),
    ).toBeNull();
    expect(decodeDensityConfig(null)).toBeNull();
  });
});
