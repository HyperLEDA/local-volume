import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CatalogObject } from "../api/objects.ts";
import {
  atlasFieldPartition,
  fetchPhysicalGroupSnapshot,
  atlasScopePoints,
  atlasVisiblePoints,
  buildAtlasGroupBubbles,
  buildAtlasSpatialRows,
  type AtlasDistanceMode,
  type AtlasKind,
  type PhysicalGroupSnapshot,
} from "../lib/atlasSpatialScene.ts";
import {
  ATLAS_COLOR_OPTIONS,
  ATLAS_MISSING_COLOR,
  ATLAS_UPPER_LIMIT_COLOR,
  atlasColorForPgc,
  atlasNumericDefinition,
  buildAtlasColorEncoding,
  isPhotometryColor,
  type AtlasColorMode,
  type AtlasColorEncoding,
} from "../lib/atlasColorEncoding.ts";
import {
  fetchAtlasPhotometry,
  type AtlasPhotometry,
} from "../lib/atlasPhotometry.ts";
import {
  ATLAS_SIZE_OPTIONS,
  ATLAS_DENSITY_OPTIONS,
  atlasMarkerDiameter,
  type AtlasSizeMode,
  type AtlasMarkerDensity,
} from "../lib/atlasMarkerSize.ts";
import {
  createAtlasRenderer,
  type AtlasDisplayMode,
  type AtlasProjection,
  type AtlasTheme,
} from "../lib/atlasSpatialRenderer.ts";
import {
  atlasMdEdges,
  type AtlasLayers,
} from "../lib/atlasScientificLayers.ts";
import {
  atlasDisplayedIntervals,
  type AtlasIntervalMode,
} from "../lib/atlasDistanceIntervals.ts";
import {
  observerAxisLabels,
  type ObserverFrame,
} from "../lib/spatialFrames.ts";
import {
  ATLAS_SHELL_RADII,
  toggleAtlasShell,
  type AtlasGuides,
} from "../lib/atlasSpatialGuides.ts";
import type { SceneView } from "../lib/spatialRenderPolicy.ts";
import {
  atlasCameraKey,
  readAtlasCamera,
  readAtlasPreferences,
  saveAtlasCamera,
  saveAtlasPreferences,
  applySkySelection,
  decodeAtlasPreferences,
  clearAtlasCamera,
} from "../lib/atlasSession.ts";
import {
  parseAtlasSlice,
  sliceBounds,
  slicePoints,
  type AtlasSlice,
  type SliceAxis,
} from "../lib/atlasSpatialSlice.ts";
import {
  parseAtlasRegion,
  regionPoints,
  type AtlasRegion,
  type AtlasRegionKind,
} from "../lib/atlasSpatialRegion.ts";
import {
  makeSpatialSample,
  type SpatialSample,
} from "../lib/atlasSpatialSample.ts";
import {
  POPULATION_OPTIONS,
  defaultPopulation,
  populationMembership,
  populationCounts,
  populationPoints,
  type AtlasPopulation,
  type PopulationId,
  type PopulationMode,
} from "../lib/atlasPopulation.ts";
import {
  comparePopulations,
  defaultComparison,
  COMPARISON_CLASSES,
  COMPARISON_COLORS,
  COMPARISON_LABELS,
  type PopulationComparison,
} from "../lib/atlasPopulationComparison.ts";
import { downloadSpatialPng } from "../lib/spatialImageExport.ts";
import "./SpatialAtlasView.css";
type SelectionKind = "slice" | AtlasRegionKind;
type ControlPage = "view" | "appearance" | "select" | "compare";

const KIND_LABELS: Record<AtlasKind, string> = {
  individual: "Individual catalogue distance",
  assigned: "Group-assigned estimate",
  model: "Model estimate",
  unknown: "Unclassified estimate",
};
const MODES: { value: AtlasDistanceMode; label: string; title: string }[] = [
  {
    value: "individual",
    label: "Individual",
    title: "Individual catalogue distances, not necessarily verified",
  },
  {
    value: "catalogue",
    label: "All estimates",
    title: "Include group-assigned, model and unclassified estimates",
  },
  {
    value: "verified",
    label: "Verified",
    title: "Independently verified positions only",
  },
];
const FRAMES: { value: ObserverFrame; label: string }[] = [
  { value: "SUPERGALACTIC", label: "Supergalactic" },
  { value: "GALACTIC", label: "Galactic" },
  { value: "ICRS", label: "ICRS" },
];
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="lv-spatial-choice" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => {
            if (value !== option.value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
function matchesQuery(value: string, query: string) {
  function normalise(text: string) {
    return text.toLowerCase().replace(/\s+/g, "");
  }
  return normalise(value).includes(normalise(query));
}
function pgcName(name: string, pgc: number) {
  return /^pgc\s*0*\d+$/i.test(name.trim()) &&
    Number(name.trim().replace(/^pgc\s*/i, "")) === pgc
    ? name
    : `${name} · PGC ${pgc}`;
}
function display(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n)
    ? Number(n.toPrecision(5)).toString()
    : "—";
}

function ColorLegend({
  encoding,
  pgcs,
  groupMode,
}: {
  encoding: AtlasColorEncoding;
  pgcs: readonly number[];
  groupMode: boolean;
}) {
  const scale = encoding.scale;
  const definition = atlasNumericDefinition(encoding.mode);
  const missing = pgcs.filter(
    (pgc) => !encoding.values.has(pgc) && !encoding.limits.has(pgc),
  ).length;
  const limits = pgcs.filter((pgc) => encoding.limits.has(pgc)).length;
  const estimated = pgcs.filter((pgc) => encoding.estimated.has(pgc)).length;
  return (
    <div className="lv-spatial-color-legend">
      <strong>
        {definition
          ? `${definition.label}${definition.unit ? ` [${definition.unit}]` : ""}`
          : "Colour scale"}
      </strong>
      {scale ? (
        <>
          <div
            className="lv-spatial-color-bar"
            style={{
              background:
                scale.min === scale.max
                  ? scale.stops[1]
                  : `linear-gradient(to right, ${scale.stops.join(", ")})`,
            }}
          />
          <div className="lv-spatial-color-ticks">
            {scale.min === scale.max ? (
              <span>{display(scale.min)}</span>
            ) : (
              <>
                <span>{display(scale.min)}</span>
                {scale.signed ? <span>0</span> : null}
                <span>{display(scale.max)}</span>
              </>
            )}
          </div>
        </>
      ) : null}
      {!scale ? (
        <span className="lv-spatial-help">No uncensored values for scale.</span>
      ) : null}
      <span className="lv-spatial-help">
        <i
          className="lv-spatial-color-swatch"
          style={{ background: ATLAS_MISSING_COLOR }}
        />{" "}
        Missing: {missing} / {pgcs.length}
      </span>
      {limits > 0 ? (
        <span className="lv-spatial-help">
          <i
            className="lv-spatial-color-swatch"
            style={{ background: ATLAS_UPPER_LIMIT_COLOR }}
          />{" "}
          H I upper limits: {limits}
        </span>
      ) : null}
      {estimated > 0 ? (
        <span className="lv-spatial-help">
          Estimated Ks photometry: {estimated}
        </span>
      ) : null}
      <span className="lv-spatial-help">
        Atlas selection scale{groupMode ? " · group colour = root value" : ""}
      </span>
    </div>
  );
}
function ActiveColorValue({
  encoding,
  pgc,
}: {
  encoding: AtlasColorEncoding;
  pgc: number;
}) {
  if (encoding.mode === "morphology" || encoding.mode === "neutral")
    return null;
  const definition = atlasNumericDefinition(encoding.mode);
  const limit = encoding.limits.get(pgc);
  const value = limit ?? encoding.values.get(pgc);
  return (
    <div className="lv-spatial-active-color">
      <i
        className="lv-spatial-color-swatch"
        style={{ background: atlasColorForPgc(encoding, pgc) }}
      />
      <span>
        {definition?.label}: {limit !== undefined ? "< " : ""}
        {display(value)}
        {value !== undefined && definition?.unit ? ` ${definition.unit}` : ""}
        {encoding.estimated.has(pgc) ? " · estimated Ks" : ""}
      </span>
    </div>
  );
}

export default function SpatialAtlasView({
  objects,
  onClose,
  onObjectNavigate,
  onShowSky,
  initialSkySelection,
  onSelectionReturn,
  onTransferSample,
}: {
  objects: readonly CatalogObject[];
  onClose: () => void;
  onObjectNavigate: (pgc: number) => string | null;
  onShowSky: (pgc: number) => void;
  initialSkySelection?: number | null;
  onSelectionReturn: (pgc: number | null) => void;
  onTransferSample: (sample: SpatialSample) => boolean;
}) {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const scale = useRef<HTMLDivElement>(null);
  const engine = useRef<ReturnType<typeof createAtlasRenderer> | null>(null);
  const [restored] = useState(() => {
    const allowed = new Set(objects.map((object) => object.pgc));
    return applySkySelection(
      readAtlasPreferences(
        allowed,
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
      ),
      initialSkySelection,
      allowed,
    );
  });
  const [controlPage, setControlPage] = useState<ControlPage>("view");
  const controlScroll = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<ObserverFrame>(restored.frame);
  const [projection, setProjection] = useState<AtlasProjection>(
    restored.projection,
  );
  const [mode, setMode] = useState<AtlasDistanceMode>(restored.mode);
  const [displayMode, setDisplayMode] = useState<AtlasDisplayMode>(
    restored.displayMode,
  );
  const [theme, setTheme] = useState<AtlasTheme>(restored.theme);
  const [colorMode, setColorMode] = useState<AtlasColorMode>(
    restored.colorMode,
  );
  const [photometry, setPhotometry] = useState<AtlasPhotometry | null>(null);
  const [photometryError, setPhotometryError] = useState(false);
  const [photometryRetry, setPhotometryRetry] = useState(0);
  const [sizeMode, setSizeMode] = useState<AtlasSizeMode>(restored.sizeMode);
  const [markerDensity, setMarkerDensity] = useState<AtlasMarkerDensity>(
    restored.markerDensity,
  );
  const [localOnly, setLocalOnly] = useState(restored.localOnly);
  const [grid, setGrid] = useState(restored.grid);
  const [guides, setGuides] = useState<AtlasGuides>(restored.guides);
  const [layers, setLayers] = useState<AtlasLayers>(restored.layers);
  const [intervalMode, setIntervalMode] = useState<AtlasIntervalMode>(
    restored.intervalMode,
  );
  const [comparison, setComparison] = useState<PopulationComparison | null>(
    restored.comparison,
  );
  const [population, setPopulation] = useState<AtlasPopulation>(
    restored.population,
  );
  const [slice, setSlice] = useState<AtlasSlice | null>(restored.slice);
  const [region, setRegion] = useState<AtlasRegion | null>(restored.region);
  const [selectionKind, setSelectionKind] = useState<SelectionKind>(
    restored.region?.kind ?? "slice",
  );
  const [selectionFrame, setSelectionFrame] = useState<ObserverFrame>(
    restored.region?.frame ?? restored.slice?.frame ?? restored.frame,
  );
  const [regionCentre, setRegionCentre] = useState(
    (restored.region?.centreMpc ?? [0, 0, 0]).map(String),
  );
  const [regionRadius, setRegionRadius] = useState(
    String(restored.region?.kind === "sphere" ? restored.region.radiusMpc : 2),
  );
  const [regionSize, setRegionSize] = useState(
    (restored.region?.kind === "box" ? restored.region.sizeMpc : [4, 4, 4]).map(
      String,
    ),
  );
  const [sliceAxis, setSliceAxis] = useState<SliceAxis>(
    restored.slice?.axis ?? "2",
  );
  const [sliceCentre, setSliceCentre] = useState(
    String(restored.slice?.centreMpc ?? 0),
  );
  const [sliceThickness, setSliceThickness] = useState(
    String(restored.slice?.thicknessMpc ?? 2),
  );
  const [query, setQuery] = useState("");
  const [sampleError, setSampleError] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [searchKind, setSearchKind] = useState<AtlasDisplayMode>(
    restored.selectedGalaxy !== null ? "galaxies" : restored.displayMode,
  );
  const [browseOpen, setBrowseOpen] = useState(false);
  const [resultLimit, setResultLimit] = useState(40);
  const [groupCatalogue, setGroupCatalogue] =
    useState<PhysicalGroupSnapshot | null>(null);
  const [groupError, setGroupError] = useState(false);
  const [groupRetry, setGroupRetry] = useState(0);
  const [selectedGalaxy, setSelectedGalaxy] = useState<number | null>(
    restored.selectedGalaxy,
  );
  const [selectedGroup, setSelectedGroup] = useState<number | null>(
    restored.selectedGroup,
  );
  const [hits, setHits] = useState<number[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const resetGeneration = useRef(0);
  const [resetRevision, setResetRevision] = useState(0);
  const rows = useMemo(
    () => buildAtlasSpatialRows(objects, frame),
    [objects, frame],
  );
  const photometryMismatch =
    photometry !== null &&
    rows.some(
      (row) =>
        row.position !== null &&
        (row.evidence?.distance_computed_revision !== photometry.revision ||
          row.evidence.distance_formula_version !== photometry.formulaVersion ||
          !photometry.rows.has(row.object.pgc)),
    );
  const baseColor = useMemo(
    () => buildAtlasColorEncoding(rows, colorMode, photometry),
    [rows, colorMode, photometry],
  );
  const depthPoints = useMemo(
    () => atlasVisiblePoints(rows, mode),
    [rows, mode],
  );
  const points = useMemo(
    () => atlasScopePoints(depthPoints, localOnly),
    [depthPoints, localOnly],
  );
  const groups = useMemo(
    () => buildAtlasGroupBubbles(points, groupCatalogue?.groups ?? []),
    [points, groupCatalogue],
  );
  const partition = useMemo(
    () => atlasFieldPartition(points, groupCatalogue),
    [points, groupCatalogue],
  );
  const activeSlice = displayMode === "galaxies" ? slice : null;
  const activeRegion = displayMode === "galaxies" ? region : null;
  const selectionActive = activeSlice !== null || activeRegion !== null;
  const slicedPoints = useMemo(
    () =>
      regionPoints(
        slicePoints(points, frame, activeSlice),
        frame,
        activeRegion,
      ),
    [points, frame, activeSlice, activeRegion],
  );
  const membership = useMemo(
    () => populationMembership(groupCatalogue),
    [groupCatalogue],
  );
  const counts = useMemo(
    () => populationCounts(slicedPoints, membership),
    [slicedPoints, membership],
  );
  const populationActive =
    displayMode === "galaxies" && population.ids.length > 0;
  const membershipNeeded =
    populationActive &&
    population.ids.some(
      (id) => id === "root" || id === "member" || id === "field",
    );
  const populationReady = !membershipNeeded || groupCatalogue !== null;
  const filteredPoints = useMemo(
    () =>
      !populationReady
        ? []
        : populationActive
          ? populationPoints(slicedPoints, membership, population)
          : slicedPoints,
    [slicedPoints, membership, population, populationActive, populationReady],
  );
  const activeComparison = displayMode === "galaxies" ? comparison : null;
  const comparisonResult = useMemo(
    () =>
      activeComparison &&
      activeComparison.a.ids.length &&
      activeComparison.b.ids.length
        ? comparePopulations(filteredPoints, membership, activeComparison)
        : null,
    [filteredPoints, membership, activeComparison],
  );
  const color = useMemo(
    () =>
      comparisonResult
        ? { ...baseColor, comparisonColors: comparisonResult.colors }
        : baseColor,
    [baseColor, comparisonResult],
  );
  const renderPoints =
    displayMode === "groups" ? partition.field : filteredPoints;
  const baseRenderPoints = displayMode === "groups" ? partition.field : points;
  const referenceExtent = useMemo(
    () =>
      points.reduce(
        (extent, point) => Math.max(extent, Math.hypot(...point.position)),
        0,
      ),
    [points],
  );
  const mdEdges = useMemo(
    () => (displayMode === "galaxies" ? atlasMdEdges(filteredPoints) : []),
    [displayMode, filteredPoints],
  );
  const visibleGroups = layers.groups ? groups : [];
  const visiblePoints =
    displayMode === "groups" && !layers.field ? [] : renderPoints;
  const fieldIds = useMemo(
    () => new Set(partition.field.map((point) => point.object.pgc)),
    [partition],
  );
  const depthIds = useMemo(
    () => new Set(depthPoints.map((p) => p.object.pgc)),
    [depthPoints],
  );
  const shown = useMemo(
    () => new Set(filteredPoints.map((p) => p.object.pgc)),
    [filteredPoints],
  );
  const shownGroups = useMemo(
    () => new Set(groups.map((g) => g.pgc)),
    [groups],
  );
  const currentGroup =
    displayMode === "groups"
      ? (visibleGroups.find((group) => group.pgc === selectedGroup) ?? null)
      : null;
  const currentGalaxy = rows.find(
    (row) =>
      row.object.pgc === selectedGalaxy &&
      ((displayMode === "galaxies" &&
        ((!selectionActive && !populationActive) ||
          shown.has(row.object.pgc))) ||
        (displayMode === "groups" &&
          layers.field &&
          currentGroup === null &&
          fieldIds.has(row.object.pgc))),
  );
  const available = rows.filter((r) => r.position !== null).length;
  const verified = rows.filter((r) => r.verified).length;
  const names = useMemo(
    () => new Map(rows.map((r) => [r.object.pgc, r.object.name])),
    [rows],
  );
  const sceneShown = useMemo(
    () =>
      displayMode === "groups" ? new Set([...shownGroups, ...fieldIds]) : shown,
    [displayMode, shownGroups, fieldIds, shown],
  );
  const activeShown = useMemo(
    () =>
      displayMode === "groups"
        ? new Set([
            ...(layers.groups ? shownGroups : []),
            ...(layers.field ? fieldIds : []),
          ])
        : shown,
    [displayMode, shownGroups, fieldIds, shown, layers.groups, layers.field],
  );
  const allIntervals = useMemo(
    () => atlasDisplayedIntervals(points, sceneShown),
    [points, sceneShown],
  );
  const intervals = allIntervals.filter((entry) => activeShown.has(entry.pgc));
  const choices = hits.filter((id) => activeShown.has(id));
  const searchableRows = useMemo(
    () =>
      rows.filter((r) =>
        displayMode === "galaxies"
          ? (!selectionActive && !populationActive) || shown.has(r.object.pgc)
          : layers.field && fieldIds.has(r.object.pgc),
      ),
    [
      rows,
      displayMode,
      fieldIds,
      layers.field,
      selectionActive,
      populationActive,
      shown,
    ],
  );
  const matchingRows = useMemo(
    () =>
      searchableRows.filter((r) =>
        matchesQuery(
          `${r.object.name} PGC ${r.object.pgc} ${r.object.names.join(" ")}`,
          query,
        ),
      ),
    [searchableRows, query],
  );
  const matchingGroups = useMemo(
    () =>
      groups.filter(
        (group) =>
          layers.groups &&
          matchesQuery(`${group.name} PGC ${group.pgc}`, query),
      ),
    [groups, query, layers.groups],
  );
  const browsingGroups = displayMode === "groups" && searchKind === "groups";
  const results = browsingGroups
    ? matchingGroups.map((group) => ({
        pgc: group.pgc,
        name: pgcName(group.name, group.pgc),
        detail: `${group.memberCount} members`,
        kind: "group" as const,
      }))
    : matchingRows.map((row) => ({
        pgc: row.object.pgc,
        name: pgcName(row.object.name, row.object.pgc),
        detail: shown.has(row.object.pgc)
          ? `${display(row.evidence?.dist_mpc)} Mpc`
          : "Not shown",
        kind: "galaxy" as const,
      }));
  const selectedPgc =
    displayMode === "groups"
      ? (currentGroup?.pgc ?? currentGalaxy?.object.pgc ?? null)
      : (currentGalaxy?.object.pgc ?? null);
  const selectedInterval = intervals.find((entry) => entry.pgc === selectedPgc);
  const latest = useRef({
    theme,
    color,
    grid,
    selectedPgc,
    sizeMode,
    markerDensity,
    intervalMode,
    layers,
    guides,
  });
  const axisNames = observerAxisLabels(frame);
  const cameraKey = useMemo(
    () =>
      atlasCameraKey(
        frame,
        projection,
        mode,
        localOnly,
        displayMode,
        baseRenderPoints,
        groups,
      ),
    [frame, projection, mode, localOnly, displayMode, baseRenderPoints, groups],
  );
  useEffect(() => {
    saveAtlasPreferences({
      frame,
      projection,
      mode,
      displayMode,
      theme,
      colorMode,
      sizeMode,
      markerDensity,
      localOnly,
      grid,
      guides,
      layers,
      intervalMode,
      selectedGalaxy,
      selectedGroup,
      slice,
      region,
      population,
      comparison,
    });
  }, [
    frame,
    projection,
    mode,
    displayMode,
    theme,
    colorMode,
    sizeMode,
    markerDensity,
    localOnly,
    grid,
    guides,
    layers,
    intervalMode,
    selectedGalaxy,
    selectedGroup,
    slice,
    region,
    population,
    comparison,
  ]);
  useEffect(() => {
    let cancelled = false;
    setPhotometryError(false);
    void fetchAtlasPhotometry()
      .then((data) => {
        if (!cancelled) setPhotometry(data);
      })
      .catch(() => {
        if (!cancelled) setPhotometryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [photometryRetry]);
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  useEffect(() => {
    latest.current = {
      theme,
      color,
      grid,
      selectedPgc,
      sizeMode,
      markerDensity,
      intervalMode,
      layers,
      guides,
    };
    engine.current?.style(theme, color);
    engine.current?.select(selectedPgc);
    engine.current?.setGrid(grid);
    engine.current?.setGuides(guides);
    engine.current?.setIntervalMode(intervalMode);
    engine.current?.setLayers(layers);
    engine.current?.setMarkerSize(sizeMode, markerDensity);
  }, [
    theme,
    color,
    selectedPgc,
    grid,
    sizeMode,
    markerDensity,
    intervalMode,
    layers,
    guides,
  ]);
  useEffect(() => {
    let cancelled = false;
    setGroupCatalogue(null);
    setGroupError(false);
    void fetchPhysicalGroupSnapshot()
      .then((catalogue) => {
        if (!cancelled) setGroupCatalogue(catalogue);
      })
      .catch(() => {
        if (!cancelled) setGroupError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [groupRetry]);
  useEffect(() => {
    if (!host.current || !overlay.current || !scale.current) return;
    const h = host.current,
      o = overlay.current,
      s = scale.current;
    setError(false);
    setHits([]);
    if (displayMode === "groups" && groupCatalogue === null) {
      s.textContent = "";
      s.style.width = "0";
      return;
    }
    function makePersistCamera(
      renderer: ReturnType<typeof createAtlasRenderer>,
    ) {
      function persistCamera() {
        if (resetGeneration.current !== resetRevision) return;
        const camera = renderer.cameraState();
        if (camera) saveAtlasCamera(cameraKey, camera);
      }
      return persistCamera;
    }
    try {
      const next = createAtlasRenderer(
        h,
        o,
        s,
        renderPoints,
        groups,
        {
          projection,
          cameraState: readAtlasCamera(cameraKey, projection),
          axes: observerAxisLabels(frame),
          theme: latest.current.theme,
          color: latest.current.color,
          sizeMode: latest.current.sizeMode,
          markerDensity: latest.current.markerDensity,
          grid: latest.current.grid,
          frame,
          guides: latest.current.guides,
          intervalMode: latest.current.intervalMode,
          intervals: allIntervals,
          layers: latest.current.layers,
          mdEdges,
          displayMode,
          slice: activeSlice,
          region: activeRegion,
          referenceExtent:
            displayMode === "galaxies" ? referenceExtent : undefined,
        },
        (ids) => {
          setHits(ids.length > 1 ? ids : []);
          if (ids.length === 0) {
            setSelectedGalaxy(null);
            setSelectedGroup(null);
            setBrowseOpen(false);
          } else if (ids.length === 1) {
            setBrowseOpen(false);
            if (displayMode === "groups" && shownGroups.has(ids[0])) {
              setSearchKind("groups");
              setSelectedGroup(ids[0]);
              setSelectedGalaxy(null);
            } else {
              setSearchKind("galaxies");
              setSelectedGalaxy(ids[0]);
              if (displayMode === "groups") setSelectedGroup(null);
            }
          }
        },
        () => setError(true),
      );
      next.select(latest.current.selectedPgc);
      engine.current = next;
      const persistCamera = makePersistCamera(next);
      window.addEventListener("pagehide", persistCamera);
      return () => {
        window.removeEventListener("pagehide", persistCamera);
        persistCamera();
        next.dispose();
        engine.current = null;
      };
    } catch {
      h.replaceChildren();
      o.replaceChildren();
      setError(true);
    }
  }, [
    renderPoints,
    groups,
    frame,
    projection,
    retry,
    displayMode,
    shownGroups,
    groupCatalogue,
    allIntervals,
    mdEdges,
    cameraKey,
    resetRevision,
    activeSlice,
    activeRegion,
    referenceExtent,
  ]);
  function chooseGalaxy(pgc: number) {
    setSelectedGalaxy(pgc);
    if (displayMode === "groups") setSelectedGroup(null);
    setHits([]);
    setBrowseOpen(false);
    setSearchKind("galaxies");
  }
  function chooseGroup(pgc: number) {
    setSelectedGroup(pgc);
    setSelectedGalaxy(null);
    setHits([]);
    setBrowseOpen(false);
    setSearchKind("groups");
  }
  function clearSelection() {
    setSelectedGalaxy(null);
    setSelectedGroup(null);
    setHits([]);
    setBrowseOpen(false);
  }
  function changeLayer(key: keyof AtlasLayers, enabled: boolean) {
    setLayers((prev) => ({ ...prev, [key]: enabled }));
    if (!enabled && key === "groups") {
      setSelectedGroup(null);
      setHits([]);
      setBrowseOpen(false);
    }
    if (!enabled && key === "field") {
      setSelectedGalaxy(null);
      setHits([]);
      setBrowseOpen(false);
    }
  }
  function changeDisplay(value: AtlasDisplayMode) {
    setDisplayMode(value);
    if (value === "groups") {
      setSlice(null);
      setRegion(null);
      setPopulation(defaultPopulation());
      setComparison(null);
    }
    setSearchKind(value);
    setQuery("");
    setResultLimit(40);
    setBrowseOpen(false);
    setHits([]);
  }
  function changeSearchKind(value: AtlasDisplayMode) {
    setSearchKind(value);
    setResultLimit(40);
    setBrowseOpen(true);
  }
  function applySelection() {
    if (displayMode !== "galaxies") return;
    const nextSlice =
      selectionKind === "slice"
        ? parseAtlasSlice(
            selectionFrame,
            sliceAxis,
            sliceCentre,
            sliceThickness,
          )
        : null;
    const nextRegion =
      selectionKind !== "slice"
        ? parseAtlasRegion(
            selectionKind,
            selectionFrame,
            regionCentre,
            regionRadius,
            regionSize,
          )
        : null;
    if (!nextSlice && !nextRegion) return;
    setSampleError(false);
    setSlice(nextSlice);
    setRegion(nextRegion);
    setHits([]);
    setResultLimit(40);
    if (
      selectedGalaxy !== null &&
      !regionPoints(
        slicePoints(points, frame, nextSlice),
        frame,
        nextRegion,
      ).some((point) => point.object.pgc === selectedGalaxy)
    )
      clearSelection();
  }
  function clearSpatialSelection() {
    setSlice(null);
    setRegion(null);
    setHits([]);
    setSampleError(false);
  }
  function changePopulation(next: AtlasPopulation) {
    setPopulation(next);
    setSampleError(false);
    setHits([]);
    setResultLimit(40);
    if (
      selectedGalaxy !== null &&
      !populationPoints(slicedPoints, membership, next).some(
        (point) => point.object.pgc === selectedGalaxy,
      )
    )
      clearSelection();
  }
  function togglePopulation(id: PopulationId, checked: boolean) {
    changePopulation({
      ...population,
      ids: POPULATION_OPTIONS.map((option) => option.id).filter((value) =>
        value === id ? checked : population.ids.includes(value),
      ),
    });
  }
  function updateComparison(side: "a" | "b", next: AtlasPopulation) {
    setComparison((previous) =>
      previous ? { ...previous, [side]: next } : previous,
    );
  }
  function toggleComparison(
    side: "a" | "b",
    id: PopulationId,
    checked: boolean,
  ) {
    if (!comparison) return;
    const current = comparison[side];
    updateComparison(side, {
      ...current,
      ids: POPULATION_OPTIONS.map((option) => option.id).filter((value) =>
        value === id ? checked : current.ids.includes(value),
      ),
    });
  }
  function transferSample() {
    if ((!selectionActive && !populationActive) || !populationReady) return;
    const sample = makeSpatialSample(
      filteredPoints.map((point) => point.object.pgc),
      activeSlice,
      activeRegion,
      mode,
      localOnly,
      populationActive ? population : undefined,
    );
    if (!sample || !onTransferSample(sample)) setSampleError(true);
  }
  function changeControlPage(next: ControlPage) {
    setControlPage(next);
    if (controlScroll.current) controlScroll.current.scrollTop = 0;
  }
  function resetAtlas() {
    const defaults = decodeAtlasPreferences(
      null,
      new Set<number>(),
      document.documentElement.dataset.theme === "light" ? "light" : "dark",
    );
    resetGeneration.current += 1;
    clearAtlasCamera();
    saveAtlasPreferences(defaults);
    setSampleError(false);
    setPopulation(defaults.population);
    setComparison(null);
    setSlice(null);
    setRegion(null);
    setSelectionKind("slice");
    setSelectionFrame(defaults.frame);
    setRegionCentre(["0", "0", "0"]);
    setRegionRadius("2");
    setRegionSize(["4", "4", "4"]);
    setSliceAxis("2");
    setSliceCentre("0");
    setSliceThickness("2");
    setFrame(defaults.frame);
    setProjection(defaults.projection);
    setMode(defaults.mode);
    setDisplayMode(defaults.displayMode);
    setTheme(defaults.theme);
    setColorMode(defaults.colorMode);
    setSizeMode(defaults.sizeMode);
    setMarkerDensity(defaults.markerDensity);
    setLocalOnly(defaults.localOnly);
    setGrid(defaults.grid);
    setGuides(defaults.guides);
    setLayers(defaults.layers);
    setIntervalMode(defaults.intervalMode);
    setSelectedGalaxy(null);
    setSelectedGroup(null);
    setHits([]);
    setBrowseOpen(false);
    setSearchKind(defaults.displayMode);
    setQuery("");
    setResultLimit(40);
    setResetRevision(resetGeneration.current);
  }
  async function exportPng() {
    const current = engine.current;
    if (!current || imageBusy) return;
    setImageBusy(true);
    setImageError(false);
    try {
      await downloadSpatialPng(current.exportImage([]));
    } catch {
      setImageError(true);
    } finally {
      setImageBusy(false);
    }
  }
  function focusSelection() {
    if (selectedPgc !== null) engine.current?.focus(selectedPgc);
  }
  function home(view: SceneView) {
    setHits([]);
    engine.current?.home(view);
  }
  function openObject(pgc: number) {
    const url = onObjectNavigate(pgc);
    if (url) void navigate(url);
  }
  function showOnSky(pgc: number) {
    onShowSky(pgc);
    dialog.current?.close();
  }
  function closeAtlas() {
    if (displayMode !== "groups" || groupCatalogue !== null) {
      onSelectionReturn(currentGroup?.pgc ?? currentGalaxy?.object.pgc ?? null);
    }
    onClose();
  }
  const draftValid =
    selectionKind === "slice"
      ? parseAtlasSlice(
          selectionFrame,
          sliceAxis,
          sliceCentre,
          sliceThickness,
        ) !== null
      : parseAtlasRegion(
          selectionKind,
          selectionFrame,
          regionCentre,
          regionRadius,
          regionSize,
        ) !== null;
  const selectionAxes = observerAxisLabels(selectionFrame);
  const canFocus =
    !error && selectedPgc !== null && activeShown.has(selectedPgc);
  return (
    <dialog
      ref={dialog}
      className="lv-spatial-dialog"
      aria-labelledby="lv-spatial-title"
      onClose={closeAtlas}
      onCancel={(event) => {
        event.preventDefault();
        dialog.current?.close();
      }}
    >
      <div className="lv-spatial-workspace">
        <aside
          className="lv-spatial-controls"
          aria-label="Spatial Atlas controls"
        >
          <header className="lv-spatial-header">
            <div>
              <h2 id="lv-spatial-title">Spatial Atlas</h2>
              <p>Local Volume · Mpc</p>
            </div>
            <button
              type="button"
              className="lv-spatial-return"
              onClick={() => dialog.current?.close()}
            >
              ← Sky
            </button>
          </header>
          <div className="lv-spatial-tools">
            <nav className="lv-spatial-tool-nav" aria-label="Atlas tools">
              {(
                [
                  { value: "view", label: "View" },
                  { value: "appearance", label: "Appearance" },
                  { value: "select", label: "Select" },
                  { value: "compare", label: "Compare" },
                ] as const
              ).map((page) => (
                <button
                  key={page.value}
                  type="button"
                  aria-pressed={controlPage === page.value}
                  aria-controls={`lv-spatial-tool-${page.value}`}
                  onClick={() => changeControlPage(page.value)}
                >
                  {page.label}
                  {(page.value === "select" &&
                    (selectionActive || populationActive)) ||
                  (page.value === "compare" && comparison !== null) ? (
                    <span
                      className="lv-spatial-active-dot"
                      aria-label="active"
                    />
                  ) : null}
                </button>
              ))}
            </nav>
            {selectionActive || populationActive || comparison !== null ? (
              <div className="lv-spatial-active-summary" role="status">
                {selectionActive || populationActive ? (
                  <button
                    type="button"
                    onClick={() => changeControlPage("select")}
                    title="Edit active spatial and population filters"
                  >
                    {activeSlice
                      ? "Slice"
                      : activeRegion
                        ? activeRegion.kind === "sphere"
                          ? "Sphere"
                          : "Box"
                        : ""}
                    {selectionActive && populationActive ? " · " : ""}
                    {populationActive
                      ? `${population.ids.length} population criteria`
                      : ""}{" "}
                    · {filteredPoints.length} galaxies
                  </button>
                ) : null}
                {comparison !== null ? (
                  <button
                    type="button"
                    onClick={() => changeControlPage("compare")}
                    title="Edit population comparison"
                  >
                    A/B {comparisonResult ? "active" : "incomplete"}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div ref={controlScroll} className="lv-spatial-sidebar-scroll">
              <div
                id="lv-spatial-tool-view"
                className="lv-spatial-tool-page"
                hidden={controlPage !== "view"}
              >
                <section
                  className="lv-spatial-panel"
                  aria-label="Scene settings"
                >
                  <h3>Display</h3>
                  <Choice<AtlasDisplayMode>
                    label="Objects to display"
                    value={displayMode}
                    onChange={changeDisplay}
                    options={[
                      {
                        value: "groups",
                        label: "Groups + field",
                        title: "Physical Groups and field galaxies",
                      },
                      {
                        value: "galaxies",
                        label: "Galaxies",
                        title: "Individual galaxy positions",
                      },
                    ]}
                  />
                  {displayMode === "groups" ? (
                    <>
                      <label className="lv-spatial-grid-toggle">
                        <input
                          type="checkbox"
                          checked={layers.groups}
                          onChange={(e) =>
                            changeLayer("groups", e.target.checked)
                          }
                        />{" "}
                        Physical groups
                      </label>
                      <label className="lv-spatial-grid-toggle">
                        <input
                          type="checkbox"
                          checked={layers.field}
                          onChange={(e) =>
                            changeLayer("field", e.target.checked)
                          }
                        />{" "}
                        Field galaxies
                      </label>
                    </>
                  ) : (
                    <label className="lv-spatial-grid-toggle">
                      <input
                        type="checkbox"
                        checked={layers.md}
                        onChange={(e) => changeLayer("md", e.target.checked)}
                      />{" "}
                      Catalogue MD links
                    </label>
                  )}
                  <div className="lv-spatial-setting">
                    <span>Volume</span>
                    <Choice<"local" | "all">
                      label="Volume"
                      value={localOnly ? "local" : "all"}
                      onChange={(value) => setLocalOnly(value === "local")}
                      options={[
                        { value: "local", label: "≤ 11 Mpc" },
                        { value: "all", label: "All" },
                      ]}
                    />
                  </div>
                  <div className="lv-spatial-setting">
                    <span>Distance quality</span>
                    <Choice<AtlasDistanceMode>
                      label="Distance quality"
                      value={mode}
                      onChange={setMode}
                      options={MODES}
                    />
                  </div>
                  {mode === "verified" && verified === 0 ? (
                    <p className="lv-spatial-help">
                      No independently verified positions in this selection.
                    </p>
                  ) : null}
                </section>
                <section
                  className="lv-spatial-panel"
                  aria-label="Camera and orientation"
                >
                  <h3>Camera</h3>
                  <Choice<AtlasProjection>
                    label="Camera projection"
                    value={projection}
                    onChange={setProjection}
                    options={[
                      { value: "orthographic", label: "Orthographic" },
                      { value: "perspective", label: "Perspective" },
                    ]}
                  />
                  <div className="lv-spatial-views">
                    <button
                      type="button"
                      disabled={
                        error ||
                        (displayMode === "groups" && groupCatalogue === null)
                      }
                      onClick={() => home("orbit")}
                      title="Fit the whole scene in an oblique view"
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      disabled={
                        error ||
                        (displayMode === "groups" && groupCatalogue === null)
                      }
                      onClick={() => home("XY")}
                    >
                      {axisNames[0]}–{axisNames[1]}
                    </button>
                    <button
                      type="button"
                      disabled={
                        error ||
                        (displayMode === "groups" && groupCatalogue === null)
                      }
                      onClick={() => home("XZ")}
                    >
                      {axisNames[0]}–{axisNames[2]}
                    </button>
                    <button
                      type="button"
                      disabled={
                        error ||
                        (displayMode === "groups" && groupCatalogue === null)
                      }
                      onClick={() => home("YZ")}
                    >
                      {axisNames[1]}–{axisNames[2]}
                    </button>
                  </div>
                </section>
              </div>
              <div
                id="lv-spatial-tool-appearance"
                className="lv-spatial-tool-page"
                hidden={controlPage !== "appearance"}
              >
                <section className="lv-spatial-panel" aria-label="Appearance">
                  <div className="lv-spatial-panel-heading">
                    <h3>Appearance</h3>
                    <button
                      className="lv-spatial-reset-icon"
                      type="button"
                      onClick={resetAtlas}
                      aria-label="Reset 3D Atlas"
                      title="Restore the initial 3D Atlas settings and camera; keep Sky Atlas filters"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="M3 12a9 9 0 1 1 2.64 6.36M3 12V5m0 7h7" />
                      </svg>
                    </button>
                  </div>
                  <div className="lv-spatial-setting lv-spatial-color-options">
                    <span>Colour by</span>
                    {comparisonResult ? (
                      <button
                        type="button"
                        onClick={() => changeControlPage("compare")}
                      >
                        Population comparison · edit
                      </button>
                    ) : (
                      <Choice<AtlasColorMode>
                        label="Colour encoding"
                        value={colorMode}
                        onChange={(value) => {
                          setComparison(null);
                          setColorMode(value);
                        }}
                        options={ATLAS_COLOR_OPTIONS}
                      />
                    )}
                  </div>
                  <div className="lv-spatial-setting">
                    <span>Galaxy size by</span>
                    <Choice<AtlasSizeMode>
                      label="Galaxy size encoding"
                      value={sizeMode}
                      onChange={setSizeMode}
                      options={ATLAS_SIZE_OPTIONS}
                    />
                  </div>
                  <div className="lv-spatial-setting">
                    <span>Marker scale</span>
                    <Choice<AtlasMarkerDensity>
                      label="Galaxy marker scale"
                      value={markerDensity}
                      onChange={setMarkerDensity}
                      options={ATLAS_DENSITY_OPTIONS}
                    />
                  </div>
                  <div className="lv-spatial-setting">
                    <span>Scene theme</span>
                    <Choice<AtlasTheme>
                      label="Scene theme"
                      value={theme}
                      onChange={setTheme}
                      options={[
                        { value: "dark", label: "Dark" },
                        { value: "light", label: "Light" },
                      ]}
                    />
                  </div>
                  <div className="lv-spatial-setting">
                    <span>Distance intervals</span>
                    <Choice<AtlasIntervalMode>
                      label="Distance intervals"
                      value={intervalMode}
                      onChange={setIntervalMode}
                      options={[
                        { value: "off", label: "Off" },
                        { value: "selected", label: "Selected" },
                        { value: "all", label: "All" },
                      ]}
                    />
                  </div>
                  <label className="lv-spatial-grid-toggle">
                    <input
                      type="checkbox"
                      checked={grid}
                      onChange={(e) => setGrid(e.target.checked)}
                    />{" "}
                    {axisNames[0]}–{axisNames[1]} grid
                  </label>
                  <button
                    type="button"
                    disabled={
                      imageBusy ||
                      error ||
                      (displayMode === "groups" && groupCatalogue === null)
                    }
                    onClick={() => {
                      void exportPng();
                    }}
                  >
                    {imageBusy ? "Exporting…" : "Export PNG"}
                  </button>
                  {imageError ? (
                    <p role="alert" className="lv-spatial-help">
                      PNG export failed. Try a smaller viewport or reopen the
                      scene.
                    </p>
                  ) : null}
                </section>
                <section
                  className="lv-spatial-panel"
                  aria-label="Reference guides"
                >
                  <details className="lv-spatial-tool-disclosure">
                    <summary>Reference guides</summary>
                    <label className="lv-spatial-grid-toggle">
                      <input
                        type="checkbox"
                        checked={guides.plane}
                        onChange={(e) =>
                          setGuides((previous) => ({
                            ...previous,
                            plane: e.target.checked,
                          }))
                        }
                      />{" "}
                      Supergalactic plane (SGZ = 0)
                    </label>
                    <div className="lv-spatial-setting">
                      <span>Distance shells [Mpc]</span>
                      <div
                        className="lv-spatial-choice"
                        role="group"
                        aria-label="Observer-centred distance shells"
                      >
                        {ATLAS_SHELL_RADII.map((radius) => (
                          <button
                            key={radius}
                            type="button"
                            aria-pressed={guides.shells.includes(radius)}
                            onClick={() =>
                              setGuides((previous) =>
                                toggleAtlasShell(
                                  previous,
                                  radius,
                                  !previous.shells.includes(radius),
                                ),
                              )
                            }
                          >
                            {radius}
                          </button>
                        ))}
                      </div>
                    </div>
                  </details>
                </section>
              </div>
              <div
                id="lv-spatial-tool-select"
                className="lv-spatial-tool-page"
                hidden={controlPage !== "select"}
              >
                {displayMode === "groups" ? (
                  <section className="lv-spatial-panel">
                    <h3>Spatial &amp; population selection</h3>
                    <p className="lv-spatial-help">
                      Select individual galaxy positions, not group spheres.
                    </p>
                    <button
                      type="button"
                      onClick={() => changeDisplay("galaxies")}
                    >
                      Show galaxies
                    </button>
                  </section>
                ) : (
                  <>
                    <section
                      className="lv-spatial-panel"
                      aria-label="Spatial selection"
                    >
                      <details className="lv-spatial-tool-disclosure" open>
                        <summary>Spatial region</summary>
                        <Choice<SelectionKind>
                          label="Selection shape"
                          value={selectionKind}
                          onChange={setSelectionKind}
                          options={[
                            { value: "slice", label: "Slice" },
                            { value: "sphere", label: "Sphere" },
                            { value: "box", label: "Box" },
                          ]}
                        />
                        <div className="lv-spatial-setting">
                          <span>Selection frame</span>
                          <Choice<ObserverFrame>
                            label="Selection frame"
                            value={selectionFrame}
                            onChange={setSelectionFrame}
                            options={FRAMES}
                          />
                        </div>
                        {selectionKind === "slice" ? (
                          <>
                            <div className="lv-spatial-setting">
                              <span>Normal axis</span>
                              <Choice<SliceAxis>
                                label="Slice normal axis"
                                value={sliceAxis}
                                onChange={setSliceAxis}
                                options={[
                                  { value: "0", label: selectionAxes[0] },
                                  { value: "1", label: selectionAxes[1] },
                                  { value: "2", label: selectionAxes[2] },
                                ]}
                              />
                            </div>
                            <div className="lv-spatial-slice-inputs">
                              <label>
                                Centre [Mpc]
                                <input
                                  type="number"
                                  step="any"
                                  value={sliceCentre}
                                  onChange={(event) =>
                                    setSliceCentre(event.target.value)
                                  }
                                />
                              </label>
                              <label>
                                Thickness [Mpc]
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={sliceThickness}
                                  onChange={(event) =>
                                    setSliceThickness(event.target.value)
                                  }
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="lv-spatial-slice-inputs">
                              {selectionAxes.map((axis, i) => (
                                <label key={i}>
                                  Centre {axis} [Mpc]
                                  <input
                                    type="number"
                                    step="any"
                                    value={regionCentre[i]}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setRegionCentre((prev) =>
                                        prev.map((old, j) =>
                                          j === i ? value : old,
                                        ),
                                      );
                                    }}
                                  />
                                </label>
                              ))}
                              {selectionKind === "sphere" ? (
                                <label>
                                  Radius [Mpc]
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={regionRadius}
                                    onChange={(event) =>
                                      setRegionRadius(event.target.value)
                                    }
                                  />
                                </label>
                              ) : (
                                selectionAxes.map((axis, i) => (
                                  <label key={i}>
                                    Full size {axis} [Mpc]
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={regionSize[i]}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setRegionSize((prev) =>
                                          prev.map((old, j) =>
                                            j === i ? value : old,
                                          ),
                                        );
                                      }}
                                    />
                                  </label>
                                ))
                              )}
                            </div>
                          </>
                        )}
                        <div className="lv-spatial-views">
                          <button
                            type="button"
                            disabled={!draftValid}
                            onClick={applySelection}
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            disabled={!selectionActive}
                            onClick={clearSpatialSelection}
                          >
                            Clear
                          </button>
                        </div>
                        {!draftValid ? (
                          <p className="lv-spatial-help">
                            Enter finite coordinates and positive dimensions.
                          </p>
                        ) : null}
                        {activeSlice ? (
                          <p className="lv-spatial-help" role="status">
                            Slice · {activeSlice.frame} ·{" "}
                            {
                              observerAxisLabels(activeSlice.frame)[
                                Number(activeSlice.axis)
                              ]
                            }
                            :{" "}
                            {sliceBounds(activeSlice).map(display).join(" to ")}{" "}
                            Mpc · {slicedPoints.length} / {points.length}{" "}
                            galaxies.
                          </p>
                        ) : null}
                        {activeRegion ? (
                          <p className="lv-spatial-help" role="status">
                            {activeRegion.kind === "sphere" ? "Sphere" : "Box"}{" "}
                            · {activeRegion.frame} · centre (
                            {activeRegion.centreMpc.map(display).join(", ")})
                            Mpc ·{" "}
                            {activeRegion.kind === "sphere"
                              ? `R = ${display(activeRegion.radiusMpc)} Mpc`
                              : `${activeRegion.sizeMpc.map(display).join(" × ")} Mpc`}{" "}
                            · {slicedPoints.length} / {points.length} galaxies.
                          </p>
                        ) : null}
                        {selectionActive ? (
                          <p className="lv-spatial-help">
                            Individual catalogue distances; nominal positions.
                          </p>
                        ) : null}
                      </details>
                    </section>
                    <section
                      className="lv-spatial-panel"
                      aria-label="Galaxy populations"
                    >
                      <details className="lv-spatial-tool-disclosure">
                        <summary>
                          Populations{" "}
                          {populationActive ? `(${population.ids.length})` : ""}
                        </summary>
                        <Choice<PopulationMode>
                          label="Combine populations"
                          value={population.mode}
                          onChange={(value) =>
                            changePopulation({ ...population, mode: value })
                          }
                          options={[
                            { value: "any", label: "Any (OR)" },
                            { value: "all", label: "All (AND)" },
                          ]}
                        />
                        {POPULATION_OPTIONS.map((option) => (
                          <label
                            key={option.id}
                            className="lv-spatial-grid-toggle"
                            title={option.title}
                          >
                            <input
                              type="checkbox"
                              checked={population.ids.includes(option.id)}
                              onChange={(event) =>
                                togglePopulation(
                                  option.id,
                                  event.target.checked,
                                )
                              }
                            />{" "}
                            {option.label} (
                            {groupCatalogue === null &&
                            (option.id === "root" ||
                              option.id === "member" ||
                              option.id === "field")
                              ? "—"
                              : counts[option.id]}
                            )
                          </label>
                        ))}
                        {groupCatalogue === null ? (
                          <p className="lv-spatial-help" role="status">
                            {groupError ? (
                              <>
                                Membership unavailable.{" "}
                                <button
                                  type="button"
                                  onClick={() => setGroupRetry((n) => n + 1)}
                                >
                                  Retry groups
                                </button>
                              </>
                            ) : (
                              "Loading physical group membership…"
                            )}
                          </p>
                        ) : null}
                        <p className="lv-spatial-help" role="status">
                          {filteredPoints.length} / {slicedPoints.length}{" "}
                          galaxies · counts before population filtering.
                        </p>
                        <div className="lv-spatial-views">
                          <button
                            type="button"
                            disabled={!populationActive}
                            onClick={() =>
                              changePopulation(defaultPopulation())
                            }
                          >
                            Clear populations
                          </button>
                        </div>
                      </details>
                    </section>
                    {selectionActive || populationActive ? (
                      <section className="lv-spatial-panel lv-spatial-transfer">
                        <button
                          type="button"
                          disabled={!populationReady}
                          onClick={transferSample}
                        >
                          Send to Sky Atlas ({filteredPoints.length})
                        </button>
                        {sampleError ? (
                          <p role="alert" className="lv-spatial-help">
                            Sample could not be saved. Check session storage and
                            retry.
                          </p>
                        ) : null}
                      </section>
                    ) : null}
                  </>
                )}
              </div>
              <div
                id="lv-spatial-tool-compare"
                className="lv-spatial-tool-page"
                hidden={controlPage !== "compare"}
              >
                <section
                  className="lv-spatial-panel"
                  aria-label="Population comparison"
                >
                  <h3>Compare populations</h3>
                  {displayMode === "groups" ? (
                    <>
                      <p className="lv-spatial-help">
                        Compare individual galaxy positions.
                      </p>
                      <button
                        type="button"
                        onClick={() => changeDisplay("galaxies")}
                      >
                        Show galaxies
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="lv-spatial-grid-toggle">
                        <input
                          type="checkbox"
                          checked={comparison !== null}
                          onChange={(event) =>
                            setComparison(
                              event.target.checked ? defaultComparison() : null,
                            )
                          }
                        />{" "}
                        Compare A / B
                      </label>
                      {comparison ? (
                        <>
                          {(["a", "b"] as const).map((side) => (
                            <details key={side} className="lv-spatial-details">
                              <summary
                                style={{
                                  color:
                                    COMPARISON_COLORS[
                                      side === "a" ? "aOnly" : "bOnly"
                                    ],
                                }}
                              >
                                Population {side.toUpperCase()} ·{" "}
                                {comparison[side].ids.length} criteria
                              </summary>
                              <Choice<PopulationMode>
                                label={`Combine ${side.toUpperCase()} criteria`}
                                value={comparison[side].mode}
                                onChange={(value) =>
                                  updateComparison(side, {
                                    ...comparison[side],
                                    mode: value,
                                  })
                                }
                                options={[
                                  { value: "any", label: "Any (OR)" },
                                  { value: "all", label: "All (AND)" },
                                ]}
                              />
                              {POPULATION_OPTIONS.map((option) => (
                                <label
                                  key={option.id}
                                  className="lv-spatial-grid-toggle"
                                  title={option.title}
                                >
                                  <input
                                    type="checkbox"
                                    checked={comparison[side].ids.includes(
                                      option.id,
                                    )}
                                    onChange={(event) =>
                                      toggleComparison(
                                        side,
                                        option.id,
                                        event.target.checked,
                                      )
                                    }
                                  />{" "}
                                  {option.label}
                                </label>
                              ))}
                            </details>
                          ))}
                          {!comparisonResult ? (
                            <p className="lv-spatial-help">
                              Choose at least one criterion for each population.
                            </p>
                          ) : null}
                          <p className="lv-spatial-help">
                            Colours only · current filtered positions. Unknown:
                            insufficient data to determine the exclusive class.
                          </p>
                        </>
                      ) : null}
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        </aside>
        <section className="lv-spatial-main" aria-label="Spatial view">
          <div className={`lv-spatial-stage lv-spatial-stage--${theme}`}>
            <div ref={host} className="lv-spatial-canvas" />
            <div
              ref={overlay}
              className="lv-spatial-labels"
              aria-hidden="true"
            />
            <div ref={scale} className="lv-spatial-scale" aria-hidden="true" />
            <div className="lv-spatial-frame-overlay">
              <Choice<ObserverFrame>
                label="Coordinate frame"
                value={frame}
                onChange={setFrame}
                options={FRAMES}
              />
            </div>
            {displayMode === "groups" &&
            !layers.groups &&
            !layers.field &&
            !error ? (
              <div className="lv-spatial-message" role="status">
                Both object layers are hidden.
              </div>
            ) : null}
            {error ? (
              <div className="lv-spatial-message" role="alert">
                WebGL unavailable. The catalogue inspector and Sky remain
                available.{" "}
                <button type="button" onClick={() => setRetry((n) => n + 1)}>
                  Retry
                </button>
              </div>
            ) : displayMode === "groups" && groupError ? (
              <div className="lv-spatial-message" role="alert">
                Physical group catalogue unavailable.{" "}
                <button
                  type="button"
                  onClick={() => {
                    setGroupCatalogue(null);
                    setGroupError(false);
                    setGroupRetry((n) => n + 1);
                  }}
                >
                  Retry groups
                </button>{" "}
                <button type="button" onClick={() => changeDisplay("galaxies")}>
                  Show galaxies
                </button>
              </div>
            ) : displayMode === "groups" && groupCatalogue === null ? (
              <div className="lv-spatial-message" role="status">
                Loading physical groups…
              </div>
            ) : displayMode === "groups" &&
              groups.length === 0 &&
              renderPoints.length === 0 ? (
              <div className="lv-spatial-message" role="status">
                No eligible physical groups or field galaxies in this view.
                Change selection, distance or volume mode.
              </div>
            ) : displayMode === "galaxies" &&
              (selectionActive || populationActive) &&
              renderPoints.length === 0 ? (
              <div className="lv-spatial-message" role="status">
                No galaxy positions match the active region and populations.
                Adjust or clear the filters.
              </div>
            ) : displayMode === "galaxies" && points.length === 0 ? (
              <div className="lv-spatial-message" role="status">
                No positions in this distance mode. Try another mode or inspect
                the catalogue list.
              </div>
            ) : null}
          </div>
        </section>
        <aside
          className="lv-spatial-inspector"
          aria-label="Catalogue inspector"
        >
          <div className="lv-spatial-sidebar-scroll">
            <section className="lv-spatial-panel" aria-label="Object search">
              <h3>Find an object</h3>
              {displayMode === "groups" ? (
                <Choice<AtlasDisplayMode>
                  label="Search category"
                  value={searchKind}
                  onChange={changeSearchKind}
                  options={[
                    {
                      value: "groups",
                      label: `Groups (${visibleGroups.length})`,
                    },
                    {
                      value: "galaxies",
                      label: `Field (${visiblePoints.length})`,
                    },
                  ]}
                />
              ) : null}
              <label className="lv-spatial-picker lv-spatial-search">
                <span className="lv-spatial-sr-only">
                  Search by name or PGC
                </span>
                <input
                  type="search"
                  value={query}
                  onFocus={() => setBrowseOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResultLimit(40);
                    setBrowseOpen(true);
                  }}
                  placeholder={
                    browsingGroups ? "Group name or PGC" : "Galaxy name or PGC"
                  }
                />
              </label>
              <div className="lv-spatial-result-header">
                <span aria-live="polite">
                  {query || browseOpen
                    ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                    : "Catalogue search"}
                </span>
                <button
                  type="button"
                  aria-expanded={browseOpen}
                  aria-controls="lv-spatial-results"
                  onClick={() => setBrowseOpen((value) => !value)}
                >
                  {browseOpen ? "Hide list" : "Browse"}
                </button>
              </div>
              <div id="lv-spatial-results" hidden={!browseOpen}>
                <div className="lv-spatial-results" aria-label="Search results">
                  {results.slice(0, resultLimit).map((result) => (
                    <button
                      type="button"
                      key={`${result.kind}-${result.pgc}`}
                      aria-pressed={
                        result.kind === "group"
                          ? currentGroup?.pgc === result.pgc
                          : currentGalaxy?.object.pgc === result.pgc
                      }
                      onClick={() =>
                        result.kind === "group"
                          ? chooseGroup(result.pgc)
                          : chooseGalaxy(result.pgc)
                      }
                    >
                      <span>{result.name}</span>
                      <small>{result.detail}</small>
                    </button>
                  ))}
                  {results.length > resultLimit ? (
                    <button
                      type="button"
                      className="lv-spatial-more"
                      onClick={() => setResultLimit((value) => value + 40)}
                    >
                      Show more ({results.length - resultLimit})
                    </button>
                  ) : null}
                  {results.length === 0 ? (
                    <p className="lv-spatial-help">
                      {displayMode === "groups" && groupCatalogue === null
                        ? "Group catalogue not loaded."
                        : "No matching objects."}
                    </p>
                  ) : null}
                </div>
              </div>
              {choices.length > 1 ? (
                <div className="lv-spatial-overlaps" role="status">
                  <h3>Choose overlapping object</h3>
                  {choices.map((pgc) => {
                    const group =
                      displayMode === "groups"
                        ? groups.find((entry) => entry.pgc === pgc)
                        : undefined;
                    return (
                      <button
                        type="button"
                        key={pgc}
                        onClick={() =>
                          group ? chooseGroup(pgc) : chooseGalaxy(pgc)
                        }
                      >
                        {group ? `${group.name} Group` : names.get(pgc)} · PGC{" "}
                        {pgc}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {currentGroup ? (
                <section
                  className="lv-spatial-object-card"
                  aria-label="Selected physical group"
                >
                  <div className="lv-spatial-card-head">
                    <div>
                      <small>Physical group · PGC {currentGroup.pgc}</small>
                      <h3>{currentGroup.name} Group</h3>
                    </div>
                    <button
                      type="button"
                      aria-label="Clear selection"
                      title="Clear selection"
                      onClick={clearSelection}
                    >
                      ×
                    </button>
                  </div>
                  <dl className="lv-spatial-data">
                    <dt>Members</dt>
                    <dd>{currentGroup.memberCount}</dd>
                    <dt>Root distance [Mpc]</dt>
                    <dd>{display(currentGroup.distanceMpc)}</dd>
                    <dt>Projected extent [kpc]</dt>
                    <dd>{display(currentGroup.radiusMpc * 1000)}</dd>
                  </dl>
                  <ActiveColorValue encoding={color} pgc={currentGroup.pgc} />
                  <div className="lv-spatial-card-actions">
                    <button
                      type="button"
                      disabled={!canFocus}
                      onClick={focusSelection}
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void navigate(
                          `/groups/${currentGroup.pgc}?definition=physical`,
                        )
                      }
                    >
                      Open group ↗
                    </button>
                    <button
                      type="button"
                      onClick={() => showOnSky(currentGroup.pgc)}
                    >
                      Show on sky
                    </button>
                  </div>
                  <details className="lv-spatial-details">
                    <summary>Coordinates &amp; distance quality</summary>
                    <dl className="lv-spatial-data">
                      {selectedInterval ? (
                        <>
                          <dt>Distance interval [Mpc]</dt>
                          <dd>
                            −{display(selectedInterval.minusMpc)} / +
                            {display(selectedInterval.plusMpc)}
                          </dd>
                          <dt>Interval review</dt>
                          <dd>
                            {selectedInterval.quality === "verified"
                              ? "Verified"
                              : "Catalogue, unreviewed"}
                          </dd>
                        </>
                      ) : (
                        <>
                          <dt>Distance interval</dt>
                          <dd>Unavailable</dd>
                        </>
                      )}
                      <dt>Root distance class</dt>
                      <dd>{KIND_LABELS[currentGroup.kind]}</dd>
                      <dt>Verified root position</dt>
                      <dd>{currentGroup.verified ? "Yes" : "No"}</dd>
                      {axisNames.map((axis, i) => (
                        <Fragment key={axis}>
                          <dt>{axis} [Mpc]</dt>
                          <dd>{display(currentGroup.position[i])}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </details>
                </section>
              ) : null}
              {currentGalaxy ? (
                <section
                  className="lv-spatial-object-card"
                  aria-label="Selected galaxy"
                >
                  <div className="lv-spatial-card-head">
                    <div>
                      <small>Galaxy · PGC {currentGalaxy.object.pgc}</small>
                      <h3>{currentGalaxy.object.name}</h3>
                    </div>
                    <button
                      type="button"
                      aria-label="Clear selection"
                      title="Clear selection"
                      onClick={clearSelection}
                    >
                      ×
                    </button>
                  </div>
                  <dl className="lv-spatial-data">
                    <dt>Distance [Mpc]</dt>
                    <dd>{display(currentGalaxy.evidence?.dist_mpc)}</dd>
                    <dt>Method</dt>
                    <dd>
                      {currentGalaxy.evidence?.distance_method_for_value ?? "—"}
                    </dd>
                    <dt>Display</dt>
                    <dd>
                      {shown.has(currentGalaxy.object.pgc)
                        ? "Shown"
                        : currentGalaxy.position
                          ? depthIds.has(currentGalaxy.object.pgc)
                            ? selectionActive &&
                              points.some(
                                (point) =>
                                  point.object.pgc === currentGalaxy.object.pgc,
                              )
                              ? "Outside selection or non-individual distance"
                              : "Outside volume view"
                            : "Hidden by distance quality"
                          : currentGalaxy.reason}
                    </dd>
                  </dl>
                  {comparisonResult ? (
                    <div className="lv-spatial-active-color">
                      {
                        COMPARISON_LABELS[
                          comparisonResult.classes.get(
                            currentGalaxy.object.pgc,
                          ) ?? "unknown"
                        ]
                      }
                    </div>
                  ) : (
                    <ActiveColorValue
                      encoding={color}
                      pgc={currentGalaxy.object.pgc}
                    />
                  )}
                  <div className="lv-spatial-card-actions">
                    <button
                      type="button"
                      disabled={!canFocus}
                      onClick={focusSelection}
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      onClick={() => openObject(currentGalaxy.object.pgc)}
                    >
                      Open galaxy ↗
                    </button>
                    <button
                      type="button"
                      disabled={
                        currentGalaxy.object.ra === null ||
                        currentGalaxy.object.dec === null
                      }
                      onClick={() => showOnSky(currentGalaxy.object.pgc)}
                    >
                      Show on sky
                    </button>
                  </div>
                  <details className="lv-spatial-details">
                    <summary>Coordinates &amp; provenance</summary>
                    <dl className="lv-spatial-data">
                      {selectedInterval ? (
                        <>
                          <dt>Distance interval [Mpc]</dt>
                          <dd>
                            −{display(selectedInterval.minusMpc)} / +
                            {display(selectedInterval.plusMpc)}
                          </dd>
                          <dt>Interval review</dt>
                          <dd>
                            {selectedInterval.quality === "verified"
                              ? "Verified"
                              : "Catalogue, unreviewed"}
                          </dd>
                        </>
                      ) : (
                        <>
                          <dt>Distance interval</dt>
                          <dd>Unavailable</dd>
                        </>
                      )}
                      <dt>Distance class</dt>
                      <dd>
                        {currentGalaxy.kind
                          ? KIND_LABELS[currentGalaxy.kind]
                          : "Unavailable"}
                      </dd>
                      <dt>Reference</dt>
                      <dd>
                        {currentGalaxy.evidence?.distance_reference_for_value ??
                          "—"}
                      </dd>
                      <dt>Value review</dt>
                      <dd>
                        {currentGalaxy.evidence?.distance_value_review_status ??
                          "—"}
                      </dd>
                      <dt>Strict geometry</dt>
                      <dd>
                        {currentGalaxy.verified ? "Eligible" : "Not eligible"}
                      </dd>
                      {currentGalaxy.position
                        ? axisNames.map((axis, i) => (
                            <Fragment key={axis}>
                              <dt>{axis} [Mpc]</dt>
                              <dd>{display(currentGalaxy.position?.[i])}</dd>
                            </Fragment>
                          ))
                        : null}
                    </dl>
                  </details>
                </section>
              ) : currentGroup ? null : (
                <p className="lv-spatial-help">
                  Select an object in the scene or search results.
                </p>
              )}
            </section>
            <section
              className="lv-spatial-panel"
              aria-label="Catalogue coverage"
            >
              <h3>In this view</h3>
              <div className="lv-spatial-counts">
                {displayMode === "groups" ? (
                  <>
                    <div>
                      <strong>
                        {groupCatalogue === null ? "—" : visibleGroups.length}
                      </strong>
                      <span>Groups</span>
                    </div>
                    <div>
                      <strong>
                        {groupCatalogue === null ? "—" : visiblePoints.length}
                      </strong>
                      <span>Field galaxies</span>
                    </div>
                  </>
                ) : (
                  <div>
                    <strong>{renderPoints.length}</strong>
                    <span>Galaxies</span>
                  </div>
                )}
              </div>
              <details className="lv-spatial-details">
                <summary>Catalogue coverage</summary>
                <dl className="lv-spatial-data">
                  <dt>Catalogue entries</dt>
                  <dd>{rows.length}</dd>
                  <dt>Valid adopted positions</dt>
                  <dd>{available}</dd>
                  <dt>
                    {displayMode === "groups"
                      ? "Eligible galaxy positions"
                      : "Shown"}
                  </dt>
                  <dd>
                    {displayMode === "groups"
                      ? points.length
                      : renderPoints.length}
                  </dd>
                  {selectionActive ? (
                    <>
                      <dt>Outside selection or non-individual</dt>
                      <dd>{points.length - slicedPoints.length}</dd>
                    </>
                  ) : null}
                  {populationActive ? (
                    <>
                      <dt>Outside populations</dt>
                      <dd>{slicedPoints.length - filteredPoints.length}</dd>
                    </>
                  ) : null}
                  <dt>Without position</dt>
                  <dd>{rows.length - available}</dd>
                  <dt>Hidden by distance quality</dt>
                  <dd>{available - depthPoints.length}</dd>
                  <dt>Outside volume view</dt>
                  <dd>{depthPoints.length - points.length}</dd>
                  {displayMode === "groups" ? (
                    <>
                      <dt>Physical groups in catalogue</dt>
                      <dd>
                        {groupCatalogue === null
                          ? "—"
                          : groupCatalogue.groups.length}
                      </dd>
                      <dt>Group member positions</dt>
                      <dd>
                        {groupCatalogue === null ? "—" : partition.grouped}
                      </dd>
                      <dt>Membership unavailable</dt>
                      <dd>
                        {groupCatalogue === null ? "—" : partition.unavailable}
                      </dd>
                      <dt>Groups not shown</dt>
                      <dd>
                        {groupCatalogue === null
                          ? "—"
                          : groupCatalogue.groups.length - groups.length}
                      </dd>
                    </>
                  ) : null}
                  <dt>Verified positions</dt>
                  <dd>{verified}</dd>
                </dl>
              </details>
            </section>
            <section className="lv-spatial-panel" aria-label="Legend">
              <h3>Legend</h3>
              {!comparisonResult &&
              isPhotometryColor(colorMode) &&
              photometry === null ? (
                <p className="lv-spatial-help" role="status">
                  {photometryError ? (
                    <>
                      Physical parameters unavailable.{" "}
                      <button
                        type="button"
                        onClick={() => setPhotometryRetry((n) => n + 1)}
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    "Loading physical parameters…"
                  )}
                </p>
              ) : null}
              {!comparisonResult &&
              isPhotometryColor(colorMode) &&
              photometryMismatch ? (
                <p className="lv-spatial-help" role="status">
                  Unmatched physical revisions are excluded. Refresh Atlas for
                  current data.
                </p>
              ) : null}
              {comparisonResult ? (
                <dl className="lv-spatial-data" aria-live="polite">
                  {COMPARISON_CLASSES.map((kind) => (
                    <Fragment key={kind}>
                      <dt>
                        <i
                          className="lv-spatial-color-swatch"
                          style={{ background: COMPARISON_COLORS[kind] }}
                        />{" "}
                        {COMPARISON_LABELS[kind]}
                      </dt>
                      <dd>{comparisonResult.counts[kind]}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : null}
              {!comparisonResult && colorMode === "morphology" ? (
                <div className="lv-spatial-legend">
                  <span style={{ color: "#c96d76" }}>● T ≤ −3</span>
                  <span style={{ color: "#d99ea4" }}>● −3 &lt; T &lt; 0</span>
                  <span style={{ color: "#a995a6" }}>● T = 0</span>
                  <span style={{ color: "#91a8c6" }}>● 0 &lt; T ≤ 3</span>
                  <span style={{ color: "#6489bc" }}>● 3 &lt; T ≤ 7</span>
                  <span style={{ color: "#3f6fab" }}>● T &gt; 7</span>
                  <span style={{ color: "#9aa2ac" }}>● Missing T</span>
                </div>
              ) : null}
              {!comparisonResult &&
              colorMode !== "morphology" &&
              colorMode !== "neutral" ? (
                <ColorLegend
                  encoding={color}
                  pgcs={visiblePoints
                    .map((point) => point.object.pgc)
                    .concat(
                      displayMode === "groups"
                        ? visibleGroups.map((group) => group.pgc)
                        : [],
                    )}
                  groupMode={displayMode === "groups"}
                />
              ) : null}
              {intervalMode !== "off" ? (
                <div className="lv-spatial-marker-key">
                  <span>
                    Distance intervals ·{" "}
                    {intervalMode === "selected"
                      ? selectedInterval
                        ? 1
                        : 0
                      : intervals.length}{" "}
                    shown
                  </span>
                  <div className="lv-spatial-legend">
                    <span style={{ color: "#46bfac" }}>━ Verified</span>
                    <span style={{ color: "#ba9b65" }}>
                      ━ Catalogue, unreviewed
                    </span>
                  </div>
                  {displayMode === "groups" ? (
                    <span>Groups: root distance only</span>
                  ) : null}
                  {intervalMode === "selected" && !selectedInterval ? (
                    <span>
                      {selectedPgc === null
                        ? "Select an object"
                        : "No eligible interval"}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="lv-spatial-legend">
                {displayMode === "groups" ? (
                  <>
                    {layers.groups ? (
                      <span>
                        <i className="lv-spatial-key-sphere" /> Physical group
                        (projected extent)
                      </span>
                    ) : null}
                    {layers.field ? <span>○ Field galaxy</span> : null}
                  </>
                ) : (
                  <span>○ Individual galaxy</span>
                )}
                {mode === "catalogue" ? (
                  <span>◇ Assigned · △ Model · □ Unknown</span>
                ) : null}
                <span>⊙ Observer</span>
              </div>
              <details className="lv-spatial-details">
                <summary>Symbols &amp; reference guides</summary>
                {guides.plane || guides.shells.length > 0 ? (
                  <div className="lv-spatial-legend">
                    {guides.plane ? (
                      <span>▱ SGZ = 0 · reference plane</span>
                    ) : null}
                    {guides.shells.length > 0 ? (
                      <span>
                        ◎ Observer-centred shells · {guides.shells.join(", ")}{" "}
                        Mpc
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {displayMode === "galaxies" && layers.md ? (
                  <div className="lv-spatial-legend">
                    <span style={{ color: "#7297aa" }}>
                      ━ Catalogue MD links · {mdEdges.length}
                    </span>
                    <span>Individual distance endpoints only</span>
                  </div>
                ) : null}
                <div className="lv-spatial-marker-key">
                  {sizeMode === "fixed" ? (
                    <span>
                      Galaxy symbols ·{" "}
                      {atlasMarkerDiameter(sizeMode, markerDensity, null)} px
                    </span>
                  ) : (
                    <>
                      <span>
                        Galaxy symbol size · M<sub>B</sub> [mag]
                      </span>
                      <div className="lv-spatial-marker-examples">
                        {[-10, -16, -22].map((magnitude) => (
                          <span key={magnitude}>
                            <i
                              style={{
                                width: atlasMarkerDiameter(
                                  sizeMode,
                                  markerDensity,
                                  magnitude,
                                ),
                                height: atlasMarkerDiameter(
                                  sizeMode,
                                  markerDensity,
                                  magnitude,
                                ),
                              }}
                            />
                            {magnitude === -10
                              ? "≥ −10"
                              : magnitude === -22
                                ? "≤ −22"
                                : "−16"}
                          </span>
                        ))}
                      </div>
                      <span>
                        Missing M<sub>B</sub>: base size (
                        {
                          visiblePoints.filter(
                            (point) =>
                              typeof point.object.abs_b_mag !== "number" ||
                              !Number.isFinite(point.object.abs_b_mag),
                          ).length
                        }
                        )
                      </span>
                    </>
                  )}
                </div>
              </details>
              <details className="lv-spatial-details">
                <summary>Navigation</summary>
                <p className="lv-spatial-help">
                  Drag to orbit · right drag to pan · scroll / pinch to zoom.
                  WASD or arrows to pan when the scene has focus; Shift to move
                  faster. Click to select, click empty space to clear. Enter or
                  double-click to focus.
                </p>
              </details>
            </section>
          </div>
        </aside>
      </div>
    </dialog>
  );
}
