export const MIN_MORPHOLOGY_T = -3;
export const MAX_MORPHOLOGY_T = 10;
export const UNKNOWN_MORPHOLOGY_COLOR = "#9aa2ac";

const NEGATIVE_STRONG = "#c96d76";
const NEGATIVE_MILD = "#d99ea4";
const TRANSITION_ZERO = "#a995a6";
const POSITIVE_MILD = "#91a8c6";
const POSITIVE_MEDIUM = "#6489bc";
const POSITIVE_STRONG = "#3f6fab";

export function morphologyColor(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return UNKNOWN_MORPHOLOGY_COLOR;
  }
  if (value <= -3) {
    return NEGATIVE_STRONG;
  }
  if (value < 0) {
    return NEGATIVE_MILD;
  }
  if (value === 0) {
    return TRANSITION_ZERO;
  }
  if (value <= 3) {
    return POSITIVE_MILD;
  }
  if (value <= 7) {
    return POSITIVE_MEDIUM;
  }
  return POSITIVE_STRONG;
}

// Exported for compatibility; the global map currently hides the color bar.
export const MORPHOLOGY_GRADIENT = `linear-gradient(to right, ${[
  NEGATIVE_STRONG,
  NEGATIVE_MILD,
  TRANSITION_ZERO,
  POSITIVE_MILD,
  POSITIVE_MEDIUM,
  POSITIVE_STRONG,
].join(", ")})`;
