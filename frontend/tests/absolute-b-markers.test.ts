import { describe, expect, test } from "bun:test";
import { markerDiameter, findReticleTarget } from "../src/lib/reticle.ts";
import { OVERVIEW_MARKER_MAX_DIAMETER } from "../src/lib/overviewMarkers.ts";

describe("absolute B magnitude marker encoding", () => {
  test("fixed range maps luminosity monotonically to compact bounded diameters", () => {
    expect(OVERVIEW_MARKER_MAX_DIAMETER).toBe(12);
    expect(
      [-10, -12, -14, -16, -18, -20, -22].map((m) =>
        markerDiameter(m, OVERVIEW_MARKER_MAX_DIAMETER),
      ),
    ).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(markerDiameter(-30, OVERVIEW_MARKER_MAX_DIAMETER)).toBe(12);
    expect(markerDiameter(-2, OVERVIEW_MARKER_MAX_DIAMETER)).toBe(6);
    expect(markerDiameter(-22)).toBe(18);
    expect(markerDiameter(-16, OVERVIEW_MARKER_MAX_DIAMETER)).toBe(9);
    expect(markerDiameter(-12.5, OVERVIEW_MARKER_MAX_DIAMETER)).toBe(8);
    expect(markerDiameter(-10.75, OVERVIEW_MARKER_MAX_DIAMETER)).toBe(7);
  });
  test("unavailable absolute magnitudes never substitute apparent brightness", () => {
    for (const value of [null, NaN, Infinity, -Infinity]) {
      expect(markerDiameter(value, OVERVIEW_MARKER_MAX_DIAMETER)).toBe(6);
    }
    const faint = {
      pgc: 1,
      ra: 58,
      dec: 50,
      bt: -100,
      b_mag: -100,
      abs_b_mag: null,
    };
    const bright = { ...faint, bt: 25, b_mag: 25, abs_b_mag: -22 };
    function project(ra: number, dec: number): [number, number] {
      return [ra, dec];
    }
    expect(findReticleTarget([faint], [100, 100], project)).toBeNull();
    expect(findReticleTarget([bright], [100, 100], project)).toEqual(bright);
  });
  test("compact size remains independent of the selected catalogue subset", () => {
    const magnitudes = [-22, -18, -16, -13, -8, null];
    const sizes = magnitudes.map((m) =>
      markerDiameter(m, OVERVIEW_MARKER_MAX_DIAMETER),
    );
    expect(sizes).toEqual([12, 10, 9, 8, 6, 6]);
    expect(
      magnitudes
        .slice(2, 5)
        .map((m) => markerDiameter(m, OVERVIEW_MARKER_MAX_DIAMETER)),
    ).toEqual(sizes.slice(2, 5));
  });
});
