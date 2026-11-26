import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PECULIAR_CONFIG,
  decodePeculiarConfig,
  peculiarValues,
  radialArrows,
  type PeculiarPoint,
} from "../src/lib/spatialPeculiarVelocity.ts";
function point(
  pgc: number,
  position: PeculiarPoint["position"],
  velocityLgKms: number | null,
  distanceMpc = Math.hypot(...position),
): PeculiarPoint {
  return { pgc, position, verified: true, distanceMpc, velocityLgKms };
}
const config = { ...DEFAULT_PECULIAR_CONFIG, scope: "all" as const };
describe("Radial peculiar velocity layer", () => {
  test("signed residual uses catalogue VLG and distance; zero is data", () => {
    const points = [
      point(1, [2, 0, 0], 240),
      point(2, [0, 2, 0], 40),
      point(3, [0, 0, 2], 140),
    ];
    expect([...peculiarValues(points, 70)]).toEqual([
      [1, 100],
      [2, -100],
      [3, 0],
    ]);
    expect(peculiarValues(points, 80).get(1)).toBe(80);
  });
  test("missing, duplicate, invalid, origin and invalid H0 fail closed", () => {
    const points = [
      point(1, [1, 0, 0], null),
      point(2, [0, 1, 0], 10),
      point(2, [0, 1, 0], 20),
      point(3, [0, 0, 0], 10),
      point(4, [1, 0, 0], 10, 0),
      point(5, [NaN, 0, 0], 10),
      point(6, [1, 0, 0], -20),
    ];
    expect([...peculiarValues(points, 70)]).toEqual([[6, -90]]);
    expect(peculiarValues(points, 0).size).toBe(0);
  });
  test("positive and negative shafts follow the radial direction with linear length", () => {
    const points = [point(1, [2, 0, 0], 240), point(2, [0, 2, 0], -60)];
    const arrows = radialArrows(
      points,
      peculiarValues(points, 70),
      config,
      null,
    );
    expect(arrows.map((a) => a.segments.slice(0, 6))).toEqual([
      [2, 0, 0, 2.5, 0, 0],
      [0, 2, 0, 0, 1, 0],
    ]);
    expect(
      arrows.every(
        (a) => a.segments.length === 30 && a.segments.every(Number.isFinite),
      ),
    ).toBe(true);
  });
  test("pole and rotated directions keep signed shaft length", () => {
    const points = [
      point(1, [0, 0, 2], 240),
      point(2, [0, 0, -2], 240),
      point(3, [1, 1, 1], 100 + 70 * Math.sqrt(3)),
    ];
    for (const a of radialArrows(
      points,
      peculiarValues(points, 70),
      config,
      null,
    )) {
      const s = a.segments;
      expect(Math.hypot(s[3] - s[0], s[4] - s[1], s[5] - s[2])).toBeCloseTo(
        0.5,
      );
      expect(s.every(Number.isFinite)).toBe(true);
    }
  });
  test("off, selection, threshold and visible identity preserve exact scope", () => {
    const points = [
      point(1, [2, 0, 0], 240),
      point(2, [0, 2, 0], 40),
      point(3, [0, 0, 2], 140),
    ];
    const values = peculiarValues(points, 70);
    expect(radialArrows(points, values, DEFAULT_PECULIAR_CONFIG, 1)).toEqual(
      [],
    );
    expect(
      radialArrows(points, values, { ...config, scope: "selected" }, 2).map(
        (a) => a.pgc,
      ),
    ).toEqual([2]);
    expect(
      radialArrows(points.slice(0, 1), values, config, null).map((a) => a.pgc),
    ).toEqual([1]);
    expect(
      radialArrows(points, values, { ...config, thresholdKms: 100 }, null)
        .length,
    ).toBe(2);
    expect(
      radialArrows(points, values, { ...config, thresholdKms: 101 }, null),
    ).toEqual([]);
  });
  test("scale doubles shaft length without changing velocity; settings validate", () => {
    const points = [point(1, [2, 0, 0], 240)];
    const values = peculiarValues(points, 70);
    expect(
      radialArrows(
        points,
        values,
        { ...config, mpcPer100: 1 },
        null,
      )[0].segments.slice(0, 6),
    ).toEqual([2, 0, 0, 3, 0, 0]);
    expect(values.get(1)).toBe(100);
    expect(decodePeculiarConfig(config)).toEqual(config);
    expect(decodePeculiarConfig({ ...config, mpcPer100: 0 })).toBeNull();
    expect(decodePeculiarConfig({ ...config, thresholdKms: NaN })).toBeNull();
    expect(decodePeculiarConfig({ ...config, hubble: 201 })).toBeNull();
  });
});
