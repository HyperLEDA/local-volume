import { describe, expect, test } from "bun:test";
import {
  supergalacticOffset,
  frameAxisLabels,
  viewerScene,
} from "../src/lib/groupSceneSupergalactic.ts";
import type { GroupScene, ScenePoint } from "../src/lib/groupScene3d.ts";

describe("Supergalactic viewer frame", () => {
  test("standard ICRS x direction maps to the published SG orientation", () => {
    const v = supergalacticOffset([0, 0, 1], 0, 0);
    expect(v[0]).toBeCloseTo(0.375015477807805, 12);
    expect(v[1]).toBeCloseTo(-0.89832045561652, 12);
    expect(v[2]).toBeCloseTo(0.228874966795218, 12);
  });
  test("rotation preserves norm and pairwise separation across sky positions", () => {
    for (const ra of [0, 120, 359.9])
      for (const dec of [-90, -22, 0, 90]) {
        const a = supergalacticOffset([10, -40, 70], ra, dec);
        const b = supergalacticOffset([50, 20, -10], ra, dec);
        expect(Math.hypot(...a)).toBeCloseTo(Math.hypot(10, -40, 70), 10);
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeCloseTo(
          Math.hypot(-40, -60, 80),
          10,
        );
      }
  });
  test("zero stays zero; axes explicitly denote offsets", () => {
    expect(Math.hypot(...supergalacticOffset([0, 0, 0], 130, 20))).toBe(0);
    expect(frameAxisLabels("SUPERGALACTIC")).toEqual(["ΔSGX", "ΔSGY", "ΔSGZ"]);
  });
  test("a frame change preserves the schematic plane and absent positions", () => {
    const root = {
      pgc: 1,
      raDeg: 120,
      decDeg: -20,
      displayPositionKpc: [0, 0, 0],
      interval: null,
    } as ScenePoint;
    const assigned = {
      pgc: 2,
      kind: "ASSIGNED_PROJECTION",
      displayPositionKpc: [30, 40, 0],
      interval: null,
    } as ScenePoint;
    const absent = {
      pgc: 3,
      displayPositionKpc: null,
      interval: null,
    } as ScenePoint;
    const scene = {
      status: "READY",
      rootPgc: 1,
      points: [root, assigned, absent],
      displayExtentKpc: 50,
    } as GroupScene;
    const rotated = viewerScene(scene, "SUPERGALACTIC");
    expect(rotated.points[1].kind).toBe("ASSIGNED_PROJECTION");
    expect(Math.hypot(...rotated.points[1].displayPositionKpc!)).toBeCloseTo(
      50,
      10,
    );
    expect(rotated.points[2].displayPositionKpc).toBeNull();
    expect(scene.points[1].displayPositionKpc).toEqual([30, 40, 0]);
    expect(viewerScene(scene, "LOCAL")).toBe(scene);
  });
});
