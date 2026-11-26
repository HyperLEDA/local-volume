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
  DEFAULT_FOF,
  friendsOfFriends,
  validLinkingLength,
  type FofConfig,
  type ConnectivityMethod,
} from "../lib/spatialFof.ts";
import { minimumSpanningTree, mstForest } from "../lib/spatialMst.ts";
import {
  DEFAULT_AVOIDANCE,
  type AvoidanceConfig,
} from "../lib/spatialAvoidance.ts";
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
import AtlasEnvironment from "./AtlasEnvironment.tsx";
import {
  nominalEnvironment,
  radialPeculiarVelocity,
} from "../lib/spatialEnvironment.ts";
import {
  DEFAULT_DENSITY_CONFIG,
  decodeDensityConfig,
  spatialDensity,
  type DensityMethod,
} from "../lib/spatialDensity.ts";
import {
  DEFAULT_PECULIAR_CONFIG,
  decodePeculiarConfig,
  peculiarValues,
  radialArrows,
  type RadialVectorScope,
} from "../lib/spatialPeculiarVelocity.ts";
import {
  matchedRedshiftPositions,
  type SpaceMode,
} from "../lib/spatialRedshift.ts";
import { environmentOverlay } from "../lib/spatialEnvironmentOverlay.ts";
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
function ResetButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="lv-spatial-reset-icon"
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
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
  );
}
function SectionHeading({
  label,
  onReset,
  title,
}: {
  label: string;
  onReset: () => void;
  title?: string;
}) {
  return (
    <div className="lv-spatial-panel-heading">
      <h3>{label}</h3>
      <ResetButton label={`Reset ${label}`} title={title} onClick={onReset} />
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
    : `${name} (PGC ${pgc})`;
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
        Atlas selection scale{groupMode ? " (group colour = root value)" : ""}
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
        {encoding.estimated.has(pgc) ? " (estimated Ks)" : ""}
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
  const [environmentOn, setEnvironmentOn] = useState(false);
  const [environmentRadius, setEnvironmentRadius] = useState("1");
  const [environmentHubble, setEnvironmentHubble] = useState(
    String(restored.peculiar?.hubble ?? DEFAULT_PECULIAR_CONFIG.hubble),
  );
  const [velocityScope, setVelocityScope] = useState<RadialVectorScope>(
    restored.peculiar?.scope ?? "off",
  );
  const [velocityScale, setVelocityScale] = useState(
    String(restored.peculiar?.mpcPer100 ?? DEFAULT_PECULIAR_CONFIG.mpcPer100),
  );
  const [velocityThreshold, setVelocityThreshold] = useState(
    String(
      restored.peculiar?.thresholdKms ?? DEFAULT_PECULIAR_CONFIG.thresholdKms,
    ),
  );
  const velocityConfig = useMemo(
    () =>
      decodePeculiarConfig({
        hubble: Number(environmentHubble),
        scope: velocityScope,
        mpcPer100: Number(velocityScale),
        thresholdKms: velocityThreshold.trim()
          ? Number(velocityThreshold)
          : NaN,
      }),
    [environmentHubble, velocityScope, velocityScale, velocityThreshold],
  );
  const [controlPage, setControlPage] = useState<ControlPage>("view");
  const controlScroll = useRef<HTMLDivElement>(null);
  const [appearancePage, setAppearancePage] = useState<"style" | "layers">(
    "style",
  );
  const [selectionPage, setSelectionPage] = useState<"region" | "populations">(
    "region",
  );
  const [comparisonSide, setComparisonSide] = useState<"a" | "b">("a");
  const [spaceMode, setSpaceMode] = useState<SpaceMode>(
    restored.spaceMode ?? "real",
  );
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
  const [densityMethod, setDensityMethod] = useState<DensityMethod>(
    restored.density?.method ?? DEFAULT_DENSITY_CONFIG.method,
  );
  const [densityRadius, setDensityRadius] = useState(
    String(restored.density?.radiusMpc ?? DEFAULT_DENSITY_CONFIG.radiusMpc),
  );
  const [densityK, setDensityK] = useState(
    String(restored.density?.k ?? DEFAULT_DENSITY_CONFIG.k),
  );
  const [densityBoundary, setDensityBoundary] = useState(
    restored.density?.includeBoundary ?? false,
  );
  const densityConfig = useMemo(
    () =>
      decodeDensityConfig({
        method: densityMethod,
        radiusMpc: Number(densityRadius),
        k: Number(densityK),
        includeBoundary: densityBoundary,
      }),
    [densityMethod, densityRadius, densityK, densityBoundary],
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
  const [fof, setFof] = useState<FofConfig>(restored.fof ?? DEFAULT_FOF);
  const [connectivityDraft, setConnectivityDraft] =
    useState<ConnectivityMethod>(restored.fof?.method ?? "fof");
  const [fofDraft, setFofDraft] = useState(
    String(restored.fof?.linkingMpc ?? DEFAULT_FOF.linkingMpc),
  );
  const [avoidance, setAvoidance] = useState<AvoidanceConfig>(
    restored.avoidance ?? DEFAULT_AVOIDANCE,
  );
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
  const depthPoints = useMemo(
    () => atlasVisiblePoints(rows, mode),
    [rows, mode],
  );
  const points = useMemo(
    () => atlasScopePoints(depthPoints, localOnly),
    [depthPoints, localOnly],
  );
  const environmentEligible = useMemo(
    () =>
      points.filter(
        (point) =>
          point.kind === "individual" &&
          point.evidence?.distance_lineage_status === "REVIEW_READY" &&
          (point.evidence.distance_value_review_status === "NOT_REVIEWED" ||
            point.evidence.distance_value_review_status === "VERIFIED"),
      ),
    [points],
  );
  const environmentInput = useMemo(
    () =>
      environmentEligible.map((point) => ({
        pgc: point.object.pgc,
        position: point.position,
        verified: point.verified,
      })),
    [environmentEligible],
  );
  const densityResult = useMemo(
    () =>
      colorMode === "density" && densityConfig
        ? spatialDensity(environmentInput, densityConfig, localOnly ? 11 : null)
        : null,
    [colorMode, densityConfig, environmentInput, localOnly],
  );
  const hubbleValue = Number(environmentHubble);
  const velocityValues = useMemo(
    () =>
      peculiarValues(
        environmentEligible.map((point) => ({
          pgc: point.object.pgc,
          position: point.position,
          verified: point.verified,
          distanceMpc: point.evidence?.dist_mpc,
          velocityLgKms: point.object.lvg_v_lg_kms,
        })),
        hubbleValue,
      ),
    [environmentEligible, hubbleValue],
  );
  const paired = displayMode === "galaxies" && spaceMode !== "real";
  const redshift = paired && spaceMode === "redshift";
  const redshiftPositions = useMemo(
    () =>
      paired
        ? matchedRedshiftPositions(
            environmentEligible.map((point) => ({
              pgc: point.object.pgc,
              position: point.position,
              velocityLgKms: point.object.lvg_v_lg_kms,
            })),
            hubbleValue,
          )
        : null,
    [paired, environmentEligible, hubbleValue],
  );
  const baseColor = useMemo(
    () =>
      buildAtlasColorEncoding(
        rows,
        colorMode,
        photometry,
        densityResult?.values,
        velocityValues,
      ),
    [rows, colorMode, photometry, densityResult, velocityValues],
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
  const matchedPoints = useMemo(
    () =>
      redshiftPositions
        ? filteredPoints.filter((point) =>
            redshiftPositions.has(point.object.pgc),
          )
        : filteredPoints,
    [filteredPoints, redshiftPositions],
  );
  const matchedBase = useMemo(
    () =>
      redshiftPositions
        ? points.filter((point) => redshiftPositions.has(point.object.pgc))
        : points,
    [points, redshiftPositions],
  );
  const redshiftBase = useMemo(
    () =>
      redshiftPositions
        ? matchedBase.flatMap((point) => {
            const position = redshiftPositions.get(point.object.pgc);
            return position ? [{ ...point, position }] : [];
          })
        : matchedBase,
    [matchedBase, redshiftPositions],
  );
  const redshiftPoints = useMemo(
    () =>
      redshiftPositions
        ? matchedPoints.flatMap((point) => {
            const position = redshiftPositions.get(point.object.pgc);
            return position ? [{ ...point, position }] : [];
          })
        : matchedPoints,
    [matchedPoints, redshiftPositions],
  );
  const activeComparison = displayMode === "galaxies" ? comparison : null;
  const comparisonResult = useMemo(
    () =>
      activeComparison &&
      activeComparison.a.ids.length &&
      activeComparison.b.ids.length
        ? comparePopulations(matchedPoints, membership, activeComparison)
        : null,
    [matchedPoints, membership, activeComparison],
  );
  const color = useMemo(
    () =>
      comparisonResult
        ? { ...baseColor, comparisonColors: comparisonResult.colors }
        : baseColor,
    [baseColor, comparisonResult],
  );
  const renderPoints =
    displayMode === "groups"
      ? partition.field
      : redshift
        ? redshiftPoints
        : matchedPoints;
  const baseRenderPoints = useMemo(
    () =>
      displayMode === "groups"
        ? partition.field
        : paired
          ? [...matchedBase, ...redshiftBase]
          : points,
    [displayMode, partition, paired, matchedBase, redshiftBase, points],
  );
  const referenceExtent = useMemo(
    () =>
      (paired ? baseRenderPoints : points).reduce(
        (extent, point) => Math.max(extent, Math.hypot(...point.position)),
        0,
      ),
    [paired, baseRenderPoints, points],
  );
  const mdEdges = useMemo(
    () =>
      displayMode === "galaxies" && !paired ? atlasMdEdges(filteredPoints) : [],
    [displayMode, filteredPoints, paired],
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
    () => new Set(matchedPoints.map((p) => p.object.pgc)),
    [matchedPoints],
  );
  const shownGroups = useMemo(
    () => new Set(groups.map((g) => g.pgc)),
    [groups],
  );
  const currentGroup =
    displayMode === "groups"
      ? (visibleGroups.find((group) => group.pgc === selectedGroup) ?? null)
      : null;
  const realSelectedIds = useMemo(
    () => new Set(filteredPoints.map((point) => point.object.pgc)),
    [filteredPoints],
  );
  const currentGalaxy = rows.find(
    (row) =>
      row.object.pgc === selectedGalaxy &&
      ((displayMode === "galaxies" &&
        ((!selectionActive && !populationActive) ||
          realSelectedIds.has(row.object.pgc))) ||
        (displayMode === "groups" &&
          layers.field &&
          currentGroup === null &&
          fieldIds.has(row.object.pgc))),
  );
  const selectedProxyPosition = currentGalaxy
    ? redshiftPositions?.get(currentGalaxy.object.pgc)
    : undefined;
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
    () => (paired ? [] : atlasDisplayedIntervals(points, sceneShown)),
    [points, sceneShown, paired],
  );
  const intervals = allIntervals.filter((entry) => activeShown.has(entry.pgc));
  const choices = hits.filter((id) => activeShown.has(id));
  const searchableRows = useMemo(
    () =>
      rows.filter((r) =>
        displayMode === "galaxies"
          ? (!selectionActive && !populationActive) ||
            realSelectedIds.has(r.object.pgc)
          : layers.field && fieldIds.has(r.object.pgc),
      ),
    [
      rows,
      displayMode,
      fieldIds,
      layers.field,
      selectionActive,
      populationActive,
      realSelectedIds,
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
  const environmentTarget = environmentEligible.find(
    (point) => point.object.pgc === selectedPgc,
  );
  const radiusMpc = Number(environmentRadius);
  const environmentResult = useMemo(
    () =>
      selectedPgc !== null && radiusMpc >= 0.01 && radiusMpc <= 100
        ? nominalEnvironment(
            environmentInput,
            selectedPgc,
            radiusMpc,
            localOnly ? 11 : null,
          )
        : null,
    [environmentInput, selectedPgc, radiusMpc, localOnly],
  );
  const environmentVisible = useMemo(() => {
    const ids = new Set(renderPoints.map((point) => point.object.pgc));
    return environmentInput.filter((point) => ids.has(point.pgc));
  }, [renderPoints, environmentInput]);
  const fofAvailable = displayMode === "galaxies" && !paired;
  const mstActive = fof.enabled && fofAvailable && fof.method !== undefined;
  const tree = useMemo(
    () => (mstActive ? minimumSpanningTree(environmentVisible) : null),
    [mstActive, environmentVisible],
  );
  const fofResult = useMemo(() => {
    if (!fof.enabled || !fofAvailable) return null;
    if (fof.method === undefined)
      return friendsOfFriends(environmentVisible, fof.linkingMpc);
    return tree
      ? mstForest(tree, fof.method === "mst-cut" ? fof.linkingMpc : null)
      : null;
  }, [fof, fofAvailable, environmentVisible, tree]);
  const connectivityLabel =
    fof.method === "mst"
      ? "MST (full tree)"
      : fof.method === "mst-cut"
        ? `Cut MST (${fof.linkingMpc} Mpc)`
        : `FoF (${fof.linkingMpc} Mpc)`;
  const environmentGeometry = useMemo(
    () =>
      !paired &&
      environmentOn &&
      displayMode === "galaxies" &&
      selectedPgc !== null
        ? environmentOverlay(
            environmentVisible,
            selectedPgc,
            radiusMpc,
            environmentResult,
          )
        : null,
    [
      paired,
      environmentOn,
      displayMode,
      selectedPgc,
      environmentVisible,
      radiusMpc,
      environmentResult,
    ],
  );
  const velocityArrows = useMemo(
    () =>
      displayMode === "galaxies" && !paired
        ? radialArrows(
            environmentVisible,
            velocityValues,
            velocityConfig,
            selectedPgc,
          )
        : [],
    [
      displayMode,
      paired,
      environmentVisible,
      velocityValues,
      velocityConfig,
      selectedPgc,
    ],
  );
  const environmentVelocity =
    environmentTarget && hubbleValue >= 1 && hubbleValue <= 200
      ? radialPeculiarVelocity(
          environmentTarget.object.lvg_v_lg_kms,
          environmentTarget.evidence?.dist_mpc,
          hubbleValue,
        )
      : null;
  const selectedInterval = intervals.find((entry) => entry.pgc === selectedPgc);
  const renderGuides = useMemo(
    () => (paired ? { ...guides, shells: [] } : guides),
    [paired, guides],
  );
  const renderIntervalMode: AtlasIntervalMode = paired ? "off" : intervalMode;
  const latest = useRef({
    theme,
    color,
    grid,
    selectedPgc,
    sizeMode,
    markerDensity,
    intervalMode: renderIntervalMode,
    layers,
    guides: renderGuides,
    environmentGeometry,
    velocityArrows,
    avoidance,
    fofResult,
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
      fof,
      avoidance,
      spaceMode,
      peculiar: velocityConfig ?? DEFAULT_PECULIAR_CONFIG,
      density: densityConfig ?? DEFAULT_DENSITY_CONFIG,
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
    fof,
    avoidance,
    spaceMode,
    velocityConfig,
    densityConfig,
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
      intervalMode: renderIntervalMode,
      layers,
      guides: renderGuides,
      environmentGeometry,
      velocityArrows,
      avoidance,
      fofResult,
    };
    engine.current?.style(theme, color);
    engine.current?.select(selectedPgc);
    engine.current?.setGrid(grid);
    engine.current?.setGuides(renderGuides);
    engine.current?.setAvoidance(avoidance);
    engine.current?.setIntervalMode(renderIntervalMode);
    engine.current?.setLayers(layers);
    engine.current?.setMarkerSize(sizeMode, markerDensity);
    engine.current?.setEnvironment(environmentGeometry);
    engine.current?.setVelocityArrows(velocityArrows);
    engine.current?.setFofOverlay(fofResult);
  }, [
    theme,
    color,
    selectedPgc,
    grid,
    sizeMode,
    markerDensity,
    renderIntervalMode,
    layers,
    renderGuides,
    environmentGeometry,
    velocityArrows,
    avoidance,
    fofResult,
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
          slice: paired ? null : activeSlice,
          region: paired ? null : activeRegion,
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
      next.setEnvironment(latest.current.environmentGeometry);
      next.setVelocityArrows(latest.current.velocityArrows);
      next.setAvoidance(latest.current.avoidance);
      next.setFofOverlay(latest.current.fofResult);
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
    paired,
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
    if (value === "groups") {
      setSpaceMode("real");
      setEnvironmentOn(false);
      setVelocityScope("off");
      if (colorMode === "density" || colorMode === "peculiar")
        setColorMode("morphology");
    }
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
  function toggleEnvironment() {
    if (!environmentTarget) return;
    if (displayMode === "groups") {
      changeDisplay("galaxies");
      chooseGalaxy(environmentTarget.object.pgc);
      setSelectedGroup(null);
      setEnvironmentOn(true);
    } else setEnvironmentOn((value) => !value);
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
    if (paired || (!selectionActive && !populationActive) || !populationReady)
      return;
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
  function initialPreferences() {
    return decodeAtlasPreferences(
      null,
      new Set<number>(),
      document.documentElement.dataset.theme === "light" ? "light" : "dark",
    );
  }
  function resetDisplay() {
    const defaults = initialPreferences();
    setSpaceMode("real");
    setMode(defaults.mode);
    setLocalOnly(defaults.localOnly);
    setLayers(defaults.layers);
    // A group view cannot represent active individual-galaxy tools. Keep their state and mode.
    const requiresGalaxies =
      slice !== null ||
      region !== null ||
      population.ids.length > 0 ||
      comparison !== null ||
      fof.enabled ||
      environmentOn ||
      velocityScope !== "off" ||
      colorMode === "density" ||
      colorMode === "peculiar";
    if (!requiresGalaxies && displayMode !== defaults.displayMode)
      changeDisplay(defaults.displayMode);
    setHits([]);
  }
  function resetCamera() {
    const defaults = initialPreferences();
    resetGeneration.current += 1;
    clearAtlasCamera();
    setFrame(defaults.frame);
    setProjection(defaults.projection);
    setResetRevision(resetGeneration.current);
    setHits([]);
  }
  function resetStyle() {
    const defaults = initialPreferences();
    setColorMode(defaults.colorMode);
    setDensityMethod(DEFAULT_DENSITY_CONFIG.method);
    setDensityRadius(String(DEFAULT_DENSITY_CONFIG.radiusMpc));
    setDensityK(String(DEFAULT_DENSITY_CONFIG.k));
    setDensityBoundary(DEFAULT_DENSITY_CONFIG.includeBoundary);
  }
  function resetMarkers() {
    const defaults = initialPreferences();
    setTheme(defaults.theme);
    setSizeMode(defaults.sizeMode);
    setMarkerDensity(defaults.markerDensity);
  }
  function resetVectors() {
    setVelocityScope("off");
    setVelocityScale(String(DEFAULT_PECULIAR_CONFIG.mpcPer100));
    setVelocityThreshold(String(DEFAULT_PECULIAR_CONFIG.thresholdKms));
  }
  function resetGuides() {
    const defaults = initialPreferences();
    setGrid(defaults.grid);
    setGuides(defaults.guides);
    setAvoidance(DEFAULT_AVOIDANCE);
    setIntervalMode(defaults.intervalMode);
  }
  function resetAppearance() {
    resetStyle();
    resetMarkers();
    resetVectors();
    resetGuides();
    setAppearancePage("style");
  }
  function resetRegion() {
    clearSpatialSelection();
    setSelectionKind("slice");
    setSelectionFrame(frame);
    setRegionCentre(["0", "0", "0"]);
    setRegionRadius("2");
    setRegionSize(["4", "4", "4"]);
    setSliceAxis("2");
    setSliceCentre("0");
    setSliceThickness("2");
  }
  function resetPopulations() {
    setPopulation(defaultPopulation());
    setSampleError(false);
    setHits([]);
    setResultLimit(40);
  }
  function resetSelect() {
    resetRegion();
    resetPopulations();
    setSelectionPage("region");
  }
  function resetConnectivity() {
    setFof(DEFAULT_FOF);
    setConnectivityDraft("fof");
    setFofDraft(String(DEFAULT_FOF.linkingMpc));
  }
  function resetComparison() {
    setComparison(null);
    setComparisonSide("a");
  }
  function resetAnalysis() {
    resetConnectivity();
    resetComparison();
  }
  function resetView() {
    resetDisplay();
    resetCamera();
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
    setImageError(false);
    changeControlPage("view");
    setAppearancePage("style");
    setSelectionPage("region");
    setComparisonSide("a");
    setSpaceMode("real");
    setEnvironmentOn(false);
    setEnvironmentRadius("1");
    setEnvironmentHubble(String(DEFAULT_PECULIAR_CONFIG.hubble));
    setVelocityScope("off");
    setVelocityScale(String(DEFAULT_PECULIAR_CONFIG.mpcPer100));
    setVelocityThreshold(String(DEFAULT_PECULIAR_CONFIG.thresholdKms));
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
    setDensityMethod(DEFAULT_DENSITY_CONFIG.method);
    setDensityRadius(String(DEFAULT_DENSITY_CONFIG.radiusMpc));
    setDensityK(String(DEFAULT_DENSITY_CONFIG.k));
    setDensityBoundary(DEFAULT_DENSITY_CONFIG.includeBoundary);
    setSizeMode(defaults.sizeMode);
    setMarkerDensity(defaults.markerDensity);
    setLocalOnly(defaults.localOnly);
    setGrid(defaults.grid);
    setGuides(defaults.guides);
    setAvoidance(DEFAULT_AVOIDANCE);
    setFof(DEFAULT_FOF);
    setConnectivityDraft("fof");
    setFofDraft(String(DEFAULT_FOF.linkingMpc));
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
      const filename = paired
        ? `LV-LEDA-${redshift ? "redshift" : "real-matched"}-H0-${hubbleValue}`
        : "LV-LEDA-3D-Atlas";
      await downloadSpatialPng(
        current.exportImage([]),
        `${filename}${fofResult ? (fof.method === "mst" ? "-MST" : fof.method === "mst-cut" ? `-MST-cut-L${fof.linkingMpc}` : `-FoF-L${fof.linkingMpc}`) : ""}${avoidance.enabled ? `-ZoA-b${avoidance.latitudeDeg}` : ""}.png`,
      );
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
            <div className="lv-spatial-brand">
              <div className="lv-spatial-title-row">
                <h2 id="lv-spatial-title">Spatial Atlas</h2>
                <ResetButton
                  label="Reset 3D Atlas"
                  title="Restore the initial Atlas settings and camera; keep Sky Atlas filters"
                  onClick={resetAtlas}
                />
              </div>
              <p>Local Volume</p>
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
                  { value: "compare", label: "Analysis" },
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
                  (page.value === "compare" &&
                    (comparison !== null || fof.enabled)) ||
                  (page.value === "appearance" &&
                    (velocityScope !== "off" ||
                      intervalMode !== "off" ||
                      grid ||
                      guides.plane ||
                      guides.shells.length > 0 ||
                      avoidance.enabled ||
                      colorMode === "density" ||
                      colorMode === "peculiar")) ? (
                    <span
                      className="lv-spatial-active-dot"
                      aria-label="active"
                    />
                  ) : null}
                </button>
              ))}
            </nav>
            {selectionActive ||
            populationActive ||
            comparison !== null ||
            fof.enabled ? (
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
                    {selectionActive && populationActive ? "; " : ""}
                    {populationActive
                      ? `${population.ids.length} population criteria`
                      : ""}
                    ; {filteredPoints.length} galaxies
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
                {fof.enabled ? (
                  <button
                    type="button"
                    onClick={() => changeControlPage("compare")}
                    title="Edit spatial connectivity"
                  >
                    {connectivityLabel};{" "}
                    {fofAvailable
                      ? fofResult
                        ? "active"
                        : "unavailable"
                      : "paused"}
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
                <div className="lv-spatial-page-heading">
                  <SectionHeading label="View" onReset={resetView} />
                </div>
                <section
                  className="lv-spatial-panel"
                  aria-label="Scene settings"
                >
                  <SectionHeading label="Display" onReset={resetDisplay} />
                  <div className="lv-spatial-setting">
                    <span>Geometry</span>
                    <Choice<SpaceMode>
                      label="Spatial geometry"
                      value={spaceMode}
                      onChange={(value) => {
                        if (value !== "real" && displayMode === "groups")
                          changeDisplay("galaxies");
                        setSpaceMode(value);
                        setHits([]);
                      }}
                      options={[
                        { value: "real", label: "Real" },
                        { value: "matched", label: "Real matched" },
                        { value: "redshift", label: "Redshift" },
                      ]}
                    />
                  </div>
                  {paired ? (
                    <>
                      <label className="lv-spatial-environment-inputs">
                        H₀ [km/s/Mpc]
                        <input
                          type="number"
                          min="1"
                          max="200"
                          step="0.5"
                          value={environmentHubble}
                          onChange={(event) =>
                            setEnvironmentHubble(event.target.value)
                          }
                        />
                      </label>
                      <p className="lv-spatial-help">
                        {redshift
                          ? "Places the matched galaxies at VLG/H₀ along their observed sky directions. Compare with Real matched to see radial distortions caused by departures from the Hubble law."
                          : "Shows catalogue distances for exactly the galaxies used in Redshift, at the same scene scale. Use it as the reference for assessing velocity-induced distortions."}
                      </p>
                      <p className="lv-spatial-help">
                        Requires individual D and positive VLG. Colours and
                        filters use real-space values. Physical distance guides,
                        environment, connectivity and radial arrows are paused.
                      </p>
                      <details className="lv-spatial-details">
                        <summary>Coordinate convention</summary>
                        <p className="lv-spatial-help">
                          Catalogue LG-frame velocities with observer-centred
                          sky directions; no barycentric position correction.
                          VLG/H₀ is a proxy, not an independently measured
                          distance.
                        </p>
                      </details>
                    </>
                  ) : null}
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
                  <SectionHeading label="Camera" onReset={resetCamera} />
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
                  <details className="lv-spatial-details">
                    <summary>Navigation</summary>
                    <p className="lv-spatial-help">
                      Drag to orbit, right drag to pan, scroll or pinch to zoom.
                      WASD or arrows to pan when the scene has focus; Shift to
                      move faster. Click to select, click empty space to clear.
                      Enter or double-click to focus.
                    </p>
                  </details>
                </section>
              </div>
              <div
                id="lv-spatial-tool-appearance"
                className="lv-spatial-tool-page"
                hidden={controlPage !== "appearance"}
              >
                <section className="lv-spatial-panel" aria-label="Appearance">
                  <SectionHeading
                    label="Appearance"
                    onReset={resetAppearance}
                    title="Reset appearance and layers; keep shared H₀ and analysis"
                  />
                  <div className="lv-spatial-subnav">
                    <Choice<"style" | "layers">
                      label="Appearance tools"
                      value={appearancePage}
                      onChange={setAppearancePage}
                      options={[
                        { value: "style", label: "Style" },
                        { value: "layers", label: "Layers" },
                      ]}
                    />
                  </div>
                  {appearancePage === "style" ? (
                    <>
                      <div className="lv-spatial-setting lv-spatial-color-options">
                        <div className="lv-spatial-setting-heading">
                          <span>Colour by</span>
                          <ResetButton
                            label="Reset colour encoding"
                            onClick={resetStyle}
                          />
                        </div>
                        {comparisonResult ? (
                          <button
                            type="button"
                            onClick={() => changeControlPage("compare")}
                          >
                            Edit population comparison
                          </button>
                        ) : (
                          <Choice<AtlasColorMode>
                            label="Colour encoding"
                            value={colorMode}
                            onChange={(value) => {
                              setComparison(null);
                              if (
                                (value === "density" || value === "peculiar") &&
                                displayMode === "groups"
                              )
                                changeDisplay("galaxies");
                              setColorMode(value);
                            }}
                            options={ATLAS_COLOR_OPTIONS}
                          />
                        )}
                      </div>
                      {!comparisonResult && colorMode === "density" ? (
                        <div className="lv-spatial-setting">
                          <span>Density estimator</span>
                          <Choice<DensityMethod>
                            label="Density estimator"
                            value={densityMethod}
                            onChange={(value) => {
                              if (
                                value === "knn" &&
                                !(
                                  Number(densityRadius) >= 0.01 &&
                                  Number(densityRadius) <= 100
                                )
                              )
                                setDensityRadius(
                                  String(DEFAULT_DENSITY_CONFIG.radiusMpc),
                                );
                              if (
                                value === "radius" &&
                                !(
                                  Number.isInteger(Number(densityK)) &&
                                  Number(densityK) >= 2 &&
                                  Number(densityK) <= 50
                                )
                              )
                                setDensityK(String(DEFAULT_DENSITY_CONFIG.k));
                              setDensityMethod(value);
                            }}
                            options={[
                              { value: "radius", label: "Fixed radius" },
                              { value: "knn", label: "k neighbours" },
                            ]}
                          />
                          {densityMethod === "radius" ? (
                            <label className="lv-spatial-environment-inputs">
                              Radius [Mpc]
                              <input
                                type="number"
                                min="0.01"
                                max="100"
                                step="0.1"
                                value={densityRadius}
                                onChange={(event) =>
                                  setDensityRadius(event.target.value)
                                }
                              />
                            </label>
                          ) : (
                            <label className="lv-spatial-environment-inputs">
                              Neighbours (k)
                              <input
                                type="number"
                                min="2"
                                max="50"
                                step="1"
                                value={densityK}
                                onChange={(event) =>
                                  setDensityK(event.target.value)
                                }
                              />
                            </label>
                          )}
                          {localOnly ? (
                            <label className="lv-spatial-grid-toggle">
                              <input
                                type="checkbox"
                                checked={densityBoundary}
                                onChange={(event) =>
                                  setDensityBoundary(event.target.checked)
                                }
                              />{" "}
                              Include edge estimates
                            </label>
                          ) : null}
                          {!densityConfig ? (
                            <span role="status">
                              Enter R = 0.01–100 Mpc and integer k = 2–50.
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      {!comparisonResult && colorMode === "peculiar" ? (
                        <label className="lv-spatial-environment-inputs">
                          H₀ [km/s/Mpc]
                          <input
                            type="number"
                            min="1"
                            max="200"
                            step="0.5"
                            value={environmentHubble}
                            onChange={(event) =>
                              setEnvironmentHubble(event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                    </>
                  ) : null}
                </section>
                <section
                  className="lv-spatial-panel"
                  aria-label="Marker appearance"
                  hidden={appearancePage !== "style"}
                >
                  <SectionHeading
                    label="Markers & theme"
                    onReset={resetMarkers}
                  />
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
                </section>
                <section
                  className="lv-spatial-panel"
                  aria-label="Radial velocity controls"
                  hidden={appearancePage !== "layers"}
                >
                  <SectionHeading
                    label="Radial velocity vectors"
                    onReset={resetVectors}
                  />
                  <div className="lv-spatial-setting">
                    <Choice<RadialVectorScope>
                      label="Radial peculiar velocity vectors"
                      value={velocityScope}
                      onChange={(value) => {
                        if (value !== "off" && displayMode === "groups")
                          changeDisplay("galaxies");
                        setVelocityScope(value);
                      }}
                      options={[
                        { value: "off", label: "Off" },
                        { value: "selected", label: "Selected" },
                        { value: "all", label: "All" },
                      ]}
                    />
                    {paired && velocityScope !== "off" ? (
                      <p className="lv-spatial-help">
                        Vectors paused in matched views.
                      </p>
                    ) : null}
                    {colorMode === "peculiar" || velocityScope !== "off" ? (
                      <label className="lv-spatial-environment-inputs">
                        H₀ [km/s/Mpc]
                        <input
                          type="number"
                          min="1"
                          max="200"
                          step="0.5"
                          value={environmentHubble}
                          onChange={(event) =>
                            setEnvironmentHubble(event.target.value)
                          }
                        />
                      </label>
                    ) : null}
                    {velocityScope !== "off" ? (
                      <>
                        <label className="lv-spatial-environment-inputs">
                          Mpc per 100 km/s
                          <input
                            type="number"
                            min="0.01"
                            max="2"
                            step="0.05"
                            value={velocityScale}
                            onChange={(event) =>
                              setVelocityScale(event.target.value)
                            }
                          />
                        </label>
                        <label className="lv-spatial-environment-inputs">
                          Min |Vpec| [km/s]
                          <input
                            type="number"
                            min="0"
                            max="2000"
                            step="10"
                            value={velocityThreshold}
                            onChange={(event) =>
                              setVelocityThreshold(event.target.value)
                            }
                          />
                        </label>
                      </>
                    ) : null}
                    {(colorMode === "peculiar" || velocityScope !== "off") &&
                    !velocityConfig ? (
                      <small role="status">
                        Check H₀ (1–200), scale (0.01–2) and threshold (0–2000).
                      </small>
                    ) : null}
                  </div>
                </section>
                <section
                  className="lv-spatial-panel"
                  aria-label="Reference guides"
                  hidden={appearancePage !== "layers"}
                >
                  <SectionHeading
                    label="Reference guides"
                    onReset={resetGuides}
                  />
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
                  {paired &&
                  (intervalMode !== "off" || guides.shells.length > 0) ? (
                    <p className="lv-spatial-help">
                      Distance shells and intervals are paused in matched views.
                    </p>
                  ) : null}
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
                  <label className="lv-spatial-grid-toggle">
                    <input
                      type="checkbox"
                      checked={avoidance.enabled}
                      onChange={(event) =>
                        setAvoidance((previous) => ({
                          ...previous,
                          enabled: event.target.checked,
                        }))
                      }
                    />{" "}
                    Zone of Avoidance (geometric)
                  </label>
                  {avoidance.enabled ? (
                    <>
                      <label className="lv-spatial-environment-inputs">
                        Latitude limit: {avoidance.latitudeDeg}°
                        <input
                          type="range"
                          min="1"
                          max="30"
                          step="1"
                          value={avoidance.latitudeDeg}
                          onChange={(event) =>
                            setAvoidance((previous) => ({
                              ...previous,
                              latitudeDeg: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <p className="lv-spatial-help">
                        Illustrative Galactic latitude band, not measured survey
                        coverage. Does not filter galaxies.
                      </p>
                    </>
                  ) : null}
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
                </section>
              </div>
              <div
                id="lv-spatial-tool-select"
                className="lv-spatial-tool-page"
                hidden={controlPage !== "select"}
              >
                <div className="lv-spatial-page-heading">
                  <SectionHeading label="Select" onReset={resetSelect} />
                </div>
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
                    <div className="lv-spatial-subnav lv-spatial-panel">
                      <Choice<"region" | "populations">
                        label="Selection tools"
                        value={selectionPage}
                        onChange={setSelectionPage}
                        options={[
                          {
                            value: "region",
                            label: selectionActive ? "Region •" : "Region",
                          },
                          {
                            value: "populations",
                            label: populationActive
                              ? "Populations •"
                              : "Populations",
                          },
                        ]}
                      />
                    </div>
                    <section
                      className="lv-spatial-panel"
                      aria-label="Spatial selection"
                      hidden={selectionPage !== "region"}
                    >
                      <SectionHeading label="Region" onReset={resetRegion} />

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
                        <span>Region frame</span>
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
                          <div className="lv-spatial-setting">
                            <span>Centre [Mpc]</span>
                            <div className="lv-spatial-slice-inputs lv-spatial-axis-inputs">
                              {selectionAxes.map((axis, i) => (
                                <label key={i}>
                                  {axis}
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
                            </div>
                          </div>
                          {selectionKind === "sphere" ? (
                            <label className="lv-spatial-environment-inputs">
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
                            <div className="lv-spatial-setting">
                              <span>Full size [Mpc]</span>
                              <div className="lv-spatial-slice-inputs lv-spatial-axis-inputs">
                                {selectionAxes.map((axis, i) => (
                                  <label key={i}>
                                    {axis}
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
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="lv-spatial-views">
                        <button
                          className="lv-spatial-primary"
                          type="button"
                          disabled={!draftValid}
                          onClick={applySelection}
                        >
                          Apply region
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
                          Slice; {activeSlice.frame};{" "}
                          {
                            observerAxisLabels(activeSlice.frame)[
                              Number(activeSlice.axis)
                            ]
                          }
                          : {sliceBounds(activeSlice).map(display).join(" to ")}{" "}
                          Mpc; {slicedPoints.length} / {points.length} galaxies.
                        </p>
                      ) : null}
                      {activeRegion ? (
                        <p className="lv-spatial-help" role="status">
                          {activeRegion.kind === "sphere" ? "Sphere" : "Box"};{" "}
                          {activeRegion.frame}; centre (
                          {activeRegion.centreMpc.map(display).join(", ")}) Mpc;{" "}
                          {activeRegion.kind === "sphere"
                            ? `R = ${display(activeRegion.radiusMpc)} Mpc`
                            : `${activeRegion.sizeMpc.map(display).join(" × ")} Mpc`}
                          ; {slicedPoints.length} / {points.length} galaxies.
                        </p>
                      ) : null}
                      <p className="lv-spatial-help">
                        Nominal individual distances; boundaries use the region
                        frame.
                      </p>
                    </section>
                    <section
                      className="lv-spatial-panel"
                      aria-label="Galaxy populations"
                      hidden={selectionPage !== "populations"}
                    >
                      <SectionHeading
                        label="Populations"
                        onReset={resetPopulations}
                      />

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
                              togglePopulation(option.id, event.target.checked)
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
                        {filteredPoints.length} / {slicedPoints.length} galaxies
                        (counts before population filtering).
                      </p>
                      {populationActive ? (
                        <button
                          className="lv-spatial-full-action"
                          type="button"
                          onClick={() => changePopulation(defaultPopulation())}
                        >
                          Clear populations
                        </button>
                      ) : null}
                    </section>
                    {selectionActive || populationActive ? (
                      <section className="lv-spatial-panel lv-spatial-transfer">
                        <button
                          type="button"
                          disabled={!populationReady || paired}
                          onClick={transferSample}
                        >
                          Send to Sky Atlas ({filteredPoints.length})
                        </button>
                        {paired ? (
                          <p className="lv-spatial-help">
                            Return to Real to transfer the physical sample.
                          </p>
                        ) : null}
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
                <div className="lv-spatial-page-heading">
                  <SectionHeading label="Analysis" onReset={resetAnalysis} />
                </div>
                <section
                  className="lv-spatial-panel"
                  aria-label="Spatial connectivity"
                >
                  <SectionHeading
                    label="Spatial connectivity"
                    onReset={resetConnectivity}
                  />
                  {!fofAvailable ? (
                    <>
                      <p className="lv-spatial-help">
                        FoF and MST use individual distances in Real space only.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          changeDisplay("galaxies");
                          setSpaceMode("real");
                        }}
                      >
                        Show real galaxies
                      </button>
                      {fof.enabled ? (
                        <button
                          className="lv-spatial-full-action"
                          type="button"
                          onClick={() =>
                            setFof((previous) => ({
                              ...previous,
                              enabled: false,
                            }))
                          }
                        >
                          Clear connectivity
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Choice<ConnectivityMethod>
                        label="Connectivity method"
                        value={connectivityDraft}
                        options={[
                          { value: "fof", label: "FoF" },
                          { value: "mst", label: "MST" },
                          { value: "mst-cut", label: "Cut MST" },
                        ]}
                        onChange={setConnectivityDraft}
                      />
                      {connectivityDraft !== "mst" ? (
                        <label className="lv-spatial-environment-inputs">
                          {connectivityDraft === "mst-cut"
                            ? "Maximum edge [Mpc]"
                            : "Linking length [Mpc]"}
                          <input
                            type="number"
                            min="0.01"
                            max="10"
                            step="any"
                            value={fofDraft}
                            onChange={(event) =>
                              setFofDraft(event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                      <div className="lv-spatial-views">
                        <button
                          className="lv-spatial-primary"
                          type="button"
                          disabled={
                            connectivityDraft !== "mst" &&
                            !validLinkingLength(Number(fofDraft))
                          }
                          onClick={() =>
                            setFof({
                              enabled: true,
                              linkingMpc:
                                connectivityDraft === "mst"
                                  ? fof.linkingMpc
                                  : Number(fofDraft),
                              ...(connectivityDraft === "fof"
                                ? {}
                                : { method: connectivityDraft }),
                            })
                          }
                        >
                          {connectivityDraft === "fof"
                            ? "Run FoF"
                            : connectivityDraft === "mst"
                              ? "Run MST"
                              : "Run Cut MST"}
                        </button>
                        <button
                          type="button"
                          disabled={!fof.enabled}
                          onClick={() =>
                            setFof((previous) => ({
                              ...previous,
                              enabled: false,
                            }))
                          }
                        >
                          Clear
                        </button>
                      </div>
                      {fofResult ? (
                        <p className="lv-spatial-help" role="status">
                          Applied: {connectivityLabel},{" "}
                          {fofResult.forest.length} links.
                        </p>
                      ) : fof.enabled ? (
                        <p className="lv-spatial-help" role="status">
                          Connectivity unavailable.
                        </p>
                      ) : null}
                      <p className="lv-spatial-method-note">
                        {connectivityDraft === "fof"
                          ? "Friends-of-Friends (FoF) links every pair within the specified separation. Chains of these links define associations, even if their endpoints are farther apart than the linking length. Increasing the threshold merges components."
                          : connectivityDraft === "mst"
                            ? "The minimum spanning tree (MST) connects all eligible galaxies using the smallest total three-dimensional edge length, without cycles. Long edges mark where the tree bridges widely separated parts of the sample."
                            : "Cut MST removes all tree edges longer than the chosen threshold. The remaining components are identical to FoF associations at that separation; varying the cut reveals how structures merge or fragment."}
                      </p>
                      <p className="lv-spatial-help">
                        Uses visible eligible galaxies at nominal individual
                        distances. Geometric connectivity does not establish
                        physical membership.
                      </p>
                    </>
                  )}
                </section>
                <section
                  className="lv-spatial-panel"
                  aria-label="Population comparison"
                >
                  <SectionHeading
                    label="Compare populations"
                    onReset={resetComparison}
                  />
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
                          <Choice<"a" | "b">
                            label="Population to edit"
                            value={comparisonSide}
                            onChange={setComparisonSide}
                            options={[
                              {
                                value: "a",
                                label: `A (${comparison.a.ids.length})`,
                              },
                              {
                                value: "b",
                                label: `B (${comparison.b.ids.length})`,
                              },
                            ]}
                          />
                          {(["a", "b"] as const).map((side) => (
                            <div
                              key={side}
                              className="lv-spatial-comparison-editor"
                              hidden={comparisonSide !== side}
                            >
                              <div className="lv-spatial-setting">
                                <span>
                                  <i
                                    className="lv-spatial-color-swatch"
                                    style={{
                                      background:
                                        COMPARISON_COLORS[
                                          side === "a" ? "aOnly" : "bOnly"
                                        ],
                                    }}
                                    aria-hidden="true"
                                  />{" "}
                                  Population {side.toUpperCase()}
                                </span>
                              </div>
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
                            </div>
                          ))}
                          {!comparisonResult ? (
                            <p className="lv-spatial-help">
                              Choose at least one criterion for each population.
                            </p>
                          ) : null}
                          <p className="lv-spatial-help">
                            Compares the current filtered sample. Unknown means
                            insufficient data for classification.
                          </p>
                        </>
                      ) : null}
                    </>
                  )}
                </section>
              </div>
            </div>
            <footer className="lv-spatial-export lv-spatial-export-footer">
              <button
                className="lv-spatial-full-action"
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
                  PNG export failed. Try a smaller viewport or reopen the scene.
                </p>
              ) : null}
            </footer>
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
              {paired ? (
                <div className="lv-spatial-space-label" role="status">
                  {redshift ? "Redshift space (VLG/H₀)" : "Real matched"}; H₀ ={" "}
                  {hubbleValue >= 1 && hubbleValue <= 200 ? hubbleValue : "—"}
                </div>
              ) : null}
              <Choice<ObserverFrame>
                label="Coordinate frame"
                value={frame}
                onChange={setFrame}
                options={FRAMES}
              />
              {avoidance.enabled ? (
                <div className="lv-spatial-space-label">
                  Geometric ZoA: |b| ≤ {avoidance.latitudeDeg}°
                </div>
              ) : null}
            </div>
            {!paired &&
            !error &&
            environmentTarget &&
            activeShown.has(environmentTarget.object.pgc) ? (
              <div className="lv-spatial-environment-hud">
                <button
                  type="button"
                  aria-pressed={environmentOn && displayMode === "galaxies"}
                  onClick={toggleEnvironment}
                  title="Show the nominal spatial neighbourhood as individual galaxy positions"
                >
                  {displayMode === "groups"
                    ? "Explore neighbours ↗"
                    : environmentOn
                      ? "Hide environment"
                      : "Show environment"}
                </button>
                {environmentOn && displayMode === "galaxies" ? (
                  <>
                    <div className="lv-spatial-environment-inputs">
                      <label>
                        R [Mpc]
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.1"
                          value={environmentRadius}
                          onChange={(event) =>
                            setEnvironmentRadius(event.target.value)
                          }
                        />
                      </label>
                      <label>
                        H₀ [km/s/Mpc]
                        <input
                          type="number"
                          min="1"
                          max="200"
                          step="0.5"
                          value={environmentHubble}
                          onChange={(event) =>
                            setEnvironmentHubble(event.target.value)
                          }
                        />
                      </label>
                    </div>
                    {environmentResult && environmentGeometry ? (
                      <div aria-live="polite">
                        <dl className="lv-spatial-data">
                          <dt>Neighbours</dt>
                          <dd>
                            {environmentGeometry.neighbours.length} /{" "}
                            {environmentResult.within.length} shown
                          </dd>
                          <dt>Sample density [Mpc⁻³]</dt>
                          <dd>
                            {environmentResult.densityPerMpc3.toPrecision(3)}
                          </dd>
                          <dt>Vpec, LG [km/s]</dt>
                          <dd>
                            {environmentVelocity === null
                              ? "—"
                              : environmentVelocity.toFixed(1)}
                          </dd>
                        </dl>
                        {environmentResult.nearest ? (
                          <div className="lv-spatial-environment-nearest">
                            Nearest:{" "}
                            {names.get(environmentResult.nearest.pgc) ??
                              `PGC ${environmentResult.nearest.pgc}`}{" "}
                            (
                            {environmentResult.nearest.separationMpc.toPrecision(
                              3,
                            )}{" "}
                            Mpc){environmentGeometry.nearest ? "" : " (hidden)"}
                          </div>
                        ) : null}
                        <small>
                          Nominal sample, no completeness correction
                          {environmentResult.boundaryClipped
                            ? "; boundary clipped"
                            : ""}
                        </small>
                      </div>
                    ) : (
                      <small>Enter a radius between 0.01 and 100 Mpc.</small>
                    )}
                  </>
                ) : null}
              </div>
            ) : null}
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
            ) : paired && renderPoints.length === 0 ? (
              <div className="lv-spatial-message" role="status">
                No matched galaxies. Check H₀, distance quality and filters.
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
              <h3>Objects</h3>
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
                    : ""}
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
                        {group ? `${group.name} Group` : names.get(pgc)}; PGC{" "}
                        {pgc}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>
            {currentGroup || currentGalaxy ? (
              <section
                className="lv-spatial-panel lv-spatial-selection-panel"
                aria-label="Selected object"
              >
                {currentGroup ? (
                  <section
                    className="lv-spatial-object-card"
                    aria-label="Selected physical group"
                  >
                    <div className="lv-spatial-card-head">
                      <div>
                        <small>Physical group (PGC {currentGroup.pgc})</small>
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
                        <small>Galaxy (PGC {currentGalaxy.object.pgc})</small>
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
                      {paired ? (
                        <>
                          <dt>VLG / H₀ [Mpc]</dt>
                          <dd>
                            {display(
                              selectedProxyPosition
                                ? Math.hypot(...selectedProxyPosition)
                                : null,
                            )}
                          </dd>
                        </>
                      ) : null}
                      <dt>Method</dt>
                      <dd>
                        {currentGalaxy.evidence?.distance_method_for_value ??
                          "—"}
                      </dd>
                      {!activeShown.has(currentGalaxy.object.pgc) ? (
                        <>
                          <dt>Visibility</dt>
                          <dd>
                            {paired &&
                            realSelectedIds.has(currentGalaxy.object.pgc)
                              ? "Excluded from matched sample"
                              : currentGalaxy.position
                                ? depthIds.has(currentGalaxy.object.pgc)
                                  ? selectionActive &&
                                    points.some(
                                      (point) =>
                                        point.object.pgc ===
                                        currentGalaxy.object.pgc,
                                    )
                                    ? "Outside selection or non-individual distance"
                                    : "Outside volume view"
                                  : "Hidden by distance quality"
                                : currentGalaxy.reason}
                          </dd>
                        </>
                      ) : null}
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
                      <summary>
                        {paired
                          ? "Real coordinates & provenance"
                          : "Coordinates & provenance"}
                      </summary>
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
                          {currentGalaxy.evidence
                            ?.distance_reference_for_value ?? "—"}
                        </dd>
                        <dt>Value review</dt>
                        <dd>
                          {currentGalaxy.evidence
                            ?.distance_value_review_status ?? "—"}
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
                ) : null}
                {environmentGeometry && environmentResult ? (
                  <AtlasEnvironment
                    key={selectedPgc}
                    result={environmentResult}
                    names={names}
                  />
                ) : null}
              </section>
            ) : null}
            <section
              className="lv-spatial-panel"
              aria-label="Catalogue coverage"
            >
              <h3>In this view</h3>
              {paired ? (
                <p className="lv-spatial-help">
                  Matched: {renderPoints.length} / {filteredPoints.length}{" "}
                  physical sample galaxies. See View for eligibility.
                </p>
              ) : null}
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
            {fofResult ? (
              <section
                className="lv-spatial-panel"
                aria-label="Connectivity results"
              >
                <h3>{connectivityLabel}</h3>
                <dl className="lv-spatial-data">
                  <dt>Eligible / shown</dt>
                  <dd>
                    {fofResult.eligibleCount} / {visiblePoints.length}
                  </dd>
                  <dt>Associations (N ≥ 2)</dt>
                  <dd>{fofResult.components.length}</dd>
                  <dt>Associated / isolated</dt>
                  <dd>
                    {fofResult.nodes.length} / {fofResult.isolatedCount}
                  </dd>
                  {"pairCount" in fofResult ? (
                    <>
                      <dt>Pairs / drawn links</dt>
                      <dd>
                        {fofResult.pairCount} / {fofResult.forest.length}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt>Retained / tree edges</dt>
                      <dd>
                        {fofResult.forest.length} / {fofResult.treeEdgeCount}
                      </dd>
                      <dt>Tree length [Mpc]</dt>
                      <dd>{fofResult.treeLengthMpc.toPrecision(4)}</dd>
                      <dt>Retained length [Mpc]</dt>
                      <dd>{fofResult.retainedLengthMpc.toPrecision(4)}</dd>
                      <dt>Longest edge [Mpc]</dt>
                      <dd>{fofResult.longestEdgeMpc?.toPrecision(4) ?? "—"}</dd>
                    </>
                  )}
                </dl>
                <p className="lv-spatial-help">
                  Association outlines and links. Nominal connectivity, not
                  physical membership. Colours may repeat.
                </p>
                {selectedPgc !== null ? (
                  <span>
                    Selected component:{" "}
                    {fofResult.components.find((component) =>
                      component.pgcs.includes(selectedPgc),
                    )?.pgcs.length ?? "—"}{" "}
                    members
                  </span>
                ) : null}
              </section>
            ) : null}
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
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#c96d76" }}
                      aria-hidden="true"
                    />
                    T ≤ −3
                  </span>
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#d99ea4" }}
                      aria-hidden="true"
                    />
                    −3 &lt; T &lt; 0
                  </span>
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#a995a6" }}
                      aria-hidden="true"
                    />
                    T = 0
                  </span>
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#91a8c6" }}
                      aria-hidden="true"
                    />
                    0 &lt; T ≤ 3
                  </span>
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#6489bc" }}
                      aria-hidden="true"
                    />
                    3 &lt; T ≤ 7
                  </span>
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#3f6fab" }}
                      aria-hidden="true"
                    />
                    T &gt; 7
                  </span>
                  <span>
                    <i
                      className="lv-spatial-color-swatch"
                      style={{ background: "#9aa2ac" }}
                      aria-hidden="true"
                    />
                    Missing T
                  </span>
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
              {!comparisonResult &&
              colorMode === "density" &&
              densityResult &&
              densityConfig ? (
                <div className="lv-spatial-help">
                  {densityConfig.method === "radius"
                    ? `R = ${densityConfig.radiusMpc} Mpc; N/V`
                    : `k = ${densityConfig.k}; k/V(rₖ)`}
                  ; {densityResult.eligibleCount} eligible galaxies before
                  spatial/population filters.{" "}
                  {localOnly
                    ? `${densityResult.boundaryCount} edge estimates ${densityConfig.includeBoundary ? "included without correction" : "excluded"}. `
                    : ""}
                  Nominal sample; linear scale. No completeness or
                  distance-error correction.
                </div>
              ) : null}
              {(!paired && velocityScope !== "off") ||
              (!comparisonResult && colorMode === "peculiar") ? (
                <div className="lv-spatial-help">
                  <strong>Radial velocity residual</strong>
                  <span className="lv-spatial-legend-line">
                    Vpec = VLG − H₀D, H₀ ={" "}
                    {hubbleValue >= 1 && hubbleValue <= 200 ? hubbleValue : "—"}
                  </span>
                  <details className="lv-spatial-details">
                    <summary>Velocity convention</summary>
                    <p>
                      Observer-centred direction and catalogue LG-frame
                      velocity; no barycentric position correction or error
                      propagation.
                    </p>
                  </details>
                  {!paired && velocityScope !== "off" ? (
                    <>
                      <div className="lv-spatial-legend">
                        <span>
                          <i
                            className="lv-spatial-line-key"
                            style={{ color: "#407acb" }}
                            aria-hidden="true"
                          >
                            ←
                          </i>
                          Negative residual
                        </span>
                        <span>
                          <i
                            className="lv-spatial-line-key"
                            style={{ color: "#ca7040" }}
                            aria-hidden="true"
                          >
                            →
                          </i>
                          Positive residual
                        </span>
                      </div>
                      <span>
                        {velocityArrows.length} radial arrows;{" "}
                        {velocityConfig
                          ? `${velocityConfig.mpcPer100} Mpc per 100 km/s`
                          : "invalid settings"}
                        . Length is symbolic, not a displacement.
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
              {!paired && intervalMode !== "off" ? (
                <div className="lv-spatial-marker-key">
                  <span>
                    Distance intervals:{" "}
                    {intervalMode === "selected"
                      ? selectedInterval
                        ? 1
                        : 0
                      : intervals.length}{" "}
                    shown
                  </span>
                  <div className="lv-spatial-legend">
                    <span>
                      <i
                        className="lv-spatial-line-key"
                        style={{ color: "#46bfac" }}
                        aria-hidden="true"
                      >
                        ━
                      </i>
                      Verified
                    </span>
                    <span>
                      <i
                        className="lv-spatial-line-key"
                        style={{ color: "#ba9b65" }}
                        aria-hidden="true"
                      >
                        ━
                      </i>
                      Catalogue, unreviewed
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
                  <span>◇ Assigned / △ Model / □ Unknown</span>
                ) : null}
                <span>⊙ Observer</span>
              </div>
              {renderGuides.plane ||
              renderGuides.shells.length > 0 ||
              avoidance.enabled ? (
                <div className="lv-spatial-legend">
                  {guides.plane ? (
                    <span>▱ Supergalactic plane (SGZ = 0)</span>
                  ) : null}
                  {avoidance.enabled ? (
                    <span>
                      ◇ Geometric ZoA (|b| ≤ {avoidance.latitudeDeg}°)
                    </span>
                  ) : null}
                  {renderGuides.shells.length > 0 ? (
                    <span>
                      ◎ Distance shells: {renderGuides.shells.join(", ")} Mpc
                    </span>
                  ) : null}
                </div>
              ) : null}
              {!paired && displayMode === "galaxies" && layers.md ? (
                <div className="lv-spatial-legend">
                  <span>
                    <i
                      className="lv-spatial-line-key"
                      style={{ color: "#7297aa" }}
                      aria-hidden="true"
                    >
                      ━
                    </i>
                    Catalogue MD links: {mdEdges.length}
                  </span>
                  <span>Individual distance endpoints only</span>
                </div>
              ) : null}
              {sizeMode !== "fixed" ? (
                <div className="lv-spatial-marker-key">
                  <span>
                    Galaxy symbol size: M<sub>B</sub> [mag]
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
                </div>
              ) : null}
            </section>
          </div>
        </aside>
      </div>
    </dialog>
  );
}
