import type { Vec3 } from "./groupGeometry3d.ts";
import {
  rotateFrameToIcrs,
  rotateIcrsVector,
  type ObserverFrame,
} from "./spatialFrames.ts";

export type AvoidanceConfig = { enabled: boolean; latitudeDeg: number };
export const DEFAULT_AVOIDANCE: AvoidanceConfig = {
  enabled: false,
  latitudeDeg: 10,
};
export function decodeAvoidance(raw: unknown): AvoidanceConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_AVOIDANCE;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.latitudeDeg !== "number" ||
    !Number.isFinite(value.latitudeDeg) ||
    value.latitudeDeg < 1 ||
    value.latitudeDeg > 30 ||
    typeof value.enabled !== "boolean"
  )
    return DEFAULT_AVOIDANCE;
  return { enabled: value.enabled, latitudeDeg: value.latitudeDeg };
}
/** Boundaries of |b| <= latitudeDeg, truncated at a display radius only. Not a survey mask. */
export function avoidanceGeometry(
  frame: ObserverFrame,
  latitudeDeg: number,
  radius: number,
): { surfaces: number[]; lines: number[] } {
  const surfaces: number[] = [],
    lines: number[] = [];
  if (
    !Number.isFinite(latitudeDeg) ||
    latitudeDeg < 1 ||
    latitudeDeg > 30 ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 1e9
  )
    return { surfaces, lines };
  const divisions = 96;
  const b = (latitudeDeg * Math.PI) / 180;
  function vertex(index: number, sign: number): Vec3 {
    const longitude = (2 * Math.PI * (index % divisions)) / divisions;
    const galactic: Vec3 = [
      radius * Math.cos(b) * Math.cos(longitude),
      radius * Math.cos(b) * Math.sin(longitude),
      sign * radius * Math.sin(b),
    ];
    return frame === "GALACTIC"
      ? galactic
      : rotateIcrsVector(rotateFrameToIcrs(galactic, "GALACTIC"), frame);
  }
  for (const sign of [-1, 1]) {
    for (let i = 0; i < divisions; i++) {
      const a = vertex(i, sign),
        c = vertex(i + 1, sign);
      surfaces.push(0, 0, 0, ...a, ...c);
      lines.push(...a, ...c);
      if (i % 12 === 0) lines.push(0, 0, 0, ...a);
    }
  }
  return { surfaces, lines };
}
