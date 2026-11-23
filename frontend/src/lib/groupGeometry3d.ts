export type DistanceOrigin =
  "DIRECT_MEASURED" | "GROUP_ASSIGNED" | "MODEL_INFERRED" | "UNKNOWN";

export type Icrs = { ra: number | null; dec: number | null };
export type Vec3 = readonly [number, number, number];
export type MeasuredPosition = Icrs & {
  distanceMpc: number | null;
  distanceOrigin: DistanceOrigin;
};
export type DistanceInterval = {
  minusMpc: number | null;
  plusMpc: number | null;
};

const RAD = Math.PI / 180;
const DIRECT =
  /trgb|tip of the red giant|cepheid|\bsbf\b|surface brightness fluctuation|maser|rr\s*lyrae|tully[ -]?fisher|\bpnlf\b|eclipsing binar/i;
const GROUP = /group|membership|member|assigned|assumed|host distance|suite/i;
const MODEL =
  /hubble|kinematic|redshift|velocity distance|model|flow distance/i;

export function validDistance(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// The method is a conservative category hint, not independent verification of its reference.
export function distanceOrigin(
  distanceMpc: number | null | undefined,
  method: string | null | undefined,
): DistanceOrigin {
  if (!validDistance(distanceMpc) || !method?.trim()) return "UNKNOWN";
  const flags = [DIRECT.test(method), GROUP.test(method), MODEL.test(method)];
  if (flags.filter(Boolean).length !== 1) return "UNKNOWN";
  if (flags[1]) return "GROUP_ASSIGNED";
  if (flags[2]) return "MODEL_INFERRED";
  return "DIRECT_MEASURED";
}

export function unitDirection({ ra, dec }: Icrs): Vec3 | null {
  if (
    ra === null ||
    dec === null ||
    !Number.isFinite(ra) ||
    !Number.isFinite(dec) ||
    dec < -90 ||
    dec > 90
  )
    return null;
  const a = (ra % 360) * RAD;
  const d = dec * RAD;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function angularSeparationDeg(a: Icrs, b: Icrs): number | null {
  const u = unitDirection(a),
    v = unitDirection(b);
  if (!u || !v) return null;
  const normal = cross(u, v);
  return Math.atan2(Math.hypot(...normal), dot(u, v)) / RAD;
}

export function cartesianMpc(
  point: Icrs,
  distanceMpc: number | null,
): Vec3 | null {
  const u = unitDirection(point);
  if (!u || !validDistance(distanceMpc)) return null;
  return [u[0] * distanceMpc, u[1] * distanceMpc, u[2] * distanceMpc];
}

// East, north, positive-away-from-observer LOS; origin is the selected measured centre.
export function groupCenteredKpc(
  centre: MeasuredPosition,
  member: MeasuredPosition,
): Vec3 | null {
  if (
    centre.distanceOrigin !== "DIRECT_MEASURED" ||
    member.distanceOrigin !== "DIRECT_MEASURED"
  )
    return null;
  const c = cartesianMpc(centre, centre.distanceMpc);
  const p = cartesianMpc(member, member.distanceMpc);
  const u = unitDirection(centre);
  if (!c || !p || !u || centre.ra === null || centre.dec === null) return null;
  const a = (centre.ra % 360) * RAD;
  const d = centre.dec * RAD;
  const east: Vec3 = [-Math.sin(a), Math.cos(a), 0];
  const north: Vec3 = [
    -Math.sin(d) * Math.cos(a),
    -Math.sin(d) * Math.sin(a),
    Math.cos(d),
  ];
  const delta: Vec3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  return [
    1000 * dot(delta, east),
    1000 * dot(delta, north),
    1000 * dot(delta, u),
  ];
}

export function pairSeparationMpc(
  a: MeasuredPosition,
  b: MeasuredPosition,
): number | null {
  if (
    a.distanceOrigin !== "DIRECT_MEASURED" ||
    b.distanceOrigin !== "DIRECT_MEASURED"
  )
    return null;
  const v1 = cartesianMpc(a, a.distanceMpc);
  const v2 = cartesianMpc(b, b.distanceMpc);
  if (!v1 || !v2) return null;
  return Math.hypot(v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]);
}

// Conservative extrema over the two reported distance intervals, without a
// Gaussian interpretation, independence assumption, or joint-confidence claim.
export function pairSeparationIntervalMpc(
  a: MeasuredPosition & DistanceInterval,
  b: MeasuredPosition & DistanceInterval,
): readonly [number, number] | null {
  if (
    a.distanceOrigin !== "DIRECT_MEASURED" ||
    b.distanceOrigin !== "DIRECT_MEASURED" ||
    !validDistance(a.distanceMpc) ||
    !validDistance(b.distanceMpc)
  )
    return null;
  const e = [a.minusMpc, a.plusMpc, b.minusMpc, b.plusMpc];
  if (e.some((v) => v === null || !Number.isFinite(v) || v < 0)) return null;
  const minusA = a.minusMpc!,
    plusA = a.plusMpc!;
  const minusB = b.minusMpc!,
    plusB = b.plusMpc!;
  const loA = a.distanceMpc - minusA,
    hiA = a.distanceMpc + plusA;
  const loB = b.distanceMpc - minusB,
    hiB = b.distanceMpc + plusB;
  if (loA <= 0 || loB <= 0) return null;
  const psi = angularSeparationDeg(a, b);
  if (psi === null) return null;
  const cos = Math.cos(psi * RAD);
  function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
  }
  const candidates: [number, number][] = [
    [loA, loB],
    [loA, hiB],
    [hiA, loB],
    [hiA, hiB],
    [loA, clamp(loA * cos, loB, hiB)],
    [hiA, clamp(hiA * cos, loB, hiB)],
    [clamp(loB * cos, loA, hiA), loB],
    [clamp(hiB * cos, loA, hiA), hiB],
  ];
  const values = candidates.map(([d1, d2]) =>
    Math.sqrt(Math.max(0, (d1 - d2) ** 2 + 2 * d1 * d2 * (1 - cos))),
  );
  return [Math.min(...values), Math.max(...values)];
}
