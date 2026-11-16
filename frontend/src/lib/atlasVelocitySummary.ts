import type { CatalogObject } from "../api/objects.ts";

/** Only finite measured source-native V_h; missing values do not enter the median. */
export function medianHeliocentricVelocity(objects: readonly CatalogObject[]): {
  median: number | null;
  measured: number;
} {
  const sorted = objects
    .map((row) => row.lvg_v_hel_kms)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
    .sort((a, b) => a - b);
  const measured = sorted.length;
  if (!measured) return { median: null, measured: 0 };
  const center = Math.floor(measured / 2);
  return {
    median:
      measured % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2,
    measured,
  };
}
