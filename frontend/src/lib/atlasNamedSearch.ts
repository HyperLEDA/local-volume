import type { CatalogObject } from "../api/objects.ts";

type SearchableGalaxy = Pick<
  CatalogObject,
  "pgc" | "name" | "names" | "ra" | "dec"
>;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasCoordinates(object: SearchableGalaxy): boolean {
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

/** Never choose an arbitrary galaxy when a name or partial query is ambiguous. */
export function findAtlasNamedTarget<T extends SearchableGalaxy>(
  objects: readonly T[],
  query: string,
): T | null {
  const search = normalize(query);
  if (!search) return null;
  const identifier = /^(?:pgc\s*)?0*(\d+)$/i.exec(search);
  const targetPgc = identifier === null ? null : Number(identifier[1]);
  let exact: T | null = null;

  for (const object of objects) {
    if (!hasCoordinates(object)) continue;
    const exactMatch =
      (targetPgc !== null && object.pgc === targetPgc) ||
      normalize(object.name) === search ||
      object.names.some((name) => normalize(name) === search);
    if (!exactMatch) continue;
    if (exact !== null) return null;
    exact = object;
  }
  if (exact !== null) return exact;

  let partial: T | null = null;
  for (const object of objects) {
    if (!hasCoordinates(object)) continue;
    const partialMatch =
      normalize(object.name).includes(search) ||
      String(object.pgc).includes(search) ||
      object.names.some((name) => normalize(name).includes(search));
    if (!partialMatch) continue;
    if (partial !== null) return null;
    partial = object;
  }
  return partial;
}
