import type { CatalogObjectDetail } from "../api/objects.ts";

const DEFAULT_FOV_DEGREES = 1;
const MIN_FOV_DEGREES = 0.025;
const MAX_FOV_DEGREES = 6;
const CONTEXT_FACTOR = 8;
const ARCSECONDS_PER_DEGREE = 3600;
const FOV_TOLERANCE_FRACTION = 0.08;

/**
 * Choose the initial square sky field from half-light semi-axes in arcseconds.
 * The larger valid semi-axis sets the scale; 8 radii leave room around the galaxy.
 * Invalid or absent sizes preserve the former 1-degree default.
 */
export function objectFovDegrees(
  object: Pick<CatalogObjectDetail, "a50" | "b50">,
): number {
  const validAxes = [object.a50, object.b50].filter(
    (axis): axis is number =>
      typeof axis === "number" && Number.isFinite(axis) && axis > 0,
  );
  if (validAxes.length === 0) {
    return DEFAULT_FOV_DEGREES;
  }
  const requestedDegrees =
    (CONTEXT_FACTOR * Math.max(...validAxes)) / ARCSECONDS_PER_DEGREE;
  return Math.min(MAX_FOV_DEGREES, Math.max(MIN_FOV_DEGREES, requestedDegrees));
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
