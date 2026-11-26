import type {
  EnvironmentPoint,
  NominalEnvironmentResult,
} from "./spatialEnvironment.ts";

type Position = EnvironmentPoint["position"];
export type EnvironmentOverlay = {
  centre: Position;
  radiusMpc: number;
  neighbours: readonly EnvironmentPoint[];
  nearest: EnvironmentPoint | null;
};

/** Only render actual displayed positions; the calculation sample is unchanged. */
export function environmentOverlay(
  visible: readonly EnvironmentPoint[],
  targetPgc: number,
  radiusMpc: number,
  result: NominalEnvironmentResult | null,
): EnvironmentOverlay | null {
  if (!result || !Number.isFinite(radiusMpc) || radiusMpc <= 0) return null;
  const target = visible.find((point) => point.pgc === targetPgc);
  if (!target) return null;
  const ids = new Set(result.within.map((point) => point.pgc));
  const nearestPgc = result.nearest?.pgc;
  return {
    centre: target.position,
    radiusMpc,
    neighbours: visible.filter((point) => ids.has(point.pgc)),
    nearest: visible.find((point) => point.pgc === nearestPgc) ?? null,
  };
}
