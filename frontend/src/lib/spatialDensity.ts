import {
  uniqueEnvironmentPoints,
  type EnvironmentPoint,
} from "./spatialEnvironment.ts";

export type DensityMethod = "radius" | "knn";
export type DensityConfig = {
  method: DensityMethod;
  radiusMpc: number;
  k: number;
  includeBoundary: boolean;
};
export const DEFAULT_DENSITY_CONFIG: DensityConfig = {
  method: "radius",
  radiusMpc: 1,
  k: 5,
  includeBoundary: false,
};
export type DensityEstimate = {
  densityPerMpc3: number;
  supportRadiusMpc: number;
  neighbourCount: number;
  boundaryClipped: boolean;
};
export type DensityMap = {
  estimates: ReadonlyMap<number, DensityEstimate>;
  values: ReadonlyMap<number, number>;
  eligibleCount: number;
  boundaryCount: number;
};
export function decodeDensityConfig(raw: unknown): DensityConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    (r.method !== "radius" && r.method !== "knn") ||
    typeof r.radiusMpc !== "number" ||
    !Number.isFinite(r.radiusMpc) ||
    r.radiusMpc < 0.01 ||
    r.radiusMpc > 100 ||
    typeof r.k !== "number" ||
    !Number.isInteger(r.k) ||
    r.k < 2 ||
    r.k > 50 ||
    typeof r.includeBoundary !== "boolean"
  )
    return null;
  return {
    method: r.method,
    radiusMpc: r.radiusMpc,
    k: r.k,
    includeBoundary: r.includeBoundary,
  };
}

/** Observed sample density, no mask/completeness correction or distance-error propagation. */
export function spatialDensity(
  points: readonly EnvironmentPoint[],
  config: DensityConfig,
  volumeRadiusMpc: number | null,
): DensityMap {
  const estimates = new Map<number, DensityEstimate>();
  const values = new Map<number, number>();
  const eligible = uniqueEnvironmentPoints(points);
  let boundaryCount = 0;
  if (
    !decodeDensityConfig(config) ||
    (volumeRadiusMpc !== null &&
      (!Number.isFinite(volumeRadiusMpc) || volumeRadiusMpc <= 0))
  )
    return { estimates, values, eligibleCount: eligible.length, boundaryCount };
  for (const target of eligible) {
    let neighbourCount = 0;
    let supportRadiusMpc = config.radiusMpc;
    const distances: number[] = [];
    for (const point of eligible) {
      if (point.pgc === target.pgc) continue;
      const distance = Math.hypot(
        point.position[0] - target.position[0],
        point.position[1] - target.position[1],
        point.position[2] - target.position[2],
      );
      if (!Number.isFinite(distance)) continue;
      if (config.method === "radius") {
        if (distance <= supportRadiusMpc) neighbourCount += 1;
      } else distances.push(distance);
    }
    if (config.method === "knn") {
      if (distances.length < config.k) continue;
      distances.sort((a, b) => a - b);
      supportRadiusMpc = distances[config.k - 1];
      neighbourCount = config.k;
    }
    const volume = (4 * Math.PI * supportRadiusMpc ** 3) / 3;
    if (!Number.isFinite(volume) || volume <= 0) continue;
    const densityPerMpc3 = neighbourCount / volume;
    if (!Number.isFinite(densityPerMpc3)) continue;
    const boundaryClipped =
      volumeRadiusMpc !== null &&
      Math.hypot(...target.position) + supportRadiusMpc > volumeRadiusMpc;
    if (boundaryClipped) boundaryCount += 1;
    estimates.set(target.pgc, {
      densityPerMpc3,
      supportRadiusMpc,
      neighbourCount,
      boundaryClipped,
    });
    if (!boundaryClipped || config.includeBoundary)
      values.set(target.pgc, densityPerMpc3);
  }
  return { estimates, values, eligibleCount: eligible.length, boundaryCount };
}
