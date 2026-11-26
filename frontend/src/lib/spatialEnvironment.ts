/** Nominal catalogue geometry. Never use assigned or model depths. */
export type EnvironmentPoint = {
  pgc: number;
  position: readonly [number, number, number];
  verified: boolean;
};
export type Neighbour = {
  pgc: number;
  separationMpc: number;
  verified: boolean;
};

function validPoint(point: EnvironmentPoint): boolean {
  return (
    Number.isSafeInteger(point.pgc) &&
    point.pgc > 0 &&
    point.position.every(Number.isFinite)
  );
}

export function uniqueEnvironmentPoints(
  points: readonly EnvironmentPoint[],
): EnvironmentPoint[] {
  const counts = new Map<number, number>();
  for (const point of points)
    counts.set(point.pgc, (counts.get(point.pgc) ?? 0) + 1);
  return points.filter(
    (point) => validPoint(point) && counts.get(point.pgc) === 1,
  );
}

export type NominalEnvironmentResult = {
  nearest: Neighbour | null;
  within: Neighbour[];
  densityPerMpc3: number;
  boundaryClipped: boolean;
  eligibleCount: number;
  targetVerified: boolean;
};

export function nominalEnvironment(
  points: readonly EnvironmentPoint[],
  targetPgc: number,
  radiusMpc: number,
  volumeRadiusMpc: number | null,
): NominalEnvironmentResult | null {
  if (
    !Number.isFinite(radiusMpc) ||
    radiusMpc <= 0 ||
    (volumeRadiusMpc !== null &&
      (!Number.isFinite(volumeRadiusMpc) || volumeRadiusMpc <= 0))
  )
    return null;
  const eligible = uniqueEnvironmentPoints(points);
  const target = eligible.find((point) => point.pgc === targetPgc);
  if (!target) return null;
  const neighbours: Neighbour[] = [];
  for (const point of eligible) {
    if (point.pgc === targetPgc) continue;
    const separationMpc = Math.hypot(
      point.position[0] - target.position[0],
      point.position[1] - target.position[1],
      point.position[2] - target.position[2],
    );
    if (Number.isFinite(separationMpc))
      neighbours.push({
        pgc: point.pgc,
        separationMpc,
        verified: point.verified && target.verified,
      });
  }
  neighbours.sort((a, b) => a.separationMpc - b.separationMpc || a.pgc - b.pgc);
  const within = neighbours.filter((point) => point.separationMpc <= radiusMpc);
  const volume = (4 * Math.PI * radiusMpc ** 3) / 3;
  if (!Number.isFinite(volume) || volume <= 0) return null;
  const [nearest = null] = neighbours;
  return {
    nearest,
    within,
    densityPerMpc3: within.length / volume,
    boundaryClipped:
      volumeRadiusMpc !== null &&
      Math.hypot(...target.position) + radiusMpc > volumeRadiusMpc,
    eligibleCount: eligible.length,
    targetVerified: target.verified,
  };
}

export function radialPeculiarVelocity(
  velocityLgKms: number | null | undefined,
  distanceMpc: number | null | undefined,
  hubbleKmsPerMpc: number,
): number | null {
  if (
    typeof velocityLgKms !== "number" ||
    !Number.isFinite(velocityLgKms) ||
    typeof distanceMpc !== "number" ||
    !Number.isFinite(distanceMpc) ||
    distanceMpc <= 0 ||
    !Number.isFinite(hubbleKmsPerMpc) ||
    hubbleKmsPerMpc <= 0
  )
    return null;
  const residual = velocityLgKms - hubbleKmsPerMpc * distanceMpc;
  return Number.isFinite(residual) ? residual : null;
}
