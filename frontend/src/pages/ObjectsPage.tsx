import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchObjects,
  matchesQuery,
  type CatalogObject,
} from "../api/objects.ts";
import { AladinMap, type SkyFocus } from "../components/AladinMap.tsx";
import { AtlasActiveCriteria } from "../components/AtlasActiveCriteria.tsx";
import { AtlasLegend } from "../components/AtlasLegend.tsx";
import { AtlasRegionControls } from "../components/AtlasRegionControls.tsx";
import { AtlasScientificControls } from "../components/AtlasScientificControls.tsx";
import { AtlasSelectionSummary } from "../components/AtlasSelectionSummary.tsx";
import { ObjectCard } from "../components/ObjectCard.tsx";
import { atlasBounds, clampScientificFilters } from "../lib/atlasBounds.ts";
import {
  DEFAULT_SCIENTIFIC_FILTERS,
  matchesScientificFilters,
  type ScientificFiltersState,
} from "../lib/scientificFilters.ts";
import { isWithinSkyRadius, type SkyCoordinates } from "../lib/skySearch.ts";
import { parseAtlasCoordinates } from "../lib/atlasCoordinateSearch.ts";
import { regionContains, type SkyRegion } from "../lib/skyRegion.ts";
import { atlasQueryParam, readAtlasState } from "../lib/atlasUrlState.ts";
import { sortObjectsByRa } from "../lib/atlasRaSort.ts";
import { findAtlasNamedTarget } from "../lib/atlasNamedSearch.ts";
import "../components/atlasControls.css";

export function ObjectsPage() {
  const initialState = useMemo(
    () => readAtlasState(window.location.search),
    [],
  );
  const [query, setQuery] = useState(initialState.query);
  const [filters, setFilters] = useState<ScientificFiltersState>(
    initialState.filters,
  );
  const [region, setRegion] = useState<SkyRegion | null>(initialState.region);
  const [nearby, setNearby] = useState<SkyCoordinates | null>(
    initialState.nearby,
  );
  const [radiusArcmin, setRadiusArcmin] = useState(initialState.radiusArcmin);
  const [drawingMode, setDrawingMode] = useState<"circle" | "rectangle" | null>(
    null,
  );
  const [activePanel, setActivePanel] = useState<"filters" | "region" | null>(
    null,
  );
  const [objects, setObjects] = useState<CatalogObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<SkyFocus | null>(null);
  const focusRequestId = useRef(0);

  const bounds = useMemo(() => atlasBounds(objects ?? []), [objects]);
  const tidalRange = bounds.tidal;

  function locate(object: CatalogObject): void {
    if (object.ra === null || object.dec === null) return;
    focusRequestId.current += 1;
    setFocus({
      ra: object.ra,
      dec: object.dec,
      requestId: focusRequestId.current,
    });
  }
  function locateCoordinates(coords: SkyCoordinates, radius: number): void {
    focusRequestId.current += 1;
    setFocus({
      ...coords,
      requestId: focusRequestId.current,
      fov: Math.max(2, (4 * radius) / 60),
    });
  }
  function locateNamedSearch(term: string): void {
    const target = findAtlasNamedTarget(objects ?? [], term);
    if (target !== null && target.ra !== null && target.dec !== null) {
      // 8-degree neighbourhood: keep surrounding context visible on the overview map.
      locateCoordinates({ ra: target.ra, dec: target.dec }, 120);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const rows = await fetchObjects();
        if (!cancelled) {
          const allBounds = atlasBounds(rows);
          setObjects(rows);
          setFilters((current) => clampScientificFilters(current, allBounds));
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load objects",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (objects === null) return [];
    const coordinateQuery = parseAtlasCoordinates(query) !== null;
    return objects.filter(
      (object) =>
        (coordinateQuery || matchesQuery(object, query)) &&
        matchesScientificFilters(object, filters) &&
        (nearby === null || isWithinSkyRadius(object, nearby, radiusArcmin)) &&
        (region === null || regionContains(region, object.ra, object.dec)),
    );
  }, [objects, query, filters, nearby, radiusArcmin, region]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = atlasQueryParam({
      query,
      filters,
      region,
      nearby,
      radiusArcmin,
    });
    if (encoded) params.set("atlas", encoded);
    else params.delete("atlas");
    const search = params.toString();
    const destination = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (
      destination !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.replaceState(window.history.state, "", destination);
  }, [query, filters, region, nearby, radiusArcmin]);

  const gridObjects = useMemo(() => sortObjectsByRa(filtered), [filtered]);

  return (
    <main className="catalog catalog--overview" data-atlas-version="v5">
      {error !== null ? (
        <p className="catalog-status catalog-status-error">{error}</p>
      ) : null}
      {objects === null && error === null ? (
        <p className="catalog-status">Loading catalog…</p>
      ) : null}
      {objects !== null ? (
        <>
          <section className="catalog-sky" aria-label="Sky">
            <AladinMap
              objects={filtered}
              referenceObjects={objects}
              focus={focus}
              enableReticlePopups
              tidalRange={tidalRange}
              region={region}
              drawingMode={drawingMode}
              onRegionDraw={(selected) => {
                setRegion(selected);
                setDrawingMode(null);
              }}
              onCancelDraw={() => setDrawingMode(null)}
            />
            <AtlasLegend tidalRange={tidalRange} />
          </section>
          <section
            className="atlas-input-section"
            aria-label="Galaxy selection controls"
          >
            <div className="atlas-overview-commandbar">
              <div className="atlas-controls-row">
                <AtlasScientificControls
                  query={query}
                  panelOpen={activePanel === "filters"}
                  onPanelOpenChange={(next) =>
                    setActivePanel(next ? "filters" : null)
                  }
                  onNamedSearch={locateNamedSearch}
                  onQueryChange={(value) => {
                    setQuery(value);
                    setNearby(null);
                  }}
                  filters={filters}
                  onFiltersChange={setFilters}
                  bounds={bounds}
                  radiusArcmin={radiusArcmin}
                  hasTidalData={tidalRange !== null}
                  onRadiusChange={setRadiusArcmin}
                  onCoordinateLocate={locateCoordinates}
                  onCoordinateSearch={setNearby}
                  searchActive={nearby !== null}
                  onCoordinateClear={() => setNearby(null)}
                />
                <AtlasRegionControls
                  region={region}
                  drawingMode={drawingMode}
                  panelOpen={activePanel === "region"}
                  onPanelOpenChange={(next) =>
                    setActivePanel(next ? "region" : null)
                  }
                  onRegionChange={setRegion}
                  onDraw={setDrawingMode}
                />
              </div>
              <AtlasSelectionSummary
                objects={filtered}
                total={objects.length}
                query={query}
                filters={filters}
                region={region}
                nearby={nearby}
                radiusArcmin={radiusArcmin}
              />
            </div>
            <AtlasActiveCriteria
              query={query}
              onQueryClear={() => {
                setQuery("");
                setNearby(null);
              }}
              filters={filters}
              onFiltersChange={setFilters}
              region={region}
              radiusArcmin={radiusArcmin}
              onRegionClear={() => setRegion(null)}
              nearby={nearby}
              onNearbyClear={() => {
                setNearby(null);
                if (parseAtlasCoordinates(query) !== null) setQuery("");
              }}
              onClearAll={() => {
                setQuery("");
                setNearby(null);
                setRegion(null);
                setFilters(
                  clampScientificFilters(DEFAULT_SCIENTIFIC_FILTERS, bounds),
                );
                setDrawingMode(null);
              }}
            />
          </section>

          <section className="catalog-list" aria-label="Objects">
            {filtered.length === 0 ? (
              <p className="catalog-status">
                No galaxies match the current selection.
              </p>
            ) : (
              <div className="object-grid">
                {gridObjects.map((object) => (
                  <ObjectCard
                    key={object.pgc}
                    object={object}
                    onLocate={locate}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
