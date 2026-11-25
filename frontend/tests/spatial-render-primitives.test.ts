import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  createFrameScheduler,
  galaxyFitHalfHeight,
  scaleBarUnits,
  viewVectors,
} from "../src/lib/spatialRenderPolicy.ts";
import { scaleBarKpc } from "../src/lib/groupSceneWebGLPolicy.ts";
import {
  orthographicPixelsPerUnit,
  projectSpatialPoint,
  setOrthographicFrame,
} from "../src/lib/spatialThreePrimitives.ts";

describe("Shared spatial rendering primitives", () => {
  test("Mpc and kpc fits and scale bars are consistent with explicit minimum extent", () => {
    expect(galaxyFitHalfHeight([[0.12, 0.09, 0]], 2, 0.001) * 1000).toBeCloseTo(
      galaxyFitHalfHeight([[120, 90, 0]], 2),
      10,
    );
    expect(scaleBarUnits(0.002) * 1000).toBeCloseTo(scaleBarKpc(2), 10);
  });
  test("orthographic projections preserve equal units per screen pixel and do not mutate source", () => {
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    setOrthographicFrame(camera, 2, 2);
    const p = new THREE.Vector3(1, 1, 0);
    const a = projectSpatialPoint(p, camera, 800, 400);
    expect(a.x).toBeCloseTo(500, 10);
    expect(a.y).toBeCloseTo(100, 10);
    expect(orthographicPixelsPerUnit(camera, 400)).toBe(100);
    expect(p.toArray()).toEqual([1, 1, 0]);
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    expect(orthographicPixelsPerUnit(camera, 400)).toBe(200);
    expect(projectSpatialPoint(p, camera, 800, 400).x).toBeCloseTo(600, 10);
  });
  test("positive XY, XZ, YZ projections retain handedness", () => {
    for (const view of ["XY", "XZ", "YZ"] as const) {
      const axes = viewVectors(view);
      const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 100);
      camera.position.set(...axes.position).multiplyScalar(10);
      camera.up.set(...axes.up);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const horizontal = new THREE.Vector3(
        ...(view === "YZ" ? ([0, 1, 0] as const) : ([1, 0, 0] as const)),
      );
      const vertical = new THREE.Vector3(...axes.up);
      expect(projectSpatialPoint(horizontal, camera, 400, 400).x).toBeCloseTo(
        300,
        10,
      );
      expect(projectSpatialPoint(vertical, camera, 400, 400).y).toBeCloseTo(
        100,
        10,
      );
    }
  });
  test("frame requests coalesce and stop after disposal, including handle zero", () => {
    const queue = new Map<number, FrameRequestCallback>();
    let next = 0;
    let draws = 0;
    const scheduler = createFrameScheduler(
      () => {
        draws++;
      },
      (fn) => {
        const id = next++;
        queue.set(id, fn);
        return id;
      },
      (id) => {
        queue.delete(id);
      },
    );
    scheduler.schedule();
    scheduler.schedule();
    expect(queue.size).toBe(1);
    const first = queue.get(0)!;
    queue.delete(0);
    first(0);
    expect(draws).toBe(1);
    scheduler.schedule();
    const late = queue.get(1)!;
    scheduler.dispose();
    scheduler.dispose();
    expect(queue.size).toBe(0);
    late(0);
    scheduler.schedule();
    expect(draws).toBe(1);
    expect(queue.size).toBe(0);
  });
});
