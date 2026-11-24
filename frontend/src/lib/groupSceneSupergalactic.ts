import type { GroupScene } from "./groupScene3d.ts";
import type { Vec3 } from "./groupGeometry3d.ts";

export type SceneFrameMode = "LOCAL" | "SUPERGALACTIC";
export type ViewerScene = Pick<
  GroupScene,
  "status" | "rootPgc" | "centre" | "points" | "displayExtentKpc"
>;

// ICRS -> Galactic (IAU J2000 orientation) -> Supergalactic.
// SG north pole: Galactic l=47.37 deg, b=6.32 deg; SGX: l=137.37 deg, b=0.
const ICRS_TO_SG = [
  [0.375015477807805, 0.341358961829025, 0.861880183426672],
  [-0.89832045561652, -0.095727140724987, 0.428785113488734],
  [0.228874966795218, -0.935045653274549, 0.270750578700876],
] as const;

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

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
  return [
    dot(ICRS_TO_SG[0], icrs),
    dot(ICRS_TO_SG[1], icrs),
    dot(ICRS_TO_SG[2], icrs),
  ];
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
