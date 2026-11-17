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

/** Bounds are calculated once from ALL catalog rows, never from the selected subset. */
export function atlasBounds(objects: readonly CatalogObject[]): AtlasBounds {
  const bounds: AtlasBounds = {
    distance: null,
    velocity: null,
    heliocentric: null,
    morphology: null,
    magnitude: null,
    hi21: null,
    tidal: null,
  };

  function extend(key: keyof AtlasBounds, value: unknown): void {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const current = bounds[key];
    if (current === null) {
      bounds[key] = { min: value, max: value };
    } else {
      current.min = Math.min(current.min, value);
      current.max = Math.max(current.max, value);
    }
  }

  for (const object of objects) {
    extend("distance", object.dist);
    extend("velocity", object.lvg_v_lg_kms);
    extend("heliocentric", object.lvg_v_hel_kms);
    extend("morphology", object.morphology_t);
    extend("magnitude", object.b_mag);
    // Censored H I measurements must not set the numerical filter bounds.
    if (!(typeof object.hi21_limit === "string" && object.hi21_limit.trim())) {
      extend("hi21", object.hi21_mag);
    }
    extend("tidal", object.theta1);
  }
  return bounds;
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
