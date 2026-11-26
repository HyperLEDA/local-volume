import {
  radialPeculiarVelocity,
  type EnvironmentPoint,
} from "./spatialEnvironment.ts";

export type RadialVectorScope = "off" | "selected" | "all";
export type PeculiarVelocityConfig = {
  hubble: number;
  scope: RadialVectorScope;
  mpcPer100: number;
  thresholdKms: number;
};
export const DEFAULT_PECULIAR_CONFIG: PeculiarVelocityConfig = {
  hubble: 70,
  scope: "off",
  mpcPer100: 0.5,
  thresholdKms: 0,
};
export const PECULIAR_NEGATIVE_COLOR = "#407acb";
export const PECULIAR_POSITIVE_COLOR = "#ca7040";
export type PeculiarPoint = EnvironmentPoint & {
  distanceMpc: number | null | undefined;
  velocityLgKms: number | null | undefined;
};
export type RadialArrow = {
  pgc: number;
  velocityKms: number;
  segments: readonly number[];
};

export function decodePeculiarConfig(
  raw: unknown,
): PeculiarVelocityConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const { hubble, scope, mpcPer100, thresholdKms } = r;
  if (
    typeof hubble !== "number" ||
    !Number.isFinite(hubble) ||
    hubble < 1 ||
    hubble > 200 ||
    (scope !== "off" && scope !== "selected" && scope !== "all") ||
    typeof mpcPer100 !== "number" ||
    !Number.isFinite(mpcPer100) ||
    mpcPer100 < 0.01 ||
    mpcPer100 > 2 ||
    typeof thresholdKms !== "number" ||
    !Number.isFinite(thresholdKms) ||
    thresholdKms < 0 ||
    thresholdKms > 2000
  )
    return null;
  return { hubble, scope, mpcPer100, thresholdKms };
}

/** Input is the independently eligible catalogue sample, before spatial/population cuts. */
export function peculiarValues(
  points: readonly PeculiarPoint[],
  hubble: number,
): Map<number, number> {
  const values = new Map<number, number>();
  if (!Number.isFinite(hubble) || hubble < 1 || hubble > 200) return values;
  const counts = new Map<number, number>();
  for (const p of points) counts.set(p.pgc, (counts.get(p.pgc) ?? 0) + 1);
  for (const p of points) {
    if (
      !Number.isSafeInteger(p.pgc) ||
      p.pgc <= 0 ||
      counts.get(p.pgc) !== 1 ||
      !p.position.every(Number.isFinite) ||
      Math.hypot(...p.position) <= 0
    )
      continue;
    const value = radialPeculiarVelocity(
      p.velocityLgKms,
      p.distanceMpc,
      hubble,
    );
    if (value !== null) values.set(p.pgc, value);
  }
  return values;
}

/** A shaft and four head wings in Mpc display units. Direction is observer radial, not a trajectory. */
export function radialArrows(
  points: readonly EnvironmentPoint[],
  values: ReadonlyMap<number, number>,
  config: PeculiarVelocityConfig | null,
  selectedPgc: number | null,
): RadialArrow[] {
  if (!config || !decodePeculiarConfig(config) || config.scope === "off")
    return [];
  const result: RadialArrow[] = [];
  const counts = new Map<number, number>();
  for (const p of points) counts.set(p.pgc, (counts.get(p.pgc) ?? 0) + 1);
  for (const p of points) {
    if (
      counts.get(p.pgc) !== 1 ||
      (config.scope === "selected" && p.pgc !== selectedPgc)
    )
      continue;
    const velocityKms = values.get(p.pgc);
    const norm = Math.hypot(...p.position);
    if (
      velocityKms === undefined ||
      !Number.isFinite(velocityKms) ||
      velocityKms === 0 ||
      Math.abs(velocityKms) < config.thresholdKms ||
      !Number.isFinite(norm) ||
      norm <= 0
    )
      continue;
    const length = (Math.abs(velocityKms) / 100) * config.mpcPer100;
    const [x, y, z] = p.position;
    const sign = Math.sign(velocityKms);
    const ux = (sign * x) / norm,
      uy = (sign * y) / norm,
      uz = (sign * z) / norm;
    const tip = [x + ux * length, y + uy * length, z + uz * length];
    // Choose an auxiliary axis away from the radial direction, then form an orthogonal head basis.
    const ax = Math.abs(uz) < 0.9 ? uy : -uz;
    const ay = Math.abs(uz) < 0.9 ? -ux : 0;
    const az = Math.abs(uz) < 0.9 ? 0 : ux;
    const aNorm = Math.hypot(ax, ay, az);
    const vx = ax / aNorm,
      vy = ay / aNorm,
      vz = az / aNorm;
    const wx = uy * vz - uz * vy,
      wy = uz * vx - ux * vz,
      wz = ux * vy - uy * vx;
    const head = Math.min(length * 0.25, 0.15);
    const base = [tip[0] - ux * head, tip[1] - uy * head, tip[2] - uz * head];
    const segments = [...p.position, ...tip];
    for (const [dx, dy, dz] of [
      [vx, vy, vz],
      [-vx, -vy, -vz],
      [wx, wy, wz],
      [-wx, -wy, -wz],
    ]) {
      segments.push(
        ...tip,
        base[0] + dx * head * 0.5,
        base[1] + dy * head * 0.5,
        base[2] + dz * head * 0.5,
      );
    }
    if (
      segments.every(Number.isFinite) &&
      segments.every((value) => Math.abs(value) <= 1e9)
    )
      result.push({ pgc: p.pgc, velocityKms, segments });
  }
  return result;
}
