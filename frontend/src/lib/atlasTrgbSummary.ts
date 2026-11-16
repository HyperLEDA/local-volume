import type { CatalogObject } from "../api/objects.ts";

/** Count adopted source-native TRGB/RGB distances; not all published TRGB measurements. */
export function trgbDistanceCount(objects: readonly CatalogObject[]): number {
  return objects.filter((object) => {
    const distance = object.dist;
    if (
      typeof distance !== "number" ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      return false;
    }
    const method = object.distance_method?.trim().toLowerCase();
    return method === "trgb" || method === "rgb";
  }).length;
}
