/** Stroke width uses the unfiltered, freshness-gated physical catalogue range. */
export function tidalStrokeWidth(
  value: unknown,
  min?: unknown,
  max?: unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    typeof min !== "number" ||
    !Number.isFinite(min) ||
    typeof max !== "number" ||
    !Number.isFinite(max) ||
    max <= min
  )
    return 1.5;
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)));
  if (fraction <= 0) return 1.2;
  if (fraction >= 1) return 2.2;
  return 1.2 + 1.0 * fraction;
}
