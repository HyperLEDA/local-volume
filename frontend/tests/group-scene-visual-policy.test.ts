import { describe, expect, test } from "bun:test";
import {
  sceneFitHalfHeight,
  frameHalfSpans,
  INITIAL_SCENE_OPTIONS,
} from "../src/lib/groupSceneWebGLPolicy.ts";
import type { ScenePoint } from "../src/lib/groupScene3d.ts";
import type { Vec3 } from "../src/lib/groupGeometry3d.ts";

describe("3D scene display frame", () => {
  test("fits all projected axes using equal physical scale on wide and narrow screens", () => {
    const corners: Vec3[] = [
      [-120, 20, 0],
      [50, -90, 10],
    ];
    for (const aspect of [0.5, 1, 2]) {
      const half = sceneFitHalfHeight(corners, aspect);
      for (const [x, y] of corners) {
        expect(Math.abs(x)).toBeLessThan(half * aspect);
        expect(Math.abs(y)).toBeLessThan(half);
      }
    }
  });
  test("frame rounds each axis up independently and never creates depth measurements", () => {
    const points: Pick<ScenePoint, "displayPositionKpc">[] = [
      { displayPositionKpc: [-220, 35, 0] },
      { displayPositionKpc: [90, -105, 0] },
      { displayPositionKpc: null },
    ];
    expect(frameHalfSpans(points, 100)).toEqual([300, 200, 100]);
    expect(points[0].displayPositionKpc).toEqual([-220, 35, 0]);
    expect(INITIAL_SCENE_OPTIONS.relations).toBe(false);
  });
});
