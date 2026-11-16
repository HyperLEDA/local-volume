import {
  DEFAULT_SCIENTIFIC_FILTERS,
  type ScientificFiltersState,
} from "./scientificFilters.ts";
import { isValidRegion, type SkyRegion } from "./skyRegion.ts";
import type { SkyCoordinates } from "./skySearch.ts";

export type SavedAtlasState = {
  query: string;
  filters: ScientificFiltersState;
  region: SkyRegion | null;
  nearby: SkyCoordinates | null;
  radiusArcmin: number;
};

const BASE: SavedAtlasState = {
  query: "",
  filters: DEFAULT_SCIENTIFIC_FILTERS,
  region: null,
  nearby: null,
  radiusArcmin: 30,
};

function numberFilter(
  value: unknown,
  defaults: { active: boolean; min: number; max: number },
) {
  if (typeof value !== "object" || value === null) return defaults;
  const f = value as Record<string, unknown>;
  if (
    typeof f.active !== "boolean" ||
    typeof f.min !== "number" ||
    !Number.isFinite(f.min) ||
    typeof f.max !== "number" ||
    !Number.isFinite(f.max) ||
    f.min > f.max
  )
    return defaults;
  return { active: f.active, min: f.min, max: f.max };
}

/** Strict validation: URL state is untrusted input, not an executable filter. */
export function readAtlasState(search: string): SavedAtlasState {
  const raw = new URLSearchParams(search).get("atlas");
  if (!raw || raw.length > 4096) return BASE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return BASE;
    const p = parsed as Record<string, unknown>;
    if (p.v !== 1) return BASE;
    const f =
      typeof p.filters === "object" && p.filters !== null
        ? (p.filters as Record<string, unknown>)
        : {};
    const tidalValues = ["all", "isolated", "associated", "unknown"];
    const tidal = tidalValues.includes(String(f.tidal))
      ? (f.tidal as ScientificFiltersState["tidal"])
      : "all";
    const candidate = p.nearby as SkyCoordinates | null;
    const nearby =
      candidate !== null &&
      typeof candidate === "object" &&
      typeof candidate.ra === "number" &&
      Number.isFinite(candidate.ra) &&
      candidate.ra >= 0 &&
      candidate.ra < 360 &&
      typeof candidate.dec === "number" &&
      Number.isFinite(candidate.dec) &&
      candidate.dec >= -90 &&
      candidate.dec <= 90
        ? { ra: candidate.ra, dec: candidate.dec }
        : null;
    return {
      query: typeof p.query === "string" ? p.query.slice(0, 200) : "",
      filters: {
        distance: numberFilter(f.distance, BASE.filters.distance),
        velocity: numberFilter(f.velocity, BASE.filters.velocity),
        heliocentric: numberFilter(f.heliocentric, BASE.filters.heliocentric),
        morphology: numberFilter(f.morphology, BASE.filters.morphology),
        magnitude: numberFilter(f.magnitude, BASE.filters.magnitude),
        hi21: numberFilter(f.hi21, BASE.filters.hi21),
        tidal,
        includeMissing:
          typeof f.includeMissing === "boolean" ? f.includeMissing : true,
      },
      region: isValidRegion(p.region) ? p.region : null,
      nearby,
      radiusArcmin:
        typeof p.radiusArcmin === "number" &&
        Number.isFinite(p.radiusArcmin) &&
        p.radiusArcmin >= 0.01 &&
        p.radiusArcmin <= 10800
          ? p.radiusArcmin
          : 30,
    };
  } catch {
    return BASE;
  }
}

export function atlasQueryParam(state: SavedAtlasState): string {
  const {
    distance,
    velocity,
    heliocentric,
    morphology,
    magnitude,
    hi21,
    tidal,
    includeMissing,
  } = state.filters;
  const active =
    distance.active ||
    velocity.active ||
    heliocentric.active ||
    morphology.active ||
    magnitude.active ||
    hi21.active ||
    tidal !== "all" ||
    includeMissing !== true;
  if (!state.query.trim() && !state.region && !state.nearby && !active)
    return "";
  return JSON.stringify({ v: 1, ...state });
}
