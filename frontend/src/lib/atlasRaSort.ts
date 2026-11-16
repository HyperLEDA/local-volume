import type { CatalogObject } from "../api/objects.ts";

function validCoordinates(object: Pick<CatalogObject, "ra" | "dec">): boolean {
  return (
    typeof object.ra === "number" &&
    Number.isFinite(object.ra) &&
    object.ra >= 0 &&
    object.ra <= 360 &&
    typeof object.dec === "number" &&
    Number.isFinite(object.dec) &&
    object.dec >= -90 &&
    object.dec <= 90
  );
}

/** Grid display order only. The original selection and exports are untouched. */
export function sortObjectsByRa<
  T extends Pick<CatalogObject, "pgc" | "ra" | "dec">,
>(objects: readonly T[]): T[] {
  return [...objects].sort((a, b) => {
    const aValid = validCoordinates(a);
    const bValid = validCoordinates(b);
    if (aValid !== bValid) return aValid ? -1 : 1;
    if (!aValid || !bValid) return a.pgc - b.pgc;

    // 360 degrees and 0 degrees designate the same meridian.
    const aRa = (a.ra ?? 0) % 360;
    const bRa = (b.ra ?? 0) % 360;
    if (aRa !== bRa) return aRa - bRa;
    const aDec = a.dec ?? 0;
    const bDec = b.dec ?? 0;
    return aDec - bDec || a.pgc - b.pgc;
  });
}
