import type { CatalogObjectDetail } from "../api/objects.ts";

const DEFAULT_FOV_DEGREES = 1;
// Application safety guards, not scientifically meaningful cut-offs on a26.
// Normal positive diameters, including galaxies smaller than 1.5', are exact.
const MIN_DISPLAY_FOV_DEGREES = 0.0001;
const MAX_DISPLAY_FOV_DEGREES = 60;
const ARCMINUTES_PER_DEGREE = 60;
const FOV_TOLERANCE_FRACTION = 0.015;

export type ObjectFovDecision = {
  degrees: number;
  exactA26: boolean;
  note: string | null;
};

/**
 * a26_arcmin is the adopted Holmberg MAJOR DIAMETER, not a semimajor axis.
 * For every supported diameter the square field side is exactly a26 / 60 deg.
 * Missing/invalid or exceptionally extreme values receive an explicit fallback.
 */
export function objectFovDecision(
  object: Pick<CatalogObjectDetail, "a26_arcmin">,
): ObjectFovDecision {
  const diameter = object.a26_arcmin;
  if (
    typeof diameter !== "number" ||
    !Number.isFinite(diameter) ||
    diameter <= 0
  ) {
    return {
      degrees: DEFAULT_FOV_DEGREES,
      exactA26: false,
      note: "Adopted a26 is unavailable; requesting a default 1° sky field.",
    };
  }
  const requested = diameter / ARCMINUTES_PER_DEGREE;
  if (requested < MIN_DISPLAY_FOV_DEGREES) {
    return {
      degrees: MIN_DISPLAY_FOV_DEGREES,
      exactA26: false,
      note: "Adopted a26 is below the application display guard; the FoV is limited to 0.0001°.",
    };
  }
  if (requested > MAX_DISPLAY_FOV_DEGREES) {
    return {
      degrees: MAX_DISPLAY_FOV_DEGREES,
      exactA26: false,
      note: "Adopted a26 exceeds the application display guard; the FoV is limited to 60°.",
    };
  }
  return { degrees: requested, exactA26: true, note: null };
}

export function objectFovDegrees(
  object: Pick<CatalogObjectDetail, "a26_arcmin">,
): number {
  return objectFovDecision(object).degrees;
}

// Compare the requested angular width to the value actually reported by Aladin.
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
