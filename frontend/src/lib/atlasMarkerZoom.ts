import type { CatalogObject } from "../api/objects.ts";

type Project = (ra: number, dec: number) => readonly number[] | null;

/** Resolve a double click against marker positions, never against empty sky. */
export function nearestMarkerAtPixel(
  objects: readonly CatalogObject[],
  project: Project,
  x: number,
  y: number,
  tolerancePixels = 13,
): CatalogObject | null {
  let nearest: CatalogObject | null = null;
  let distance2 = tolerancePixels * tolerancePixels;
  for (const object of objects) {
    if (
      object.ra === null ||
      object.dec === null ||
      !Number.isFinite(object.ra) ||
      !Number.isFinite(object.dec)
    )
      continue;
    const pixel = project(object.ra, object.dec);
    if (!pixel || pixel.length < 2) continue;
    const [px, py] = pixel;
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const d2 = (px - x) ** 2 + (py - y) ** 2;
    if (d2 <= distance2) {
      nearest = object;
      distance2 = d2;
    }
  }
  return nearest;
}

/** Deliberately broad field, with more context for angularly extended galaxies. */
export function overviewMarkerZoomFov(object: CatalogObject): number {
  const a26 = object.a26_arcmin;
  const majorDeg =
    typeof a26 === "number" && Number.isFinite(a26) && a26 > 0
      ? (2 * a26) / 60
      : 0; // a26 is semimajor radius in arcminutes
  return Math.max(6, Math.min(15, 8 * majorDeg));
}
