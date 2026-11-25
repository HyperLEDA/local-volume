import type { Vec3 } from "./groupGeometry3d.ts";
import {
  rotateFrameToIcrs,
  rotateIcrsVector,
  type ObserverFrame,
} from "./spatialFrames.ts";

export const ATLAS_SHELL_RADII = [2, 5, 11] as const;
export type AtlasShellRadius = (typeof ATLAS_SHELL_RADII)[number];
export type AtlasGuides = {
  plane: boolean;
  shells: readonly AtlasShellRadius[];
};
export const DEFAULT_ATLAS_GUIDES: AtlasGuides = { plane: false, shells: [] };

/** Normal to absolute SGZ=0 in the current observer-centred frame. */
export function atlasSupergalacticNormal(frame: ObserverFrame): Vec3 {
  if (frame === "SUPERGALACTIC") return [0, 0, 1];
  return rotateIcrsVector(rotateFrameToIcrs([0, 0, 1], "SUPERGALACTIC"), frame);
}

/** Three orthogonal great circles on a sphere of radius D (Mpc). */
export function atlasShellSegments(radius: AtlasShellRadius): number[] {
  const segments: number[] = [];
  const divisions = 96;
  for (const [a, b] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const) {
    for (let i = 0; i < divisions; i++) {
      for (const j of [i, (i + 1) % divisions]) {
        const angle = (2 * Math.PI * j) / divisions;
        const point = [0, 0, 0];
        point[a] = radius * Math.cos(angle);
        point[b] = radius * Math.sin(angle);
        segments.push(...point);
      }
    }
  }
  return segments;
}

export function toggleAtlasShell(
  guides: AtlasGuides,
  radius: AtlasShellRadius,
  visible: boolean,
): AtlasGuides {
  return {
    ...guides,
    shells: ATLAS_SHELL_RADII.filter((value) =>
      value === radius ? visible : guides.shells.includes(value),
    ),
  };
}
