import { describe, expect, test } from "bun:test";
import {
  INITIAL_SCENE_OPTIONS,
  galaxyFitHalfHeight,
  intervalProjectedLength,
} from "../src/lib/groupSceneWebGLPolicy.ts";
import type { Vec3 } from "../src/lib/groupGeometry3d.ts";

describe("Clean group viewer", () => {
  test("optional guides are off by default", () => {
    expect(INITIAL_SCENE_OPTIONS.grid).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.box).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.relations).toBe(false);
  });
  test("fit uses real points at one physical scale for wide and narrow viewports", () => {
    const points: Vec3[] = [
      [-120, 20, 0],
      [80, 90, 5],
    ];
    for (const aspect of [0.5, 1, 2]) {
      const half = galaxyFitHalfHeight(points, aspect);
      expect(half).toBeCloseTo(1.12 * Math.max(120 / aspect, 90), 10);
      for (const [x, y] of points) {
        expect(Math.abs(x)).toBeLessThan(half * aspect);
        expect(Math.abs(y)).toBeLessThan(half);
      }
    }
  });
  test("interval length is the exact projected distance, including end-on intervals", () => {
    expect(intervalProjectedLength({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0);
    expect(intervalProjectedLength({ x: 3, y: 4 }, { x: 6, y: 8 })).toBe(5);
  });
});
