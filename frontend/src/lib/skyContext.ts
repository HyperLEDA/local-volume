import type { CatalogObject } from "../api/objects.ts";

// Include the complete catalog here: Aladin clips to the current viewport and
// the user may pan or zoom away from the selected galaxy.
export function otherSkyObjects(
  objects: readonly CatalogObject[],
  selectedPgc: number,
): CatalogObject[] {
  const seen = new Set<number>([selectedPgc]);
  return objects.filter((object) => {
    if (
      seen.has(object.pgc) ||
      object.ra === null ||
      object.dec === null ||
      !Number.isFinite(object.ra) ||
      !Number.isFinite(object.dec) ||
      object.dec < -90 ||
      object.dec > 90
    ) {
      return false;
    }
    seen.add(object.pgc);
    return true;
  });
}
