import type { Vec3 } from "./groupGeometry3d.ts";
export type Camera = {
  yaw: number;
  pitch: number;
  zoom: number;
  panX: number;
  panY: number;
};
export const initialCamera: Camera = {
  yaw: -0.55,
  pitch: 0.48,
  zoom: 1,
  panX: 0,
  panY: 0,
};
export const viewSize = 600;
export function cameraPreset(view: "XY" | "XZ" | "YZ" | "orbit"): Camera {
  if (view === "XY") return { ...initialCamera, yaw: 0, pitch: 0 };
  if (view === "XZ") return { ...initialCamera, yaw: 0, pitch: Math.PI / 2 };
  if (view === "YZ") return { ...initialCamera, yaw: Math.PI / 2, pitch: 0 };
  return { ...initialCamera };
}
export function cameraScale(extent: number | null, camera: Camera): number {
  return (240 * camera.zoom) / Math.max(1, extent ?? 1);
}
export function rotateCamera(camera: Camera, dx: number, dy: number): Camera {
  return {
    ...camera,
    yaw: camera.yaw + dx * 0.009,
    pitch: Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, camera.pitch + dy * 0.009),
    ),
  };
}
export function zoomCamera(camera: Camera, factor: number): Camera {
  return { ...camera, zoom: Math.max(0.2, Math.min(16, camera.zoom * factor)) };
}
export function panCamera(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, panX: camera.panX + dx, panY: camera.panY + dy };
}
// Rotation is orthonormal; scaling is the same on all axes. Depth is used only for painting order.
export function projectPoint(point: Vec3, camera: Camera, scale: number): Vec3 {
  const [x, y, z] = point;
  const cy = Math.cos(camera.yaw),
    sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch),
    sp = Math.sin(camera.pitch);
  const u = cy * x + sy * z;
  const w = -sy * x + cy * z;
  const v = cp * y + sp * w;
  return [
    300 + camera.panX + scale * u,
    300 + camera.panY - scale * v,
    -sp * y + cp * w,
  ];
}
export function niceScaleKpc(scale: number): number {
  const max = 100 / scale;
  const power = 10 ** Math.floor(Math.log10(max));
  return (max / power >= 5 ? 5 : max / power >= 2 ? 2 : 1) * power;
}
export function markerRadius(magnitude: number | null): number {
  return magnitude === null || !Number.isFinite(magnitude)
    ? 3
    : 3 + 6 * Math.pow(Math.max(0, Math.min(1, (-magnitude - 10) / 12)), 0.8);
}
