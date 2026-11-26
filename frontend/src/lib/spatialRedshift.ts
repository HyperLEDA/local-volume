/** Observer-direction, catalogue LG-frame velocity proxy. Not an adopted distance. */
export type SpaceMode = "real" | "matched" | "redshift";
type Position = [number, number, number];
export type RedshiftInput = {
  pgc: number;
  position: readonly [number, number, number];
  velocityLgKms: number | null | undefined;
};
export function decodeSpaceMode(value: unknown): SpaceMode {
  return value === "matched" || value === "redshift" ? value : "real";
}
/** Call with eligible individual-D points before real-space population/region cuts. */
export function matchedRedshiftPositions(
  points: readonly RedshiftInput[],
  hubble: number,
): Map<number, Position> {
  const output = new Map<number, Position>();
  if (!Number.isFinite(hubble) || hubble < 1 || hubble > 200) return output;
  const counts = new Map<number, number>();
  for (const point of points)
    counts.set(point.pgc, (counts.get(point.pgc) ?? 0) + 1);
  for (const point of points) {
    if (
      !Number.isSafeInteger(point.pgc) ||
      point.pgc <= 0 ||
      counts.get(point.pgc) !== 1
    )
      continue;
    const velocity = point.velocityLgKms;
    const norm = Math.hypot(...point.position);
    if (
      typeof velocity !== "number" ||
      !Number.isFinite(velocity) ||
      velocity <= 0 ||
      !Number.isFinite(norm) ||
      norm <= 0
    )
      continue;
    const radius = velocity / hubble;
    if (!Number.isFinite(radius) || radius <= 0 || radius > 1e9) continue;
    const [x, y, z] = point.position;
    const position: Position = [
      (x / norm) * radius,
      (y / norm) * radius,
      (z / norm) * radius,
    ];
    if (position.every(Number.isFinite)) output.set(point.pgc, position);
  }
  return output;
}
