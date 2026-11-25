import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  spatialKeyDirection,
  spatialKeyVector,
  spatialPointerMoved,
  panSpatialCamera,
} from "../src/lib/spatialKeyboard.ts";

describe("Shared 3D navigation", () => {
  test("physical codes and arrow aliases", () => {
    expect(spatialKeyDirection("KeyW")).toEqual([0, 1]);
    expect(spatialKeyDirection("ArrowDown")).toEqual([0, -1]);
    expect(spatialKeyDirection("Enter")).toBeNull();
    expect(spatialKeyVector(["KeyD", "ArrowRight"])).toEqual([1, 0]);
    expect(spatialKeyVector(["KeyA", "KeyD", "ArrowRight"])).toEqual([0, 0]);
    expect(Math.hypot(...spatialKeyVector(["KeyW", "KeyD"]))).toBeCloseTo(1);
  });
  test("drag threshold applies only to the initiating pointer", () => {
    const start = { id: 1, x: 0, y: 0 };
    expect(
      spatialPointerMoved(start, { pointerId: 1, clientX: 3, clientY: 4 }),
    ).toBe(false);
    expect(
      spatialPointerMoved(start, { pointerId: 1, clientX: 6, clientY: 0 }),
    ).toBe(true);
    expect(
      spatialPointerMoved(start, { pointerId: 2, clientX: 6, clientY: 0 }),
    ).toBe(false);
  });
  test("ortho pan translates target and camera equally at current zoom", () => {
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.01, 100);
    camera.position.set(0, 0, 10);
    camera.zoom = 2;
    const target = new THREE.Vector3();
    panSpatialCamera(camera, target, 1, 0, 0.04, false);
    expect(target.x).toBeCloseTo(0.22);
    expect(camera.position.clone().sub(target).toArray()).toEqual([0, 0, 10]);
  });
  test("perspective pan uses target depth and screen orientation", () => {
    const camera = new THREE.PerspectiveCamera(90, 1, 0.01, 100);
    camera.position.set(10, 0, 0);
    camera.lookAt(0, 0, 0);
    const target = new THREE.Vector3();
    panSpatialCamera(camera, target, 1, 0, 0.04, false);
    expect(target.x).toBeCloseTo(0);
    expect(target.z).toBeCloseTo(-0.44);
    expect(camera.position.clone().sub(target).x).toBeCloseTo(10);
  });
});
