/**
 * Muted, six-bin morphological color scheme for the full-sky LV overview.
 * Earlier types (T < 0) are red, later types (T > 0) are blue.
 * T = 0 has a distinct muted transitional hue; missing T remains neutral gray.
 */
export const UNKNOWN_MORPHOLOGY_COLOR = "#919aa3";

const EARLY_RED = "#ac5e65";
const EARLY_DUSTY_RED = "#bb7f83";
const TRANSITIONAL = "#88828f";
const EARLY_BLUE = "#7896a8";
const LATE_BLUE = "#6389a9";
const VERY_LATE_BLUE = "#47749b";

export function morphologyColor(type: unknown): string {
  if (typeof type !== "number" || !Number.isFinite(type)) {
    return UNKNOWN_MORPHOLOGY_COLOR;
  }
  if (type <= -3) return EARLY_RED;
  if (type < 0) return EARLY_DUSTY_RED;
  if (type === 0) return TRANSITIONAL;
  if (type <= 3) return EARLY_BLUE;
  if (type <= 7) return LATE_BLUE;
  return VERY_LATE_BLUE;
}

// Legacy exported gradient. Not displayed on the full-sky map; marker colors
// themselves are intentionally discrete (including the non-white T=0 bin).
export const MORPHOLOGY_GRADIENT = `linear-gradient(to right, ${[
  EARLY_RED,
  EARLY_DUSTY_RED,
  TRANSITIONAL,
  EARLY_BLUE,
  LATE_BLUE,
  VERY_LATE_BLUE,
].join(", ")})`;
