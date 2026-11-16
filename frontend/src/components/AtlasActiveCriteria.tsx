import type { ReactNode } from "react";
import {
  activeFilterCount,
  NUMERIC_FILTER_KEYS,
  type NumericKey,
  type ScientificFiltersState,
} from "../lib/scientificFilters.ts";
import type { SkyCoordinates } from "../lib/skySearch.ts";
import { describeRegion, type SkyRegion } from "../lib/skyRegion.ts";

type Props = {
  query: string;
  onQueryClear: () => void;
  filters: ScientificFiltersState;
  onFiltersChange: (filters: ScientificFiltersState) => void;
  region: SkyRegion | null;
  onRegionClear: () => void;
  nearby: SkyCoordinates | null;
  radiusArcmin: number;
  onNearbyClear: () => void;
  onClearAll: () => void;
};

const LABELS: Record<NumericKey, ReactNode> = {
  distance: <i>D</i>,
  velocity: (
    <>
      <i>V</i>
      <sub>LG</sub>
    </>
  ),
  heliocentric: (
    <>
      <i>V</i>
      <sub>h</sub>
    </>
  ),
  morphology: <i>T</i>,
  magnitude: <i>B</i>,
  hi21: (
    <>
      <i>m</i>
      <sub>21</sub>
    </>
  ),
};

export function AtlasActiveCriteria({
  query,
  onQueryClear,
  filters,
  onFiltersChange,
  region,
  onRegionClear,
  nearby,
  radiusArcmin,
  onNearbyClear,
  onClearAll,
}: Props) {
  const chips: { id: string; content: ReactNode; remove: () => void }[] = [];
  if (query.trim())
    chips.push({
      id: "query",
      content: `Search: ${query}`,
      remove: onQueryClear,
    });
  for (const key of NUMERIC_FILTER_KEYS) {
    const filter = filters[key];
    if (filter.active)
      chips.push({
        id: key,
        content: (
          <>
            {LABELS[key]}: {filter.min}–{filter.max}
          </>
        ),
        remove: () =>
          onFiltersChange({ ...filters, [key]: { ...filter, active: false } }),
      });
  }
  if (filters.tidal !== "all")
    chips.push({
      id: "tidal",
      content: (
        <>
          Θ<sub>1</sub>: {filters.tidal}
        </>
      ),
      remove: () => onFiltersChange({ ...filters, tidal: "all" }),
    });
  if (region)
    chips.push({
      id: "region",
      content: describeRegion(region),
      remove: onRegionClear,
    });
  if (nearby)
    chips.push({
      id: "nearby",
      content: `Cone ${radiusArcmin}′`,
      remove: onNearbyClear,
    });
  if (!chips.length) return null;
  return (
    <div
      className="atlas-active-criteria"
      aria-label="Active selection criteria"
    >
      {chips.map((chip) => (
        <button
          className="atlas-criterion"
          type="button"
          key={chip.id}
          onClick={chip.remove}
        >
          <span>{chip.content}</span>
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button
        type="button"
        className="atlas-criterion-reset"
        onClick={onClearAll}
      >
        Clear all (
        {activeFilterCount(filters) +
          Number(Boolean(query)) +
          Number(Boolean(region)) +
          Number(Boolean(nearby))}
        )
      </button>
      {!filters.includeMissing && activeFilterCount(filters) > 0 ? (
        <span className="atlas-missing-note">
          Missing measurements excluded from numeric ranges
        </span>
      ) : null}
    </div>
  );
}
