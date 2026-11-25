import type { Vec3 } from "./groupGeometry3d.ts";
import {
  rotateFrameToIcrs,
  rotateIcrsVector,
  type ObserverFrame,
} from "./spatialFrames.ts";

export type SliceAxis = "0" | "1" | "2";
export type AtlasSlice = {
  frame: ObserverFrame;
  axis: SliceAxis;
  centreMpc: number;
  thicknessMpc: number;
};
const MAX_MPC = 1e9;

export function decodeAtlasSlice(raw: unknown): AtlasSlice | null {
  if (raw === null || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const { frame, axis, centreMpc, thicknessMpc } = value;
  if (
    (frame !== "ICRS" && frame !== "GALACTIC" && frame !== "SUPERGALACTIC") ||
    (axis !== "0" && axis !== "1" && axis !== "2") ||
    typeof centreMpc !== "number" ||
    !Number.isFinite(centreMpc) ||
    Math.abs(centreMpc) > MAX_MPC ||
    typeof thicknessMpc !== "number" ||
    !Number.isFinite(thicknessMpc) ||
    thicknessMpc <= 0 ||
    thicknessMpc > MAX_MPC
  )
    return null;
  return { frame, axis, centreMpc, thicknessMpc };
}
export function parseAtlasSlice(
  frame: ObserverFrame,
  axis: SliceAxis,
  centre: string,
  thickness: string,
): AtlasSlice | null {
  if (!centre.trim() || !thickness.trim()) return null;
  return decodeAtlasSlice({
    frame,
    axis,
    centreMpc: Number(centre),
    thicknessMpc: Number(thickness),
  });
}
export function sliceBounds(slice: AtlasSlice): readonly [number, number] {
  return [
    slice.centreMpc - slice.thicknessMpc / 2,
    slice.centreMpc + slice.thicknessMpc / 2,
  ];
}
function inFrame(vector: Vec3, from: ObserverFrame, to: ObserverFrame): Vec3 {
  return from === to
    ? vector
    : rotateIcrsVector(rotateFrameToIcrs(vector, from), to);
}
/** Nominal individual catalogue positions only, never schematic depth. */
export function slicePoints<T extends { position: Vec3; kind: string }>(
  points: readonly T[],
  frame: ObserverFrame,
  slice: AtlasSlice | null,
): readonly T[] {
  if (!slice) return points;
  const [lower, upper] = sliceBounds(slice);
  return points.filter((point) => {
    if (point.kind !== "individual" || !point.position.every(Number.isFinite))
      return false;
    const coordinate = inFrame(point.position, frame, slice.frame)[
      Number(slice.axis)
    ];
    // Roundoff allowance for rigid frame rotations at closed boundaries only.
    const tolerance =
      32 *
      Number.EPSILON *
      Math.max(
        1,
        Math.hypot(...point.position),
        Math.abs(lower),
        Math.abs(upper),
      );
    return coordinate >= lower - tolerance && coordinate <= upper + tolerance;
  });
}
/** Outline of each slab boundary within a reference sphere; display only. */
export function sliceGuideSegments(
  slice: AtlasSlice,
  frame: ObserverFrame,
  extent: number,
): number[] {
  if (!Number.isFinite(extent) || extent <= 0) return [];
  const result: number[] = [];
  const axis = Number(slice.axis);
  for (const bound of sliceBounds(slice)) {
    if (Math.abs(bound) >= extent) continue;
    const radius = Math.sqrt(
      (extent - Math.abs(bound)) * (extent + Math.abs(bound)),
    );
    for (let i = 0; i < 64; i++) {
      for (const index of [i, i + 1]) {
        const angle = (2 * Math.PI * index) / 64;
        const vector: [number, number, number] = [0, 0, 0];
        vector[axis] = bound;
        vector[(axis + 1) % 3] = radius * Math.cos(angle);
        vector[(axis + 2) % 3] = radius * Math.sin(angle);
        result.push(...inFrame(vector, slice.frame, frame));
      }
    }
  }
  return result;
}
