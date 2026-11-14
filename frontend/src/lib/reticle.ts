import type { CatalogObject } from "../api/objects.ts";
import { OVERVIEW_MARKER_MAX_DIAMETER } from "./overviewMarkers.ts";

type ReticleObject = Pick<CatalogObject, "pgc" | "ra" | "dec" | "bt" | "b_mag">;
type Pixel = readonly [number, number] | null;

const MAX_AUTOMATIC_POPUP_FOV_DEGREES = 60;

// Aladin's getFov() reports the horizontal and vertical angular extents.
export function reticlePopupAllowed(fov: readonly [number, number]): boolean {
  const [horizontal, vertical] = fov;
  return (
    Number.isFinite(horizontal) &&
    Number.isFinite(vertical) &&
    horizontal > 0 &&
    vertical > 0 &&
    Math.max(horizontal, vertical) <= MAX_AUTOMATIC_POPUP_FOV_DEGREES
  );
}

export function markerDiameter(bt: number | null, maxDiameter = 18): number {
  if (bt === null || !Number.isFinite(bt)) {
    return 7;
  }
  const logFluxRatio = 0.4 * (17 - bt);
  return Math.round(Math.min(maxDiameter, Math.max(7, 7 + 3 * logFluxRatio)));
}

function projectSafely(
  world2pix: (ra: number, dec: number) => Pixel,
  ra: number,
  dec: number,
): Pixel {
  try {
    return world2pix(ra, dec);
  } catch {
    return null;
  }
}

export function findReticleTarget<T extends ReticleObject>(
  objects: readonly T[],
  viewport: readonly [number, number],
  world2pix: (ra: number, dec: number) => Pixel,
  activePgc: number | null = null,
): T | null {
  const [width, height] = viewport;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  let closest: T | null = null;
  let minDistance = Number.POSITIVE_INFINITY;
  let retained: T | null = null;

  for (const object of objects) {
    if (
      object.ra === null ||
      object.dec === null ||
      !Number.isFinite(object.ra) ||
      !Number.isFinite(object.dec)
    ) {
      continue;
    }

    const pixel = projectSafely(world2pix, object.ra, object.dec);
    if (!pixel || !Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) {
      continue;
    }

    const distance = Math.hypot(pixel[0] - centerX, pixel[1] - centerY);
    const tolerance =
      markerDiameter(object.b_mag ?? null, OVERVIEW_MARKER_MAX_DIAMETER) / 2 +
      3;
    if (object.pgc === activePgc && distance <= tolerance + 8) {
      retained = object;
    }
    if (distance <= tolerance && distance < minDistance) {
      closest = object;
      minDistance = distance;
    }
  }

  return retained ?? closest;
}
