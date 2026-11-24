import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  INITIAL_SCENE_OPTIONS,
  sphereGuideRadius,
  sphereGuideVertices,
  sphereFitHalfHeight,
} from "../src/lib/groupSceneWebGLPolicy.ts";
import type { Vec3 } from "../src/lib/groupGeometry3d.ts";

describe("Optional spherical coordinate guide", () => {
  test("radius encloses all positioned points without changing coordinates", () => {
    const p: Vec3 = [3, 4, 12];
    expect(
      sphereGuideRadius([
        { displayPositionKpc: p },
        { displayPositionKpc: [0, 0, 2] },
        { displayPositionKpc: null },
      ]),
    ).toBe(13);
    expect(p).toEqual([3, 4, 12]);
    expect(sphereGuideRadius([{ displayPositionKpc: [12, 3, -4] }])).toBe(13);
  });
  test("no fictitious sphere for empty, centre-only or invalid positions", () => {
    expect(sphereGuideRadius([])).toBe(0);
    expect(
      sphereGuideRadius([
        { displayPositionKpc: [0, 0, 0] },
        { displayPositionKpc: [NaN, 0, 0] },
      ]),
    ).toBe(0);
    expect(sphereGuideVertices(0)).toEqual([]);
    expect(sphereGuideVertices(Infinity)).toEqual([]);
  });
  test("every ring vertex lies on the same spherical surface", () => {
    const vertices = sphereGuideVertices(173);
    expect(vertices.length).toBe(6 * 64 * 2);
    for (const vertex of vertices)
      expect(Math.hypot(...vertex)).toBeCloseTo(173, 10);
    for (let ring = 0; ring < 6; ring += 1) {
      const first = vertices[ring * 128];
      const last = vertices[ring * 128 + 127];
      expect(
        Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]),
      ).toBeLessThan(1e-9);
    }
  });
  test("sphere fitting preserves isotropic physical scale in both orientations", () => {
    for (const aspect of [0.5, 1, 1.25, 2]) {
      const half = sphereFitHalfHeight(100, aspect);
      expect(half).toBeGreaterThan(100);
      expect(half * aspect).toBeGreaterThan(100);
    }
    expect(sphereFitHalfHeight(0, 1)).toBe(0);
  });
  test("sphere, grid, box and relations are independently disabled initially", () => {
    expect(INITIAL_SCENE_OPTIONS.sphere).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.grid).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.box).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.relations).toBe(false);
    const modal = readFileSync(
      new URL("../src/components/GroupSceneView.tsx", import.meta.url),
      "utf8",
    );
    const engine = readFileSync(
      new URL("../src/components/GroupSceneThree.tsx", import.meta.url),
      "utf8",
    );
    expect(modal).toContain("sphere={sphere}");
    expect(modal).toContain("aria-pressed={sphere}");
    expect(engine).toContain("sphere.visible = next.sphere");
    expect(engine).toContain("axes.visible = true");
    expect(engine).toContain("sphereFitHalfHeight(guideRadius, aspect)");
    expect(engine).toContain("drawDistanceInterval()");
  });
});
