/**
 * Preparation for Issue #66. No PA is currently ingested into LV LEDA.
 *
 * Only a verified B-band 26.5 mag/arcsec² isophote may be represented
 * as a Holmberg ellipse. a26 is the FULL major-axis diameter, not a radius.
 * Axis ratio and position angle must describe the same isophote.
 *
 * The future ingestion layer must explicitly certify these definitions.
 * A PA from D25, NIR ellipse fitting, etc. is NOT PA26: a proxy would require
 * a separate scientific status and UI, which are intentionally deferred.
 */
export type VerifiedPa26 = {
  angleDeg: number;
  convention: "north-through-east";
  band: "B";
  isophoteMagArcsec2: 26.5;
  sourceId: string;
};

export type HolmbergEllipseInput = {
  raDeg: number | null;
  decDeg: number | null;
  a26Arcmin: number | null;
  axisRatio: number | null;
  /** Must be confirmed from the adopted source; never assume from column name. */
  axisRatioIsophote: "B26.5" | "other" | "unknown";
  positionAngle: VerifiedPa26 | null;
};

export type HolmbergEllipse = {
  majorDiameterArcmin: number;
  minorDiameterArcmin: number;
  positionAngleDeg: number;
  positionAngleSource: string;
  /** Closed sky-coordinate polyline, ICRS degrees, suitable for Aladin. */
  vertices: [raDeg: number, decDeg: number][];
};

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const SEGMENTS = 128;

/**
 * Map an offset in the local east/north tangent plane onto the celestial sphere.
 * Offsets are geodesic angular distances in radians, not RA/Dec differences.
 * This remains finite near celestial poles and across the RA=0 meridian.
 */
function tangentToSky(
  raDeg: number,
  decDeg: number,
  eastRad: number,
  northRad: number,
): [number, number] {
  const distance = Math.hypot(eastRad, northRad);
  if (distance === 0) return [raDeg, decDeg];

  const dec = decDeg * DEG;
  const sinDistance = Math.sin(distance);
  const northShare = northRad / distance;
  const eastShare = eastRad / distance;
  const destinationDec = Math.asin(
    Math.max(
      -1,
      Math.min(
        1,
        Math.sin(dec) * Math.cos(distance) +
          Math.cos(dec) * sinDistance * northShare,
      ),
    ),
  );
  const deltaRa = Math.atan2(
    sinDistance * eastShare,
    Math.cos(dec) * Math.cos(distance) -
      Math.sin(dec) * sinDistance * northShare,
  );
  const ra = (((raDeg * DEG + deltaRa) % TWO_PI) + TWO_PI) % TWO_PI;
  return [ra / DEG, destinationDec / DEG];
}

/**
 * Returns null unless *all* adopted measurements are present, valid and
 * explicitly matched to the same B26.5 isophote. No guessed PA, circular
 * fallback, pixel-fit approximation or database mutation takes place.
 *
 * The contour is an isophotal illustration, not an independent remeasurement
 * of the galaxy's true B-band surface brightness.
 */
export function holmbergEllipse(
  input: HolmbergEllipseInput,
): HolmbergEllipse | null {
  const { raDeg, decDeg, a26Arcmin, axisRatio, positionAngle } = input;
  // Values can originate from external APIs. Validate runtime fields even when
  // their compile-time contract uses literal scientific metadata.
  const paRecord = positionAngle as Record<string, unknown> | null | undefined;
  if (
    typeof raDeg !== "number" ||
    !Number.isFinite(raDeg) ||
    raDeg < 0 ||
    raDeg >= 360 ||
    typeof decDeg !== "number" ||
    !Number.isFinite(decDeg) ||
    decDeg < -90 ||
    decDeg > 90 ||
    typeof a26Arcmin !== "number" ||
    !Number.isFinite(a26Arcmin) ||
    a26Arcmin <= 0 ||
    a26Arcmin >= 10800 ||
    typeof axisRatio !== "number" ||
    !Number.isFinite(axisRatio) ||
    axisRatio <= 0 ||
    axisRatio > 1 ||
    input.axisRatioIsophote !== "B26.5" ||
    !paRecord ||
    typeof paRecord.angleDeg !== "number" ||
    !Number.isFinite(paRecord.angleDeg) ||
    paRecord.angleDeg < 0 ||
    paRecord.angleDeg >= 360 ||
    paRecord.convention !== "north-through-east" ||
    paRecord.band !== "B" ||
    paRecord.isophoteMagArcsec2 !== 26.5 ||
    typeof paRecord.sourceId !== "string" ||
    paRecord.sourceId.trim().length === 0
  ) {
    return null;
  }

  // The complete runtime record passed all scientific validation above.
  const checkedPa = paRecord as unknown as VerifiedPa26;
  // The position angle of an undirected ellipse is periodic under 180°.
  const paDeg = checkedPa.angleDeg % 180;
  const pa = paDeg * DEG;
  const majorRadius = (a26Arcmin / 2 / 60) * DEG;
  const minorRadius = majorRadius * axisRatio;
  const vertices: [number, number][] = [];

  for (let i = 0; i < SEGMENTS; i += 1) {
    const t = (TWO_PI * i) / SEGMENTS;
    const major = majorRadius * Math.cos(t);
    const minor = minorRadius * Math.sin(t);
    // PA=0: major axis points north. PA=90: major axis points east.
    const east = major * Math.sin(pa) + minor * Math.cos(pa);
    const north = major * Math.cos(pa) - minor * Math.sin(pa);
    vertices.push(tangentToSky(raDeg, decDeg, east, north));
  }
  vertices.push([...vertices[0]]);

  return {
    majorDiameterArcmin: a26Arcmin,
    minorDiameterArcmin: a26Arcmin * axisRatio,
    positionAngleDeg: paDeg,
    positionAngleSource: checkedPa.sourceId.trim(),
    vertices,
  };
}
