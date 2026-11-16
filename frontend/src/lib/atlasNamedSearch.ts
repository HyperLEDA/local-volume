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
  const positioned = objects.filter(hasCoordinates);
  const identifier = /^(?:pgc\s*)?0*(\d+)$/i.exec(search);
  const matchesExact = positioned.filter((object) => {
    if (identifier && object.pgc === Number(identifier[1])) return true;
    return (
      normalize(object.name) === search ||
      object.names.some((name) => normalize(name) === search)
    );
  });
  if (matchesExact.length === 1) return matchesExact[0];
  if (matchesExact.length > 1) return null;
  const matchesPartial = positioned.filter(
    (object) =>
      normalize(object.name).includes(search) ||
      String(object.pgc).includes(search) ||
      object.names.some((name) => normalize(name).includes(search)),
  );
  return matchesPartial.length === 1 ? matchesPartial[0] : null;
}
