import type { Vec3 } from "./groupGeometry3d.ts";
import {
  rotateFrameToIcrs,
  rotateIcrsVector,
  type ObserverFrame,
} from "./spatialFrames.ts";

export type AtlasRegionKind = "sphere" | "box";
export type AtlasRegion =
  | { kind: "sphere"; frame: ObserverFrame; centreMpc: Vec3; radiusMpc: number }
  | { kind: "box"; frame: ObserverFrame; centreMpc: Vec3; sizeMpc: Vec3 };
const MAX_MPC = 1e9;
function bounded(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_MPC
  );
}
function vector(value: unknown): Vec3 | null {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(bounded))
    return null;
  return [value[0], value[1], value[2]];
}
export function decodeAtlasRegion(raw: unknown): AtlasRegion | null {
  if (!raw || typeof raw !== "object") return null;
  const { kind, frame, centreMpc, radiusMpc, sizeMpc } = raw as Record<
    string,
    unknown
  >;
  if (frame !== "ICRS" && frame !== "GALACTIC" && frame !== "SUPERGALACTIC")
    return null;
  const centre = vector(centreMpc);
  if (!centre) return null;
  if (kind === "sphere" && bounded(radiusMpc) && radiusMpc > 0)
    return { kind, frame, centreMpc: centre, radiusMpc };
  if (kind === "box") {
    const size = vector(sizeMpc);
    if (size && size.every((v) => v > 0))
      return { kind, frame, centreMpc: centre, sizeMpc: size };
  }
  return null;
}
export function parseAtlasRegion(
  kind: AtlasRegionKind,
  frame: ObserverFrame,
  centre: readonly string[],
  radius: string,
  size: readonly string[],
): AtlasRegion | null {
  if (
    centre.some((v) => !v.trim()) ||
    (kind === "sphere" ? !radius.trim() : size.some((v) => !v.trim()))
  )
    return null;
  return decodeAtlasRegion({
    kind,
    frame,
    centreMpc: centre.map(Number),
    radiusMpc: Number(radius),
    sizeMpc: size.map(Number),
  });
}
function inFrame(vector: Vec3, from: ObserverFrame, to: ObserverFrame): Vec3 {
  return from === to
    ? vector
    : rotateIcrsVector(rotateFrameToIcrs(vector, from), to);
}
export function regionPoints<T extends { position: Vec3; kind: string }>(
  points: readonly T[],
  frame: ObserverFrame,
  region: AtlasRegion | null,
): readonly T[] {
  if (!region) return points;
  return points.filter((point) => {
    if (point.kind !== "individual" || !point.position.every(Number.isFinite))
      return false;
    const [x, y, z] = inFrame(point.position, frame, region.frame);
    const [cx, cy, cz] = region.centreMpc;
    const delta: Vec3 = [x - cx, y - cy, z - cz];
    const tolerance =
      32 *
      Number.EPSILON *
      Math.max(
        1,
        Math.hypot(...point.position),
        Math.hypot(...region.centreMpc),
      );
    if (region.kind === "sphere")
      return Math.hypot(...delta) <= region.radiusMpc + tolerance;
    const half = region.sizeMpc;
    return (
      Math.abs(delta[0]) <= half[0] / 2 + tolerance &&
      Math.abs(delta[1]) <= half[1] / 2 + tolerance &&
      Math.abs(delta[2]) <= half[2] / 2 + tolerance
    );
  });
}
/** Display-only exact boundary segments in the scene's frame. */
export function regionGuideSegments(
  region: AtlasRegion,
  frame: ObserverFrame,
): number[] {
  const result: number[] = [];
  function append(offset: Vec3) {
    const [x, y, z] = region.centreMpc;
    result.push(
      ...inFrame(
        [x + offset[0], y + offset[1], z + offset[2]],
        region.frame,
        frame,
      ),
    );
  }
  if (region.kind === "sphere") {
    for (let axis = 0; axis < 3; axis++) {
      for (let i = 0; i < 64; i++) {
        for (const index of [i, i + 1]) {
          const angle = (2 * Math.PI * index) / 64;
          const v: [number, number, number] = [0, 0, 0];
          v[(axis + 1) % 3] = region.radiusMpc * Math.cos(angle);
          v[(axis + 2) % 3] = region.radiusMpc * Math.sin(angle);
          append(v);
        }
      }
    }
  } else {
    const [a, b, c] = region.sizeMpc;
    const corners: Vec3[] = [
      [-a / 2, -b / 2, -c / 2],
      [a / 2, -b / 2, -c / 2],
      [-a / 2, b / 2, -c / 2],
      [a / 2, b / 2, -c / 2],
      [-a / 2, -b / 2, c / 2],
      [a / 2, -b / 2, c / 2],
      [-a / 2, b / 2, c / 2],
      [a / 2, b / 2, c / 2],
    ];
    for (const [start, end] of [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [0, 2],
      [1, 3],
      [4, 6],
      [5, 7],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ]) {
      append(corners[start]);
      append(corners[end]);
    }
  }
  return result;
}
