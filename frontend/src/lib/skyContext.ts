import type { CatalogObject } from "../api/objects.ts";

export type SkyCenter = { ra: number; dec: number };

/** Great-circle separation, robust at the RA=0/360 seam and near the poles. */
export function angularSeparationDegrees(a: SkyCenter, b: SkyCenter): number {
  const toRad = Math.PI / 180;
  const raDelta = (a.ra - b.ra) * toRad;
  const decDelta = (a.dec - b.dec) * toRad;
  const h =
    Math.sin(decDelta / 2) ** 2 +
    Math.cos(a.dec * toRad) *
      Math.cos(b.dec * toRad) *
      Math.sin(raDelta / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))) / toRad;
}

/** Only sky neighbors within an inclusive great-circle radius of the target. */
export function otherSkyObjects(
  objects: readonly CatalogObject[],
  selectedPgc: number,
  center: SkyCenter | null,
  radiusDegrees = 10,
): CatalogObject[] {
  if (
    center === null ||
    !Number.isFinite(center.ra) ||
    !Number.isFinite(center.dec) ||
    Math.abs(center.dec) > 90 ||
    !Number.isFinite(radiusDegrees) ||
    radiusDegrees <= 0
  ) {
    return [];
  }
  const seen = new Set<number>([selectedPgc]);
  return objects.filter((object) => {
    if (
      seen.has(object.pgc) ||
      object.ra === null ||
      object.dec === null ||
      !Number.isFinite(object.ra) ||
      !Number.isFinite(object.dec) ||
      object.dec < -90 ||
      object.dec > 90 ||
      angularSeparationDegrees(center, { ra: object.ra, dec: object.dec }) >
        radiusDegrees
    ) {
      return false;
    }
    seen.add(object.pgc);
    return true;
  });
}
