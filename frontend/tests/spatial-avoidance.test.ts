import { describe, expect, test } from "bun:test";
import {
  avoidanceGeometry,
  decodeAvoidance,
  DEFAULT_AVOIDANCE,
} from "../src/lib/spatialAvoidance.ts";
import {
  rotateFrameToIcrs,
  rotateIcrsVector,
  type ObserverFrame,
} from "../src/lib/spatialFrames.ts";
import type { Vec3 } from "../src/lib/groupGeometry3d.ts";

describe("Geometric Galactic latitude band", () => {
  test("default off and invalid settings fail closed", () => {
    for (const raw of [
      null,
      {},
      { enabled: true, latitudeDeg: 0 },
      { enabled: true, latitudeDeg: 31 },
      { enabled: true, latitudeDeg: NaN },
      { enabled: 1, latitudeDeg: 10 },
    ])
      expect(decodeAvoidance(raw)).toEqual(DEFAULT_AVOIDANCE);
    expect(decodeAvoidance({ enabled: true, latitudeDeg: 15 })).toEqual({
      enabled: true,
      latitudeDeg: 15,
    });
  });
  test("both cones use the exact Galactic latitude boundary at a display radius", () => {
    const result = avoidanceGeometry("GALACTIC", 10, 11);
    expect(result.surfaces.length).toBe(96 * 2 * 9);
    expect(result.lines.length).toBe((96 + 8) * 2 * 6);
    let positive = 0,
      negative = 0;
    for (let i = 0; i < result.surfaces.length; i += 3) {
      const [x, y, z] = result.surfaces.slice(i, i + 3);
      const r = Math.hypot(x, y, z);
      if (r === 0) continue;
      expect(r).toBeCloseTo(11, 9);
      expect(Math.abs(z / r)).toBeCloseTo(Math.sin(Math.PI / 18), 9);
      if (z > 0) positive++;
      else negative++;
    }
    expect(positive).toBe(192);
    expect(negative).toBe(192);
  });
  test("coordinates rotate the same angular boundaries into every frame", () => {
    const frames: ObserverFrame[] = ["ICRS", "SUPERGALACTIC", "GALACTIC"];
    for (const frame of frames) {
      const result = avoidanceGeometry(frame, 20, 5);
      for (let i = 0; i < result.lines.length; i += 3) {
        const v: Vec3 = [
          result.lines[i],
          result.lines[i + 1],
          result.lines[i + 2],
        ];
        const r = Math.hypot(...v);
        if (r === 0) continue;
        const galactic = rotateIcrsVector(
          rotateFrameToIcrs(v, frame),
          "GALACTIC",
        );
        expect(r).toBeCloseTo(5, 8);
        expect(Math.abs(galactic[2] / r)).toBeCloseTo(Math.sin(Math.PI / 9), 8);
      }
    }
  });
  test("invalid radii and latitudes do not make geometry", () => {
    for (const [latitude, radius] of [
      [0, 11],
      [31, 11],
      [10, 0],
      [10, Infinity],
      [NaN, 5],
    ])
      expect(avoidanceGeometry("GALACTIC", latitude, radius)).toEqual({
        surfaces: [],
        lines: [],
      });
  });
});
