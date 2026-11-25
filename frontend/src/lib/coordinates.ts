/**
 * Presentation-only ICRS -> Galactic -> Supergalactic coordinates.
 *
 * The ICRS/Galactic matrix uses the J2000 Galactic rotation employed by
 * astronomy software (Hipparcos/IAU convention). Supergalactic coordinates
 * use the conventional pole (l=47.37 deg, b=+6.32 deg) and SGL=0 direction
 * (l=137.37 deg, b=0 deg). No catalog coordinates are modified.
 */
import { unitDirection } from "./groupGeometry3d.ts";
import {
  galacticVectorToSupergalactic,
  rotateIcrsVector,
} from "./spatialFrames.ts";

export type AngularPosition = { longitude: number; latitude: number };

const TO_DEG = 180 / Math.PI;

function longitudeDegrees(y: number, x: number): number {
  return (((Math.atan2(y, x) * TO_DEG) % 360) + 360) % 360;
}

function latitudeDegrees(z: number): number {
  return Math.asin(Math.min(1, Math.max(-1, z))) * TO_DEG;
}

export function icrsToGalactic(
  ra: number,
  dec: number,
): AngularPosition | null {
  const vector = unitDirection({ ra, dec });
  if (vector === null) return null;
  const result = rotateIcrsVector(vector, "GALACTIC");
  return {
    longitude: longitudeDegrees(result[1], result[0]),
    latitude: latitudeDegrees(result[2]),
  };
}

export function galacticToSupergalactic(
  galactic: AngularPosition,
): AngularPosition | null {
  const vector = unitDirection({
    ra: galactic.longitude,
    dec: galactic.latitude,
  });
  if (vector === null) return null;
  const result = galacticVectorToSupergalactic(vector);
  return {
    longitude: longitudeDegrees(result[1], result[0]),
    latitude: latitudeDegrees(result[2]),
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
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees))
    return "—";
  const centiseconds =
    Math.round((((degrees % 360) + 360) % 360) * 24000) % 8640000;
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = ((centiseconds % 6000) / 100).toFixed(2).padStart(5, "0");
  return `${pad2(hours)}h ${pad2(minutes)}m ${seconds}s`;
}

/** Formats declination to 0.1 arcseconds, retaining negative zero. */
export function formatDecDms(degrees: number | null | undefined): string {
  if (
    degrees === null ||
    degrees === undefined ||
    !Number.isFinite(degrees) ||
    Math.abs(degrees) > 90
  )
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
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees))
    return "—";
  const rounded = Number(degrees.toFixed(digits));
  const sign = signed
    ? degrees < 0 || Object.is(degrees, -0)
      ? "−"
      : "+"
    : "";
  const magnitude = signed ? Math.abs(rounded) : rounded;
  return `${sign}${magnitude.toFixed(digits)}°`;
}
