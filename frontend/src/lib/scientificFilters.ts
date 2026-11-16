import type { CatalogObject } from "../api/objects.ts";

export type NumericFilter = { active: boolean; min: number; max: number };
export type NumericKey =
  | "distance"
  | "heliocentric"
  | "velocity"
  | "morphology"
  | "magnitude"
  | "hi21";
export const NUMERIC_FILTER_KEYS: readonly NumericKey[] = [
  "distance",
  "heliocentric",
  "velocity",
  "morphology",
  "magnitude",
  "hi21",
];
export type TidalFilter = "all" | "isolated" | "associated" | "unknown";

export type ScientificFiltersState = Record<NumericKey, NumericFilter> & {
  tidal: TidalFilter;
  includeMissing: boolean;
};

export const DEFAULT_SCIENTIFIC_FILTERS: ScientificFiltersState = {
  distance: { active: false, min: 0, max: 11 },
  velocity: { active: false, min: -500, max: 1500 },
  heliocentric: { active: false, min: -500, max: 1500 },
  morphology: { active: false, min: -5, max: 10 },
  magnitude: { active: false, min: 0, max: 25 },
  hi21: { active: false, min: 0, max: 25 },
  tidal: "all",
  includeMissing: true,
};

export function activeFilterCount(filters: ScientificFiltersState): number {
  return (
    NUMERIC_FILTER_KEYS.reduce(
      (count, key) => count + Number(filters[key].active),
      0,
    ) + Number(filters.tidal !== "all")
  );
}

function inRange(
  value: number | null | undefined,
  rule: NumericFilter,
  includeMissing: boolean,
): boolean {
  if (!rule.active) return true;
  if (value === null || value === undefined || !Number.isFinite(value))
    return includeMissing;
  return rule.min <= value && value <= rule.max;
}

export function matchesScientificFilters(
  object: CatalogObject,
  filters: ScientificFiltersState,
): boolean {
  if (!inRange(object.dist, filters.distance, filters.includeMissing))
    return false;
  if (!inRange(object.lvg_v_lg_kms, filters.velocity, filters.includeMissing))
    return false;
  if (
    !inRange(object.lvg_v_hel_kms, filters.heliocentric, filters.includeMissing)
  )
    return false;
  if (!inRange(object.morphology_t, filters.morphology, filters.includeMissing))
    return false;
  if (!inRange(object.b_mag, filters.magnitude, filters.includeMissing))
    return false;
  // A censored H I value is not a direct photometric measurement.
  const measuredHi21 =
    typeof object.hi21_limit === "string" && object.hi21_limit.trim()
      ? null
      : object.hi21_mag;
  if (!inRange(measuredHi21, filters.hi21, filters.includeMissing))
    return false;
  if (filters.tidal === "all") return true;
  const theta = object.theta1;
  if (theta === null || theta === undefined || !Number.isFinite(theta))
    return filters.tidal === "unknown";
  if (filters.tidal === "unknown") return false;
  return filters.tidal === "isolated" ? theta < 0 : theta >= 0;
}
