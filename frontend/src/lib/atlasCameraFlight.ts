export const ATLAS_FOCUS_DURATION_MS = 620;

/** Bounded smoothstep with zero speed at both ends. */
export function atlasFlightProgress(elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / ATLAS_FOCUS_DURATION_MS));
  return t * t * (3 - 2 * t);
}

/** Interpolate positive scales multiplicatively rather than jumping in zoom. */
export function atlasFlightScale(
  from: number,
  to: number,
  progress: number,
): number {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  return Math.exp(Math.log(from) * (1 - progress) + Math.log(to) * progress);
}
