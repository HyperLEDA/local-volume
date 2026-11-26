import { describe, expect, test } from "bun:test";
import {
  decodeSpaceMode,
  matchedRedshiftPositions,
  type RedshiftInput,
} from "../src/lib/spatialRedshift.ts";
function point(
  pgc: number,
  position: RedshiftInput["position"],
  velocityLgKms: RedshiftInput["velocityLgKms"],
): RedshiftInput {
  return { pgc, position, velocityLgKms };
}
describe("Matched redshift geometry", () => {
  test("positive velocity gives VLG/H0 along same sky direction", () => {
    const points = [point(1, [3, 4, 0], 700), point(2, [-2, 0, 0], 140)];
    const result = matchedRedshiftPositions(points, 70);
    expect(result.get(1)).toEqual([6, 8, 0]);
    expect(result.get(2)).toEqual([-2, 0, 0]);
    expect(points[0].position).toEqual([3, 4, 0]);
  });
  test("negative, zero and absent velocity do not acquire positions", () => {
    expect(
      matchedRedshiftPositions(
        [
          point(1, [1, 0, 0], -70),
          point(2, [1, 0, 0], 0),
          point(3, [1, 0, 0], null),
          point(4, [1, 0, 0], NaN),
        ],
        70,
      ).size,
    ).toBe(0);
  });
  test("duplicate identity, zero and nonfinite directions fail closed", () => {
    expect(
      matchedRedshiftPositions(
        [
          point(1, [1, 0, 0], 70),
          point(1, [2, 0, 0], 140),
          point(2, [0, 0, 0], 70),
          point(3, [Infinity, 0, 0], 70),
        ],
        70,
      ).size,
    ).toBe(0);
  });
  test("H0 rescales radii but not membership for ordinary inputs", () => {
    const points = [point(1, [0, 0, 2], 140)];
    expect(matchedRedshiftPositions(points, 70).get(1)).toEqual([0, 0, 2]);
    expect(matchedRedshiftPositions(points, 35).get(1)).toEqual([0, 0, 4]);
    expect(matchedRedshiftPositions(points, 0).size).toBe(0);
    expect(matchedRedshiftPositions(points, NaN).size).toBe(0);
  });
  test("rotation preserves radius and mode decoder fails closed", () => {
    const a = matchedRedshiftPositions([point(1, [3, 4, 0], 700)], 70).get(1);
    const b = matchedRedshiftPositions([point(1, [0, 3, 4], 700)], 70).get(1);
    expect(a && Math.hypot(...a)).toBeCloseTo(10);
    expect(b && Math.hypot(...b)).toBeCloseTo(10);
    expect(decodeSpaceMode("redshift")).toBe("redshift");
    expect(decodeSpaceMode("matched")).toBe("matched");
    expect(decodeSpaceMode("invalid")).toBe("real");
  });
});
