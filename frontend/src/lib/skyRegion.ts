import { angularSeparationDeg, type SkyCoordinates } from "./skySearch.ts";

/** Geometry is ICRS on the celestial sphere, never an Aitoff pixel rectangle. */
export type SkyRegion =
  | { kind: "circle"; center: SkyCoordinates; radiusDeg: number }
  | {
      kind: "rectangle";
      raFrom: number;
      raTo: number;
      decMin: number;
      decMax: number;
    };

const EPS = 1e-9;
const RAD = Math.PI / 180;

export function normalizedRa(ra: number): number {
  return ((ra % 360) + 360) % 360;
}

/** Validate untrusted URL data without trusting TypeScript union annotations. */
export function isValidRegion(value: unknown): value is SkyRegion {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "circle") {
    if (typeof candidate.center !== "object" || candidate.center === null)
      return false;
    const center = candidate.center as Record<string, unknown>;
    return (
      typeof center.ra === "number" &&
      Number.isFinite(center.ra) &&
      center.ra >= 0 &&
      center.ra < 360 &&
      typeof center.dec === "number" &&
      Number.isFinite(center.dec) &&
      Math.abs(center.dec) <= 90 &&
      typeof candidate.radiusDeg === "number" &&
      Number.isFinite(candidate.radiusDeg) &&
      candidate.radiusDeg > 0 &&
      candidate.radiusDeg < 180
    );
  }
  if (candidate.kind === "rectangle") {
    const { raFrom, raTo, decMin, decMax } = candidate;
    if (
      typeof raFrom !== "number" ||
      typeof raTo !== "number" ||
      typeof decMin !== "number" ||
      typeof decMax !== "number"
    )
      return false;
    return (
      [raFrom, raTo, decMin, decMax].every(Number.isFinite) &&
      raFrom >= 0 &&
      raFrom < 360 &&
      raTo >= 0 &&
      raTo < 360 &&
      decMin >= -90 &&
      decMax <= 90 &&
      decMin <= decMax &&
      normalizedRa(raTo - raFrom) > EPS
    );
  }
  return false;
}

/** RA interval follows the positive-angle direction from raFrom to raTo.
 * The interval 350°→10° correctly crosses the zero meridian. */
export function regionContains(
  r: SkyRegion | null,
  ra: number | null,
  dec: number | null,
): boolean {
  if (
    !isValidRegion(r) ||
    ra === null ||
    dec === null ||
    !Number.isFinite(ra) ||
    !Number.isFinite(dec) ||
    ra < 0 ||
    ra >= 360 ||
    Math.abs(dec) > 90
  )
    return false;
  if (r.kind === "circle") {
    const c = r;
    return (
      angularSeparationDeg(ra, dec, c.center.ra, c.center.dec) <=
      c.radiusDeg + EPS
    );
  }
  const rect = r;
  return (
    dec >= rect.decMin - EPS &&
    dec <= rect.decMax + EPS &&
    normalizedRa(ra - rect.raFrom) <=
      normalizedRa(rect.raTo - rect.raFrom) + EPS
  );
}

/** Initial result of Aladin's pixel rectangle interpreted as a short RA interval.
 * Exact selection is the *sky-coordinate* box, not the original pixel footprint. */
export function rectangleFromCorners(
  a: SkyCoordinates,
  b: SkyCoordinates,
): SkyRegion | null {
  if (![a.ra, b.ra, a.dec, b.dec].every(Number.isFinite)) return null;
  const forward = normalizedRa(b.ra - a.ra);
  if (forward < EPS || Math.abs(a.dec - b.dec) < EPS) return null;
  const raFrom = forward <= 180 ? a.ra : b.ra;
  const raTo = forward <= 180 ? b.ra : a.ra;
  const result: SkyRegion = {
    kind: "rectangle",
    raFrom: normalizedRa(raFrom),
    raTo: normalizedRa(raTo),
    decMin: Math.min(a.dec, b.dec),
    decMax: Math.max(a.dec, b.dec),
  };
  return isValidRegion(result) ? result : null;
}

/** Boundary sky positions; Aladin renders the resulting overlay in its projection. */
export function regionBoundary(r: SkyRegion, steps = 96): [number, number][] {
  if (!isValidRegion(r)) return [];
  if (r.kind === "rectangle") {
    const span = normalizedRa(r.raTo - r.raFrom);
    const points: [number, number][] = [];
    for (let k = 0; k <= steps / 4; k++) {
      const u = k / (steps / 4);
      points.push([normalizedRa(r.raFrom + span * u), r.decMin]);
    }
    for (let k = 1; k <= steps / 4; k++) {
      const u = k / (steps / 4);
      points.push([r.raTo, r.decMin + (r.decMax - r.decMin) * u]);
    }
    for (let k = 1; k <= steps / 4; k++) {
      const u = k / (steps / 4);
      points.push([normalizedRa(r.raTo - span * u), r.decMax]);
    }
    for (let k = 1; k <= steps / 4; k++) {
      const u = k / (steps / 4);
      points.push([r.raFrom, r.decMax - (r.decMax - r.decMin) * u]);
    }
    return points;
  }
  const ra0 = r.center.ra * RAD,
    dec0 = r.center.dec * RAD,
    radius = r.radiusDeg * RAD;
  const result: [number, number][] = [];
  for (let k = 0; k <= steps; k++) {
    const theta = (2 * Math.PI * k) / steps;
    const sinDec =
      Math.sin(dec0) * Math.cos(radius) +
      Math.cos(dec0) * Math.sin(radius) * Math.cos(theta);
    const dec = Math.asin(Math.min(1, Math.max(-1, sinDec)));
    const ra =
      ra0 +
      Math.atan2(
        Math.sin(theta) * Math.sin(radius) * Math.cos(dec0),
        Math.cos(radius) - Math.sin(dec0) * Math.sin(dec),
      );
    result.push([normalizedRa(ra / RAD), dec / RAD]);
  }
  return result;
}

/** Choose the RA interval whose interior contains the midpoint of the drawn screen span.
 * Unlike shortest-arc conversion this also works for wide Aitoff selections. */
export function rectangleFromScreenCorners(
  a: SkyCoordinates,
  b: SkyCoordinates,
  middle: SkyCoordinates,
): SkyRegion | null {
  if (![a.ra, a.dec, b.ra, b.dec, middle.ra, middle.dec].every(Number.isFinite))
    return null;
  if (Math.abs(a.dec - b.dec) < EPS) return null;
  const forward = normalizedRa(b.ra - a.ra);
  if (forward < EPS) return null;
  const midFromA = normalizedRa(middle.ra - a.ra);
  const raFrom = midFromA <= forward + EPS ? a.ra : b.ra;
  const raTo = midFromA <= forward + EPS ? b.ra : a.ra;
  const region: SkyRegion = {
    kind: "rectangle",
    raFrom: normalizedRa(raFrom),
    raTo: normalizedRa(raTo),
    decMin: Math.min(a.dec, b.dec),
    decMax: Math.max(a.dec, b.dec),
  };
  return isValidRegion(region) ? region : null;
}

export function describeRegion(r: SkyRegion): string {
  if (r.kind !== "circle")
    return `RA ${r.raFrom.toFixed(1)}–${r.raTo.toFixed(1)}°`;
  return r.radiusDeg >= 1
    ? `Cone · ${r.radiusDeg.toFixed(2)}°`
    : `Cone · ${(r.radiusDeg * 60).toFixed(1)}′`;
}
