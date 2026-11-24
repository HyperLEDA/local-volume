import { describe, expect, test } from "bun:test";
import {
  cameraPreset,
  cameraScale,
  markerRadius,
  niceScaleKpc,
  panCamera,
  projectPoint,
  rotateCamera,
  zoomCamera,
} from "../src/lib/groupSceneCamera.ts";
import type { Vec3 } from "../src/lib/groupGeometry3d.ts";
describe("Catalogue 3D orthographic camera", () => {
  test("XY has east right, north up and LOS depth", () => {
    expect(projectPoint([10, 20, 30], cameraPreset("XY"), 2)).toEqual([
      320, 260, 30,
    ]);
  });
  test("XZ and YZ show orthogonal coordinates without distortion", () => {
    const xz = projectPoint([10, 20, 30], cameraPreset("XZ"), 2),
      yz = projectPoint([10, 20, 30], cameraPreset("YZ"), 2);
    expect(xz[0]).toBeCloseTo(320);
    expect(xz[1]).toBeCloseTo(240);
    expect(yz[0]).toBeCloseTo(360);
    expect(yz[1]).toBeCloseTo(260);
  });
  test("rotation preserves spatial norm and source coordinates", () => {
    const p: Vec3 = [20, -30, 45];
    const c = rotateCamera(cameraPreset("orbit"), 30, -70);
    const q = projectPoint(p, c, 2);
    expect(Math.hypot((q[0] - 300) / 2, (q[1] - 300) / 2, q[2])).toBeCloseTo(
      Math.hypot(...p),
      10,
    );
    expect(p).toEqual([20, -30, 45]);
  });
  test("pan does not change scale or depth", () => {
    const c = cameraPreset("XY"),
      q = projectPoint([1, 2, 3], panCamera(c, 20, -40), 3);
    expect(q).toEqual([323, 254, 3]);
  });
  test("scale bar uses actual projected scale and zoom is bounded", () => {
    const c = cameraPreset("orbit"),
      scale = cameraScale(960, c),
      bar = niceScaleKpc(scale);
    expect(bar * scale).toBeLessThanOrEqual(100);
    expect(bar * scale).toBeGreaterThan(20);
    expect(zoomCamera(c, 1000).zoom).toBe(16);
    expect(zoomCamera(c, 0.001).zoom).toBe(0.2);
  });
  test("absolute magnitude sizes have fixed limits and no apparent-magnitude fallback", () => {
    expect(markerRadius(-22)).toBe(9);
    expect(markerRadius(-10)).toBe(3);
    expect(markerRadius(null)).toBe(3);
    expect(markerRadius(-18)).toBeGreaterThan(markerRadius(-14));
  });
});
