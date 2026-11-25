import { cartesianMpc, type Icrs, type Vec3 } from "./groupGeometry3d.ts";

export type ObserverFrame = "ICRS" | "GALACTIC" | "SUPERGALACTIC";

type Matrix3 = readonly [Vec3, Vec3, Vec3];

// J2000 Galactic orientation; preserve the convention already used by LV LEDA.
const ICRS_TO_GALACTIC: Matrix3 = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.746982244497219],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function direction(lon: number, lat: number): Vec3 {
  const a = (lon * Math.PI) / 180;
  const d = (lat * Math.PI) / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

// Conventional de Vaucouleurs supergalactic pole and zero longitude.
const SG_X = direction(137.37, 0);
const SG_Z = direction(47.37, 6.32);
const GALACTIC_TO_SG: Matrix3 = [SG_X, cross(SG_Z, SG_X), SG_Z];

function apply(matrix: Matrix3, vector: Vec3): Vec3 {
  return [
    dot(matrix[0], vector),
    dot(matrix[1], vector),
    dot(matrix[2], vector),
  ];
}

// The inverse of an orthonormal rotation is its transpose.
function inverse(matrix: Matrix3, [x, y, z]: Vec3): Vec3 {
  return [
    matrix[0][0] * x + matrix[1][0] * y + matrix[2][0] * z,
    matrix[0][1] * x + matrix[1][1] * y + matrix[2][1] * z,
    matrix[0][2] * x + matrix[1][2] * y + matrix[2][2] * z,
  ];
}

export function galacticVectorToSupergalactic(vector: Vec3): Vec3 {
  return apply(GALACTIC_TO_SG, vector);
}

/** Rigid rotation only: no translation, scaling, distance inference or unit conversion. */
export function rotateIcrsVector(vector: Vec3, frame: ObserverFrame): Vec3 {
  if (frame === "ICRS") return vector;
  const galactic = apply(ICRS_TO_GALACTIC, vector);
  return frame === "GALACTIC"
    ? galactic
    : galacticVectorToSupergalactic(galactic);
}

export function rotateFrameToIcrs(vector: Vec3, frame: ObserverFrame): Vec3 {
  if (frame === "ICRS") return vector;
  const galactic =
    frame === "GALACTIC" ? vector : inverse(GALACTIC_TO_SG, vector);
  return inverse(ICRS_TO_GALACTIC, galactic);
}

export function observerAxisLabels(
  frame: ObserverFrame,
): readonly [string, string, string] {
  if (frame === "SUPERGALACTIC") return ["SGX", "SGY", "SGZ"];
  if (frame === "GALACTIC") return ["GX", "GY", "GZ"];
  return ["X", "Y", "Z"];
}

/**
 * Mathematical placement of a supplied positive distance in an observer-centred frame.
 * Not a distance-quality classifier or scientific eligibility check. Callers MUST
 * retain distance provenance and exclude or explicitly label schematic estimates.
 * Null or invalid distances never become the origin. The origin is the observer.
 */
export function observerCartesianMpc(
  sky: Icrs,
  distanceMpc: number | null,
  frame: ObserverFrame,
): Vec3 | null {
  const icrs = cartesianMpc(sky, distanceMpc);
  if (icrs === null) return null;
  const position = rotateIcrsVector(icrs, frame);
  return position.every(Number.isFinite) ? position : null;
}
