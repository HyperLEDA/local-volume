import { describe, expect, test } from "bun:test";
import {
  nominalEnvironment,
  radialPeculiarVelocity,
  type EnvironmentPoint,
} from "../src/lib/spatialEnvironment.ts";

function point(
  pgc: number,
  position: EnvironmentPoint["position"],
  verified = false,
): EnvironmentPoint {
  return { pgc, position, verified };
}

describe("Nominal spatial environment", () => {
  test("inclusive radius, exclude self, deterministic ties, no repeated identities", () => {
    const rows = [
      point(1, [0, 0, 1], true),
      point(3, [1, 0, 1]),
      point(2, [-1, 0, 1], true),
      point(4, [0, 0, 3]),
    ];
    const result = nominalEnvironment(rows, 1, 1, 11);
    expect(result?.within.map((row) => row.pgc)).toEqual([2, 3]);
    expect(result?.nearest?.pgc).toBe(2);
    expect(result?.within.map((row) => row.verified)).toEqual([true, false]);
    expect(result?.densityPerMpc3).toBeCloseTo(2 / ((4 * Math.PI) / 3), 12);
    expect(rows.map((row) => row.pgc)).toEqual([1, 3, 2, 4]);
  });
  test("empty neighbourhood differs from unavailable target and clipped volume", () => {
    expect(
      nominalEnvironment([point(1, [10.5, 0, 0])], 1, 1, 11)?.boundaryClipped,
    ).toBe(true);
    expect(
      nominalEnvironment([point(1, [10, 0, 0])], 1, 1, 11)?.boundaryClipped,
    ).toBe(false);
    expect(
      nominalEnvironment([point(1, [10.5, 0, 0])], 1, 1, 11)?.densityPerMpc3,
    ).toBe(0);
    expect(nominalEnvironment([point(1, [1, 0, 0])], 2, 1, null)).toBeNull();
  });
  test("duplicates, nonfinite coordinates and invalid radius fail closed", () => {
    const rows = [
      point(1, [1, 0, 0]),
      point(2, [1, 0, 0]),
      point(2, [1, 0, 1]),
      point(3, [NaN, 0, 0]),
    ];
    expect(nominalEnvironment(rows, 1, 1, null)?.within).toEqual([]);
    expect(nominalEnvironment(rows, 2, 1, null)).toBeNull();
    expect(nominalEnvironment(rows, 1, 1, null)?.nearest).toBeNull();
    for (const radius of [0, -1, NaN, Infinity])
      expect(nominalEnvironment(rows, 1, radius, null)).toBeNull();
  });
  test("nearest can be outside the requested radius; a sole target has no neighbour", () => {
    const target = point(1, [1, 0, 0]);
    const alone = nominalEnvironment([target], 1, 0.5, null);
    expect(alone?.nearest).toBeNull();
    expect(alone?.within).toEqual([]);
    expect(alone?.densityPerMpc3).toBe(0);
    const distant = nominalEnvironment(
      [target, point(2, [3, 0, 0])],
      1,
      0.5,
      null,
    );
    expect(distant?.nearest?.pgc).toBe(2);
    expect(distant?.nearest?.separationMpc).toBe(2);
    expect(distant?.within).toEqual([]);
    expect(distant?.densityPerMpc3).toBe(0);
  });
  test("rigid axis rotation preserves separation and density", () => {
    const rows = [point(1, [1, 2, 3]), point(2, [2, 3, 4])];
    const rotated = rows.map((p) =>
      point(p.pgc, [-p.position[1], p.position[0], p.position[2]]),
    );
    expect(nominalEnvironment(rows, 1, 2, 11)).toEqual(
      nominalEnvironment(rotated, 1, 2, 11),
    );
  });
  test("LG radial residual retains signed velocity and rejects missing evidence", () => {
    expect(radialPeculiarVelocity(400, 5, 70)).toBe(50);
    expect(radialPeculiarVelocity(-30, 2, 70)).toBe(-170);
    expect(radialPeculiarVelocity(0, 2, 70)).toBe(-140);
    expect(radialPeculiarVelocity(null, 2, 70)).toBeNull();
    expect(radialPeculiarVelocity(100, null, 70)).toBeNull();
    expect(radialPeculiarVelocity(100, 2, 0)).toBeNull();
  });
});
