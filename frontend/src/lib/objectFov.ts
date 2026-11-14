import type { CatalogObjectDetail } from "../api/objects.ts";

const DEFAULT_FOV_DEGREES = 1;
const MIN_FOV_DEGREES = 0.025;
const MAX_FOV_DEGREES = 60;
const ANGULAR_DIAMETER_MARGIN = 1.5;
const ARCMINUTES_PER_DEGREE = 60;
const FOV_TOLERANCE_FRACTION = 0.08;

/**
 * a26_arcmin is the LVGDB Holmberg MAJOR DIAMETER, not a radius.
 * Field width = 1.5 * diameter => a 50% margin beyond each angular radius.
 * Missing/invalid a26 uses a stable 1-degree FOV, never legacy a50/b50.
 */
export function objectFovDegrees(
  object: Pick<CatalogObjectDetail, "a26_arcmin">,
): number {
  const diameter = object.a26_arcmin;
  if (
    typeof diameter !== "number" ||
    !Number.isFinite(diameter) ||
    diameter <= 0
  ) {
    return DEFAULT_FOV_DEGREES;
  }
  const requested =
    (diameter * ANGULAR_DIAMETER_MARGIN) / ARCMINUTES_PER_DEGREE;
  return Math.min(MAX_FOV_DEGREES, Math.max(MIN_FOV_DEGREES, requested));
}
// Compare the requested initial horizontal field to the field actually shown by Aladin.
// A small tolerance avoids unnecessary zoom updates due to floating-point geometry.
export function needsInitialFovCorrection(
  actualDegrees: number,
  requestedDegrees: number,
): boolean {
  return (
    Number.isFinite(actualDegrees) &&
    actualDegrees > 0 &&
    Number.isFinite(requestedDegrees) &&
    requestedDegrees > 0 &&
    Math.abs(actualDegrees - requestedDegrees) / requestedDegrees >
      FOV_TOLERANCE_FRACTION
  );
}
