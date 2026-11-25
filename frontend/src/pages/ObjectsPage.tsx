import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchObjects,
  createCatalogQueryMatcher,
  type CatalogObject,
} from "../api/objects.ts";
import { AladinMap, type SkyFocus } from "../components/AladinMap.tsx";
import { useAtlasFullscreen } from "../lib/useAtlasFullscreen.ts";
import { AtlasActiveCriteria } from "../components/AtlasActiveCriteria.tsx";
import { AtlasLegend } from "../components/AtlasLegend.tsx";
import { AtlasRegionControls } from "../components/AtlasRegionControls.tsx";
import { AtlasScientificControls } from "../components/AtlasScientificControls.tsx";
import { AtlasSelectionSummary } from "../components/AtlasSelectionSummary.tsx";
import { ObjectCard } from "../components/ObjectCard.tsx";
import {
  newCollectionToken,
  saveCollection,
  consumeCollectionReturn,
} from "../lib/collectionNavigation.ts";
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
import "../components/atlasFullscreen.css";
import "../components/SpatialAtlasView.css";
import "../components/sky3DLaunch.css";
import { atlasSpatialUrl } from "../lib/atlasSession.ts";
import {
  readSpatialSample,
  storeSpatialSample,
  spatialSampleIds,
  spatialSampleUrl,
  spatialSampleLabel,
  downloadSpatialSample,
  type SpatialSample,
} from "../lib/atlasSpatialSample.ts";

function SpatialLoadFailure({ onClose }: { onClose: () => void }) {
  return (
    <div role="alert">
      Spatial Atlas could not load. Sky remains available. Reload the page
      before retrying.{" "}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
const SpatialAtlasView = lazy(() =>
  import("../components/SpatialAtlasView.tsx").catch(() => ({
    default: SpatialLoadFailure,
  })),
);

export function ObjectsPage() {
  const {
    active: atlasMaximized,
    skyRef,
    enter,
    leave,
    onCameraReady,
  } = useAtlasFullscreen();
  const initialState = useMemo(
    () => readAtlasState(window.location.search),
    [],
  );
  const [query, setQuery] = useState(initialState.query);
  const [spatialSample, setSpatialSample] = useState(() =>
    readSpatialSample(window.location.search),
  );
  const sampleIds = useMemo(
    () => spatialSampleIds(spatialSample),
    [spatialSample],
  );
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
  const [spatialOpen, setSpatialOpen] = useState(
    () => new URLSearchParams(window.location.search).get("spatial") === "1",
  );
  const focusRequestId = useRef(0);
  const pendingSkySelection = useRef<number | null | undefined>(undefined);
  const [launchSelection, setLaunchSelection] = useState<
    number | null | undefined
  >(undefined);
  const [skySelectionRequest, setSkySelectionRequest] = useState<{
    pgc: number | null;
  } | null>(null);
  const collectionToken = useMemo(() => newCollectionToken(), []);

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
    const matchesName = createCatalogQueryMatcher(query);
    return objects.filter(
      (object) =>
        (sampleIds === null || sampleIds.has(object.pgc)) &&
        (coordinateQuery || matchesName(object)) &&
        matchesScientificFilters(object, filters) &&
        (nearby === null || isWithinSkyRadius(object, nearby, radiusArcmin)) &&
        (region === null || regionContains(region, object.ra, object.dec)),
    );
  }, [objects, query, filters, nearby, radiusArcmin, region, sampleIds]);

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

  useEffect(() => {
    if (objects === null) return;
    const restoreY = consumeCollectionReturn();
    if (restoreY !== null) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: restoreY, behavior: "auto" }),
      );
    }
  }, [objects]);

  function rememberSkySelection(pgc: number | null) {
    pendingSkySelection.current = pgc;
  }
  function returnSpatialSelection(pgc: number | null) {
    setSkySelectionRequest({ pgc });
  }
  function changeSpatialOpen(open: boolean) {
    if (open) {
      setLaunchSelection(pendingSkySelection.current);
      pendingSkySelection.current = undefined;
    }
    window.history.replaceState(
      window.history.state,
      "",
      atlasSpatialUrl(window.location.href, open),
    );
    setSpatialOpen(open);
  }
  function clearSpatialSample() {
    window.history.replaceState(
      window.history.state,
      "",
      spatialSampleUrl(window.location.href, null),
    );
    setSpatialSample({ token: null, sample: null });
  }
  function transferSpatialSample(sample: SpatialSample): boolean {
    const saved = storeSpatialSample(sample);
    if (!saved) return false;
    const sampleUrl = spatialSampleUrl(window.location.href, saved.token);
    window.history.replaceState(
      window.history.state,
      "",
      atlasSpatialUrl(new URL(sampleUrl, window.location.origin).href, false),
    );
    setSpatialSample(saved);
    pendingSkySelection.current = undefined;
    setLaunchSelection(undefined);
    setSkySelectionRequest({ pgc: null });
    setSpatialOpen(false);
    return true;
  }
  function saveAtlasNavigation() {
    saveCollection(collectionToken, {
      origin: "atlas",
      label: "Atlas",
      returnTo: `${window.location.pathname}${window.location.search}`,
      pgcs: gridObjects.map((object) => object.pgc),
      scrollY: window.scrollY,
    });
  }

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
          <section
            ref={skyRef}
            className={`catalog-sky lv-sky-3d-host${atlasMaximized ? " atlas-sky--maximized" : ""}`}
            aria-label="Sky"
          >
            <AladinMap
              onAtlasCamera={onCameraReady}
              onAtlasSelectionChange={rememberSkySelection}
              atlasSelectionRequest={skySelectionRequest}
              objects={filtered}
              referenceObjects={objects}
              onObjectNavigate={(pgc) => {
                if (!gridObjects.some((row) => row.pgc === pgc)) return null;
                saveAtlasNavigation();
                return `/object/${pgc}?nav=${encodeURIComponent(collectionToken)}`;
              }}
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
            <button
              type="button"
              className="lv-sky-3d-launch"
              aria-haspopup="dialog"
              onClick={() => changeSpatialOpen(true)}
              disabled={spatialOpen}
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M10 2 17 6v8l-7 4-7-4V6z M3 6l7 4 7-4 M10 10v8" />
              </svg>
              3D Atlas
            </button>
            <button
              type="button"
              className={`atlas-fullscreen-toggle${atlasMaximized ? " atlas-fullscreen-toggle--exit" : ""}`}
              aria-label={
                atlasMaximized ? "Exit maximized sky map" : "Maximize sky map"
              }
              aria-pressed={atlasMaximized}
              onClick={() => (atlasMaximized ? leave() : enter())}
            >
              {atlasMaximized ? "Exit fullscreen" : "Fullscreen"}
            </button>
            {atlasMaximized ? (
              <p className="atlas-fullscreen-hint">
                Rotate your phone for a wider view
              </p>
            ) : null}
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
                objects={gridObjects}
                total={objects.length}
                query={query}
                filters={filters}
                region={region}
                nearby={nearby}
                radiusArcmin={radiusArcmin}
              />
            </div>
            {spatialSample.token !== null ? (
              <div
                className="atlas-overview-commandbar"
                role="group"
                aria-label="Frozen spatial sample"
              >
                <span role="status">
                  {spatialSample.sample
                    ? `${spatialSampleLabel(spatialSample.sample)} · ${gridObjects.length} / ${spatialSample.sample.pgcs.length} galaxies`
                    : "Spatial sample unavailable · no galaxies selected"}
                </span>
                <div className="lv-spatial-views">
                  {spatialSample.sample ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (spatialSample.sample)
                          downloadSpatialSample(spatialSample.sample);
                      }}
                    >
                      Export sample JSON
                    </button>
                  ) : null}
                  <button type="button" onClick={clearSpatialSample}>
                    Clear spatial sample
                  </button>
                </div>
              </div>
            ) : null}
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
                clearSpatialSample();
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
                    navigationKey={collectionToken}
                    onOpen={saveAtlasNavigation}
                  />
                ))}
              </div>
            )}
          </section>
          {spatialOpen ? (
            <Suspense
              fallback={
                <p role="status">
                  Loading Spatial Atlas…{" "}
                  <button
                    type="button"
                    onClick={() => changeSpatialOpen(false)}
                  >
                    Cancel
                  </button>
                </p>
              }
            >
              <SpatialAtlasView
                objects={gridObjects}
                onTransferSample={transferSpatialSample}
                initialSkySelection={launchSelection}
                onSelectionReturn={returnSpatialSelection}
                onClose={() => changeSpatialOpen(false)}
                onShowSky={(pgc) => {
                  const object = gridObjects.find((row) => row.pgc === pgc);
                  if (object) locate(object);
                }}
                onObjectNavigate={(pgc) => {
                  if (!gridObjects.some((row) => row.pgc === pgc)) return null;
                  saveAtlasNavigation();
                  return `/object/${pgc}?nav=${encodeURIComponent(collectionToken)}`;
                }}
              />
            </Suspense>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
