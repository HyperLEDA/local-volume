import type { AtlasBounds, AtlasRange } from "./atlasBounds.ts";
import {
  DEFAULT_SCIENTIFIC_FILTERS,
  NUMERIC_FILTER_KEYS,
  type NumericKey,
  type ScientificFiltersState,
} from "./scientificFilters.ts";

export type DraftNumericRange = { active: boolean; min: string; max: string };
export type FilterDraft = Record<NumericKey, DraftNumericRange> & {
  tidal: ScientificFiltersState["tidal"];
  includeMissing: boolean;
};

/** Compact starting limits are suggestions; observed extrema remain available.
 * These values do not filter any data until the checkbox is enabled and Done is pressed.
 */
export function suggestedDraftRange(
  key: NumericKey,
  bounds: AtlasRange | null,
): AtlasRange | null {
  const range = bounds;
  if (range === null) return null;
  const { min: catalogMin, max: catalogMax } = range;
  const preset = DEFAULT_SCIENTIFIC_FILTERS[key];
  function clamp(value: number): number {
    return Math.max(catalogMin, Math.min(catalogMax, value));
  }
  return { min: clamp(preset.min), max: clamp(preset.max) };
}

export function startFilterDraft(
  applied: ScientificFiltersState,
  bounds: AtlasBounds,
): FilterDraft {
  const result = {} as Record<NumericKey, DraftNumericRange>;
  for (const key of NUMERIC_FILTER_KEYS) {
    const value = applied[key];
    const suggested = suggestedDraftRange(key, bounds[key]);
    result[key] = {
      active: value.active,
      min: String(
        value.active || suggested === null ? value.min : suggested.min,
      ),
      max: String(
        value.active || suggested === null ? value.max : suggested.max,
      ),
    };
  }
  return {
    ...result,
    tidal: applied.tidal,
    includeMissing: applied.includeMissing,
  };
}

export type FilterDraftResult =
  { ok: true; filters: ScientificFiltersState } | { ok: false; error: string };

function parseField(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function validateFilterDraft(
  draft: FilterDraft,
  bounds: AtlasBounds,
): FilterDraftResult {
  const numeric = {} as Record<NumericKey, ScientificFiltersState[NumericKey]>;
  const names: Record<NumericKey, string> = {
    distance: "D",
    heliocentric: "Vh",
    velocity: "VLG",
    morphology: "T",
    magnitude: "B",
    hi21: "m21",
  };
  for (const key of NUMERIC_FILTER_KEYS) {
    const entry = draft[key];
    const bound: AtlasRange | null = bounds[key];
    if (!entry.active) {
      numeric[key] = {
        active: false,
        min: bound?.min ?? 0,
        max: bound?.max ?? 0,
      };
      continue;
    }
    if (bound === null)
      return {
        ok: false,
        error: `${names[key]}: catalogue measurements unavailable`,
      };
    const min = parseField(entry.min);
    const max = parseField(entry.max);
    if (min === null || max === null) {
      return { ok: false, error: `${names[key]}: enter both numeric limits` };
    }
    if (min > max)
      return { ok: false, error: `${names[key]}: minimum exceeds maximum` };
    // Editing must preserve raw text. Clamp only when the user presses Done.
    const low = Math.max(bound.min, Math.min(bound.max, min));
    const high = Math.max(bound.min, Math.min(bound.max, max));
    if (low > high)
      return { ok: false, error: `${names[key]}: invalid catalogue range` };
    numeric[key] = { active: true, min: low, max: high };
  }
  return {
    ok: true,
    filters: {
      ...numeric,
      tidal: draft.tidal,
      includeMissing: draft.includeMissing,
    },
  };
}

export function resetFilterDraft(bounds: AtlasBounds): FilterDraft {
  return startFilterDraft(DEFAULT_SCIENTIFIC_FILTERS, bounds);
}
