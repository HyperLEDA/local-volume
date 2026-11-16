/** ICRS sky coordinates: decimal degrees or hours/sexagesimal. */
export type SkyCoordinates = { ra: number; dec: number };

const NUMBER = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
const signedDecimal = new RegExp(
  String.raw`^\s*(${NUMBER})\s*(?:,|;|\s+)\s*([+-]${NUMBER})\s*$`,
);
const simpleCommaDecimal = new RegExp(
  String.raw`^\s*(${NUMBER})\s*[,;]\s*(${NUMBER})\s*$`,
);
const simpleSpaceDecimal = new RegExp(
  String.raw`^\s*(${NUMBER})\s+(${NUMBER})\s*$`,
);
const sexagesimal =
  /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?\s+([+-])(\d{1,2}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/;
const explicitSexagesimal =
  /^(\d{1,2})h\s*(\d{1,2})m\s*(\d{1,2}(?:\.\d+)?)s\s+([+-])(\d{1,2})[d°]\s*(\d{1,2})[m′']\s*(\d{1,2}(?:\.\d+)?)[s″"]$/i;

function validDecimal(ra: number, dec: number): SkyCoordinates | null {
  return Number.isFinite(ra) &&
    Number.isFinite(dec) &&
    ra >= 0 &&
    ra < 360 &&
    dec >= -90 &&
    dec <= 90
    ? { ra, dec }
    : null;
}

/** Return null if the query is not a complete valid coordinate pair. */
export function parseSkyCoordinates(query: string): SkyCoordinates | null {
  const cleaned = query.trim().replace(/^(?:ICRS|J2000)\s+/i, "");
  const decimal =
    signedDecimal.exec(cleaned) ??
    simpleCommaDecimal.exec(cleaned) ??
    simpleSpaceDecimal.exec(cleaned);
  if (decimal) return validDecimal(Number(decimal[1]), Number(decimal[2]));

  const parts = sexagesimal.exec(cleaned) ?? explicitSexagesimal.exec(cleaned);
  if (!parts) return null;
  const [, hours, minutes, seconds, sign, degrees, arcminutes, arcseconds] =
    parts;
  const h = Number(hours);
  const m = Number(minutes);
  const s = Number(seconds || "0");
  const d = Number(degrees);
  const dm = Number(arcminutes);
  const ds = Number(arcseconds || "0");
  if (
    h > 24 ||
    m >= 60 ||
    s >= 60 ||
    d > 90 ||
    dm >= 60 ||
    ds >= 60 ||
    (h === 24 && (m !== 0 || s !== 0)) ||
    (d === 90 && (dm !== 0 || ds !== 0))
  )
    return null;
  const ra = ((h + m / 60 + s / 3600) * 15) % 360;
  const dec = (d + dm / 60 + ds / 3600) * (sign === "-" ? -1 : 1);
  return validDecimal(ra, dec);
}

/** Stable great-circle angular separation, including RA wrap and the poles. */
export function angularSeparationDeg(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const rad = Math.PI / 180;
  const phi1 = dec1 * rad;
  const phi2 = dec2 * rad;
  const dphi = (dec2 - dec1) * rad;
  const dlambda = (ra2 - ra1) * rad;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))) / rad;
}

export function isWithinSkyRadius(
  object: { ra: number | null; dec: number | null },
  center: SkyCoordinates,
  radiusArcmin: number,
): boolean {
  if (
    object.ra === null ||
    object.dec === null ||
    !Number.isFinite(object.ra) ||
    !Number.isFinite(object.dec)
  )
    return false;
  return (
    angularSeparationDeg(object.ra, object.dec, center.ra, center.dec) <=
    radiusArcmin / 60 + 1e-10
  );
}
