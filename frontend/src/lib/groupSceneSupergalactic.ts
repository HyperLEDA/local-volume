import type { GroupScene } from "./groupScene3d.ts";
import type { Vec3 } from "./groupGeometry3d.ts";
import { rotateIcrsVector } from "./spatialFrames.ts";

export type SceneFrameMode = "LOCAL" | "SUPERGALACTIC";
export type ViewerScene = Pick<
  GroupScene,
  "status" | "rootPgc" | "centre" | "points" | "displayExtentKpc"
>;

export function supergalacticOffset(
  local: Vec3,
  raDeg: number,
  decDeg: number,
): Vec3 {
  const a = (raDeg * Math.PI) / 180,
    d = (decDeg * Math.PI) / 180;
  const east: Vec3 = [-Math.sin(a), Math.cos(a), 0];
  const north: Vec3 = [
    -Math.sin(d) * Math.cos(a),
    -Math.sin(d) * Math.sin(a),
    Math.cos(d),
  ];
  const los: Vec3 = [
    Math.cos(d) * Math.cos(a),
    Math.cos(d) * Math.sin(a),
    Math.sin(d),
  ];
  const [x, y, z] = local;
  const icrs: Vec3 = [
    x * east[0] + y * north[0] + z * los[0],
    x * east[1] + y * north[1] + z * los[1],
    x * east[2] + y * north[2] + z * los[2],
  ];
  return rotateIcrsVector(icrs, "SUPERGALACTIC");
}

export function frameAxisLabels(
  mode: SceneFrameMode,
): readonly [string, string, string] {
  return mode === "SUPERGALACTIC"
    ? ["ΔSGX", "ΔSGY", "ΔSGZ"]
    : ["E", "N", "LOS+"];
}

// Display-only copy. Distances, flags, original local direction and membership are unchanged.
// Rotate existing schematic positions as well as measured positions; no new depth is introduced.
export function viewerScene(
  scene: GroupScene,
  mode: SceneFrameMode,
): ViewerScene {
  if (mode === "LOCAL" || scene.status !== "READY") return scene;
  const root = scene.points.find((point) => point.pgc === scene.rootPgc);
  const ra = root?.raDeg,
    dec = root?.decDeg;
  if (
    typeof ra !== "number" ||
    typeof dec !== "number" ||
    !Number.isFinite(ra) ||
    !Number.isFinite(dec)
  ) {
    return {
      ...scene,
      status: "CENTRE_UNAVAILABLE",
      points: scene.points.map((point) => ({
        ...point,
        displayPositionKpc: null,
        interval: null,
      })),
      displayExtentKpc: null,
    };
  }
  const points = scene.points.map((point) => ({
    ...point,
    displayPositionKpc:
      point.displayPositionKpc === null
        ? null
        : supergalacticOffset(point.displayPositionKpc, ra, dec),
    interval:
      point.interval === null
        ? null
        : {
            ...point.interval,
            lowerKpc: supergalacticOffset(point.interval.lowerKpc, ra, dec),
            upperKpc: supergalacticOffset(point.interval.upperKpc, ra, dec),
          },
  }));
  return { ...scene, points };
}
