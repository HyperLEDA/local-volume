import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { AtlasBounds, AtlasRange } from "../lib/atlasBounds.ts";
import {
  startFilterDraft,
  resetFilterDraft,
  validateFilterDraft,
  type DraftNumericRange,
  type FilterDraft,
} from "../lib/atlasDraftFilters.ts";
import {
  activeFilterCount,
  NUMERIC_FILTER_KEYS,
  type NumericKey,
  type ScientificFiltersState,
} from "../lib/scientificFilters.ts";
import { parseAtlasCoordinates } from "../lib/atlasCoordinateSearch.ts";
import type { SkyCoordinates } from "../lib/skySearch.ts";

type Props = {
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onNamedSearch: (query: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  filters: ScientificFiltersState;
  onFiltersChange: (value: ScientificFiltersState) => void;
  bounds: AtlasBounds;
  radiusArcmin: number;
  hasTidalData: boolean;
  onRadiusChange: (value: number) => void;
  onCoordinateLocate: (
    coordinates: SkyCoordinates,
    radiusArcmin: number,
  ) => void;
  onCoordinateSearch: (coordinates: SkyCoordinates) => void;
  onCoordinateClear: () => void;
  searchActive: boolean;
};

const LABELS: Record<
  NumericKey,
  { title: ReactNode; name: string; unit: string; step: string }
> = {
  distance: { title: <i>D</i>, name: "Distance", unit: "Mpc", step: "any" },
  heliocentric: {
    title: (
      <>
        <i>V</i>
        <sub>h</sub>
      </>
    ),
    name: "Heliocentric velocity",
    unit: "km/s",
    step: "any",
  },
  velocity: {
    title: (
      <>
        <i>V</i>
        <sub>LG</sub>
      </>
    ),
    name: "Local Group velocity",
    unit: "km/s",
    step: "any",
  },
  morphology: {
    title: <i>T</i>,
    name: "Morphological type",
    unit: "",
    step: "1",
  },
  magnitude: {
    title: <i>B</i>,
    name: "Apparent B magnitude",
    unit: "mag",
    step: "any",
  },
  hi21: {
    title: (
      <>
        <i>m</i>
        <sub>21</sub>
      </>
    ),
    name: "H I 21-cm magnitude",
    unit: "mag",
    step: "any",
  },
};

function BoundedFilterRow({
  keyName,
  rule,
  bounds,
  onChange,
}: {
  keyName: NumericKey;
  rule: DraftNumericRange;
  bounds: AtlasRange | null;
  onChange: (value: DraftNumericRange) => void;
}) {
  const label = LABELS[keyName];
  const rawRangeTitle =
    bounds === null
      ? `${label.name}: no measured catalogue values`
      : `${label.name}: raw catalogue extrema ${bounds.min} … ${bounds.max} ${label.unit}; click the label to toggle this filter`;
  function activate(): void {
    if (bounds !== null && !rule.active) onChange({ ...rule, active: true });
  }
  return (
    <div
      className={`atlas-filter-row${rule.active ? " atlas-filter-row--active" : ""}`}
    >
      <button
        type="button"
        className="atlas-filter-row-label"
        title={rawRangeTitle}
        aria-pressed={rule.active}
        aria-label={`${label.name} filter: ${rule.active ? "enabled" : "disabled"}; click to toggle`}
        disabled={bounds === null}
        onClick={() => onChange({ ...rule, active: !rule.active })}
      >
        <span className="atlas-filter-symbol">{label.title}</span>
      </button>
      <input
        type="text"
        inputMode="decimal"
        spellCheck={false}
        disabled={bounds === null}
        value={rule.min}
        aria-label={`${label.name} minimum`}
        onFocus={activate}
        onChange={(event) =>
          onChange({ ...rule, active: true, min: event.target.value })
        }
      />
      <span aria-hidden="true">–</span>
      <input
        type="text"
        inputMode="decimal"
        spellCheck={false}
        disabled={bounds === null}
        value={rule.max}
        aria-label={`${label.name} maximum`}
        onFocus={activate}
        onChange={(event) =>
          onChange({ ...rule, active: true, max: event.target.value })
        }
      />
      <span className="atlas-filter-unit">{label.unit}</span>
      <div className="atlas-filter-range-hint">
        {bounds === null
          ? "No measured values"
          : `Raw catalogue extrema: ${bounds.min} … ${bounds.max}`}
      </div>
    </div>
  );
}

export function AtlasScientificControls({
  query,
  onQueryChange,
  panelOpen,
  onPanelOpenChange,
  onNamedSearch,
  filters,
  onFiltersChange,
  bounds,
  radiusArcmin,
  hasTidalData,
  onRadiusChange,
  onCoordinateLocate,
  onCoordinateSearch,
  onCoordinateClear,
  searchActive,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<FilterDraft>(() =>
    startFilterDraft(filters, bounds),
  );
  const [queryDraft, setQueryDraft] = useState(query);
  const [radiusDraft, setRadiusDraft] = useState(radiusArcmin);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (!panelOpen) return;
    function dismissOnOutsidePointer(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      ) {
        onPanelOpenChange(false);
      }
    }
    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [panelOpen, onPanelOpenChange]);

  const coordinate = parseAtlasCoordinates(queryDraft);
  const active = activeFilterCount(filters);

  // Only applied queries/regions should propagate into the URL and catalogue.
  useEffect(() => {
    setQueryDraft(query);
  }, [query]);
  useEffect(() => {
    setRadiusDraft(radiusArcmin);
  }, [radiusArcmin]);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const submitted = queryDraft.trim();
    const sky = parseAtlasCoordinates(submitted);
    onQueryChange(submitted);
    if (sky !== null) {
      onRadiusChange(radiusDraft);
      onCoordinateSearch(sky);
      onCoordinateLocate(sky, radiusDraft);
    } else {
      onCoordinateClear();
      onNamedSearch(submitted);
    }
  }

  function openFilters(): void {
    if (panelOpen) {
      onPanelOpenChange(false);
      return;
    }
    setDraft(startFilterDraft(filters, bounds));
    setValidationMessage(null);
    onPanelOpenChange(true);
  }

  function updateDraft(key: NumericKey, value: DraftNumericRange): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidationMessage(null);
  }

  function commitFilters(): void {
    const result = validateFilterDraft(draft, bounds);
    if (!result.ok) {
      setValidationMessage(result.error);
      return;
    }
    onFiltersChange(result.filters);
    setValidationMessage(null);
    onPanelOpenChange(false);
  }

  return (
    <div className="atlas-toolbar">
      <form className="atlas-search-form" role="search" onSubmit={submitSearch}>
        <input
          className="atlas-compact-search"
          type="search"
          value={queryDraft}
          placeholder="Name, PGC, RA Dec or J…"
          title="Enter to search. ICRS decimal / sexagesimal or J103925.25+014305.5"
          aria-label="Galaxy name, PGC, ICRS or J-designation coordinates"
          onChange={(event) => setQueryDraft(event.target.value)}
        />
        <button
          type="submit"
          className="atlas-go-coordinates"
          title={
            coordinate !== null
              ? "Center and select the coordinate cone"
              : "Apply name or PGC search"
          }
          aria-label={
            coordinate !== null ? "Search coordinate cone" : "Search catalog"
          }
        >
          {coordinate !== null ? "⌖" : "↵"}
        </button>
      </form>
      {coordinate !== null ? (
        <label
          className="atlas-radius-control"
          title="Cone-search radius (ICRS)"
        >
          <span>Cone</span>
          <select
            aria-label="Coordinate cone-search radius"
            value={radiusDraft}
            onChange={(event) => setRadiusDraft(Number(event.target.value))}
          >
            <option value={5}>5′</option>
            <option value={15}>15′</option>
            <option value={30}>30′</option>
            <option value={60}>1°</option>
            <option value={120}>2°</option>
          </select>
        </label>
      ) : null}
      {searchActive ? (
        <button
          type="button"
          className="atlas-filters-trigger"
          onClick={() => {
            onCoordinateClear();
            if (parseAtlasCoordinates(query) !== null) onQueryChange("");
          }}
        >
          Clear cone
        </button>
      ) : null}
      <div className="atlas-filter-anchor" ref={panelRef}>
        <button
          type="button"
          className={`atlas-filters-trigger${active ? " atlas-filters-trigger--active" : ""}`}
          onClick={openFilters}
          aria-expanded={panelOpen}
          aria-controls="atlas-scientific-filters"
        >
          <span aria-hidden="true">☷</span> Filters
          {active ? ` (${active})` : ""}
        </button>
        {panelOpen ? (
          <div
            id="atlas-scientific-filters"
            className="atlas-filter-panel"
            onKeyDown={(event) => {
              if (event.key === "Escape") onPanelOpenChange(false);
            }}
          >
            <div className="atlas-filter-heading">
              <strong>Scientific filters</strong>
              <button
                type="button"
                aria-label="Discard filter edits"
                className="atlas-plain-icon"
                onClick={() => onPanelOpenChange(false)}
              >
                ×
              </button>
            </div>
            <div className="atlas-filter-grid">
              <div
                className="atlas-filter-column"
                aria-label="Distance and radial velocities"
              >
                <p className="atlas-filter-group-title">
                  Distance and velocity
                </p>
                {NUMERIC_FILTER_KEYS.slice(0, 3).map((key) => (
                  <BoundedFilterRow
                    key={key}
                    keyName={key}
                    rule={draft[key]}
                    bounds={bounds[key]}
                    onChange={(value) => updateDraft(key, value)}
                  />
                ))}
              </div>
              <div
                className="atlas-filter-column"
                aria-label="Morphology and photometry"
              >
                <p className="atlas-filter-group-title">
                  Morphology and photometry
                </p>
                {NUMERIC_FILTER_KEYS.slice(3).map((key) => (
                  <BoundedFilterRow
                    key={key}
                    keyName={key}
                    rule={draft[key]}
                    bounds={bounds[key]}
                    onChange={(value) => updateDraft(key, value)}
                  />
                ))}
              </div>
            </div>
            <div className="atlas-filter-environment">
              <label htmlFor="atlas-tidal-choice">Tidal environment</label>
              <select
                id="atlas-tidal-choice"
                disabled={!hasTidalData}
                title={
                  hasTidalData
                    ? "Computed index; incomplete donor census"
                    : "Tidal indices not available"
                }
                value={draft.tidal}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    tidal: event.target
                      .value as ScientificFiltersState["tidal"],
                  }))
                }
              >
                <option value="all">All</option>
                <option value="isolated">Isolated (Θ₁ &lt; 0)</option>
                <option value="associated">Associated (Θ₁ ≥ 0)</option>
                <option value="unknown">Unknown Θ₁</option>
              </select>
            </div>
            {!hasTidalData ? (
              <div className="atlas-filter-data-status">
                Θ₁ unavailable until physical data are ready
              </div>
            ) : null}
            <label className="atlas-filter-missing">
              <input
                type="checkbox"
                checked={draft.includeMissing}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    includeMissing: event.target.checked,
                  }))
                }
              />
              Include missing values
            </label>
            {validationMessage !== null ? (
              <p className="atlas-filter-validation" role="alert">
                {validationMessage}
              </p>
            ) : null}
            <div className="atlas-filter-footer">
              <button
                type="button"
                className="atlas-filter-reset"
                onClick={() => {
                  setDraft(resetFilterDraft(bounds));
                  setValidationMessage(null);
                }}
              >
                Reset
              </button>
              <span className="atlas-filter-stage-note">Apply with Done</span>
              <button
                type="button"
                className="atlas-filter-done"
                onClick={commitFilters}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {coordinate !== null ? (
        <span className="atlas-coordinate-hint">
          ICRS ·{" "}
          {searchActive
            ? `cone ${radiusArcmin}′ active`
            : "Enter to search cone"}
        </span>
      ) : null}
    </div>
  );
}
