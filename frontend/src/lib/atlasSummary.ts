import type { CatalogObject } from "../api/objects.ts";

export type AtlasSummary = {
  selected: number;
  distanceKnown: number;
  medianDistance: number | null;
  tidalKnown: number;
};

export function summarizeAtlas(
  objects: readonly CatalogObject[],
): AtlasSummary {
  const distances = objects
    .map((o) => o.dist)
    .filter(
      (d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0,
    )
    .sort((a, b) => a - b);
  const n = distances.length;
  return {
    selected: objects.length,
    distanceKnown: n,
    medianDistance:
      n === 0
        ? null
        : n % 2
          ? distances[(n - 1) / 2]
          : (distances[n / 2 - 1] + distances[n / 2]) / 2,
    tidalKnown: objects.filter(
      (o) => typeof o.theta1 === "number" && Number.isFinite(o.theta1),
    ).length,
  };
}
