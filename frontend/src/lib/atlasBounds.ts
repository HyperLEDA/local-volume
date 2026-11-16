import type { CatalogObject } from "../api/objects.ts";
import type {
  NumericKey,
  NumericFilter,
  ScientificFiltersState,
} from "./scientificFilters.ts";

export type AtlasRange = { min: number; max: number };
export type AtlasBounds = Record<NumericKey, AtlasRange | null> & {
  tidal: AtlasRange | null;
};

const FIELD: Record<NumericKey, keyof CatalogObject> = {
  distance: "dist",
  velocity: "lvg_v_lg_kms",
  heliocentric: "lvg_v_hel_kms",
  morphology: "morphology_t",
  magnitude: "b_mag",
  hi21: "hi21_mag",
};

function range(
  values: readonly (number | null | undefined)[],
): AtlasRange | null {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

/** Bounds are calculated once from ALL catalog rows, never from the selected subset. */
export function atlasBounds(objects: readonly CatalogObject[]): AtlasBounds {
  function fieldRange(key: keyof CatalogObject): AtlasRange | null {
    return range(
      objects.map((object) => object[key] as number | null | undefined),
    );
  }
  return {
    distance: fieldRange(FIELD.distance),
    velocity: fieldRange(FIELD.velocity),
    heliocentric: fieldRange(FIELD.heliocentric),
    morphology: fieldRange(FIELD.morphology),
    magnitude: fieldRange(FIELD.magnitude),
    hi21: range(
      objects.map((object) =>
        typeof object.hi21_limit === "string" && object.hi21_limit.trim()
          ? null
          : object.hi21_mag,
      ),
    ),
    tidal: fieldRange("theta1"),
  };
}

export function clampNumericFilter(
  rule: NumericFilter,
  bounds: AtlasRange | null,
): NumericFilter {
  if (bounds === null) return { ...rule, active: false };
  const min = Math.max(bounds.min, Math.min(rule.min, bounds.max));
  const max = Math.max(min, Math.min(rule.max, bounds.max));
  return { active: rule.active, min, max };
}

export function clampScientificFilters(
  filters: ScientificFiltersState,
  bounds: AtlasBounds,
): ScientificFiltersState {
  return {
    ...filters,
    distance: clampNumericFilter(filters.distance, bounds.distance),
    velocity: clampNumericFilter(filters.velocity, bounds.velocity),
    heliocentric: clampNumericFilter(filters.heliocentric, bounds.heliocentric),
    morphology: clampNumericFilter(filters.morphology, bounds.morphology),
    magnitude: clampNumericFilter(filters.magnitude, bounds.magnitude),
    hi21: clampNumericFilter(filters.hi21, bounds.hi21),
  };
}
