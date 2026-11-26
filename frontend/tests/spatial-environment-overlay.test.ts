import { describe, expect, test } from "bun:test";
import {
  nominalEnvironment,
  type EnvironmentPoint,
} from "../src/lib/spatialEnvironment.ts";
import { environmentOverlay } from "../src/lib/spatialEnvironmentOverlay.ts";
function point(pgc: number, x: number): EnvironmentPoint {
  return { pgc, position: [x, 0, 0], verified: true };
}
describe("Environment overlay", () => {
  test("uses exact centre, radius and visible neighbour positions without modifying sample", () => {
    const rows = [point(1, 2), point(2, 2.5), point(3, 3), point(4, 5)];
    const result = nominalEnvironment(rows, 1, 1, 11);
    const overlay = environmentOverlay(
      [rows[0], rows[2], rows[3]],
      1,
      1,
      result,
    );
    expect(overlay?.centre).toEqual([2, 0, 0]);
    expect(overlay?.radiusMpc).toBe(1);
    expect(overlay?.neighbours.map((row) => row.pgc)).toEqual([3]);
    expect(overlay?.nearest).toBeNull();
    expect(result?.within.map((row) => row.pgc)).toEqual([2, 3]);
  });
  test("nearest outside the radius remains an explicit visible link", () => {
    const rows = [point(1, 2), point(2, 4)];
    const result = nominalEnvironment(rows, 1, 1, null);
    const overlay = environmentOverlay(rows, 1, 1, result);
    expect(overlay?.neighbours).toEqual([]);
    expect(overlay?.nearest?.pgc).toBe(2);
  });
  test("hidden target, absent result, invalid radius and empty neighbourhood", () => {
    const rows = [point(1, 2)];
    const result = nominalEnvironment(rows, 1, 1, null);
    expect(environmentOverlay([], 1, 1, result)).toBeNull();
    expect(environmentOverlay(rows, 1, 1, null)).toBeNull();
    expect(environmentOverlay(rows, 1, 0, result)).toBeNull();
    expect(environmentOverlay(rows, 1, 1, result)?.neighbours).toEqual([]);
  });
});
