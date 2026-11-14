/**
 * Presentation-only ICRS -> Galactic -> Supergalactic coordinates.
 *
 * The ICRS/Galactic matrix uses the J2000 Galactic rotation employed by
 * astronomy software (Hipparcos/IAU convention). Supergalactic coordinates
 * use the conventional pole (l=47.37 deg, b=+6.32 deg) and SGL=0 direction
 * (l=137.37 deg, b=0 deg). No catalog coordinates are modified.
 */
export type AngularPosition = { longitude: number; latitude: number };

const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;

const ICRS_TO_GALACTIC = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
] as const;

type Vector = readonly [number, number, number];

function unitVector(longitude: number, latitude: number): Vector {
  const lon = longitude * TO_RAD;
  const lat = latitude * TO_RAD;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}

function dot(a: Vector, b: Vector): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector, b: Vector): Vector {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function longitudeDegrees(y: number, x: number): number {
  return (((Math.atan2(y, x) * TO_DEG) % 360) + 360) % 360;
}

function latitudeDegrees(z: number): number {
  return Math.asin(Math.min(1, Math.max(-1, z))) * TO_DEG;
}

function validEquatorial(ra: number, dec: number): boolean {
  return Number.isFinite(ra) && Number.isFinite(dec) && dec >= -90 && dec <= 90;
}

export function icrsToGalactic(
  ra: number,
  dec: number,
): AngularPosition | null {
  if (!validEquatorial(ra, dec)) return null;
  const vector = unitVector(ra, dec);
  const result = ICRS_TO_GALACTIC.map((row) => dot(row, vector)) as number[];
  return {
    longitude: longitudeDegrees(result[1], result[0]),
    latitude: latitudeDegrees(result[2]),
  };
}

const SUPERGALACTIC_Z = unitVector(47.37, 6.32);
const SUPERGALACTIC_X = unitVector(137.37, 0);
const SUPERGALACTIC_Y = cross(SUPERGALACTIC_Z, SUPERGALACTIC_X);

export function galacticToSupergalactic(
  galactic: AngularPosition,
): AngularPosition | null {
  if (!validEquatorial(galactic.longitude, galactic.latitude)) return null;
  const vector = unitVector(galactic.longitude, galactic.latitude);
  return {
    longitude: longitudeDegrees(
      dot(vector, SUPERGALACTIC_Y),
      dot(vector, SUPERGALACTIC_X),
    ),
    latitude: latitudeDegrees(dot(vector, SUPERGALACTIC_Z)),
  };
}

export function icrsToSupergalactic(
  ra: number,
  dec: number,
): AngularPosition | null {
  const galactic = icrsToGalactic(ra, dec);
  return galactic === null ? null : galacticToSupergalactic(galactic);
}

function pad2(number: number): string {
  return String(number).padStart(2, "0");
}

/** Formats right ascension to 0.01 seconds, carrying across minute/hour edges. */
export function formatRaHms(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees)) return "—";
  const centiseconds =
    Math.round((((degrees % 360) + 360) % 360) * 24000) % 8640000;
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = ((centiseconds % 6000) / 100).toFixed(2).padStart(5, "0");
  return `${pad2(hours)}h ${pad2(minutes)}m ${seconds}s`;
}

/** Formats declination to 0.1 arcseconds, retaining negative zero. */
export function formatDecDms(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees) || Math.abs(degrees) > 90)
    return "—";
  const tenths = Math.round(Math.abs(degrees) * 36000);
  const wholeDegrees = Math.floor(tenths / 36000);
  const minutes = Math.floor((tenths % 36000) / 600);
  const seconds = ((tenths % 600) / 10).toFixed(1).padStart(4, "0");
  const sign = degrees < 0 || Object.is(degrees, -0) ? "−" : "+";
  return `${sign}${pad2(wholeDegrees)}° ${pad2(minutes)}′ ${seconds}″`;
}

export function formatDegrees(
  degrees: number | null | undefined,
  digits = 6,
  signed = false,
): string {
  if (degrees == null || !Number.isFinite(degrees)) return "—";
  const rounded = Number(degrees.toFixed(digits));
  const sign = signed
    ? degrees < 0 || Object.is(degrees, -0)
      ? "−"
      : "+"
    : "";
  const magnitude = signed ? Math.abs(rounded) : rounded;
  return `${sign}${magnitude.toFixed(digits)}°`;
}
