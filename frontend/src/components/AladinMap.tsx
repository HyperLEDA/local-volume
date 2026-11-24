import { stageAtlasFirstFrame } from "../lib/atlasInitialFrame.ts";
import A, {
  type AladinCatalog,
  type AladinSource,
  type AladinView,
} from "aladin-lite";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { angularSeparationDeg, type SkyCoordinates } from "../lib/skySearch.ts";
import {
  isValidRegion,
  rectangleFromScreenCorners,
  regionBoundary,
  type SkyRegion,
} from "../lib/skyRegion.ts";
import { useNavigate } from "react-router-dom";
import { AtlasGroupContext } from "./AtlasGroupContext.tsx";
import { useAtlasGroupContext } from "../lib/useAtlasGroupContext.ts";
import { buildAtlasGroupGraph } from "../lib/atlasGroupContext.ts";
import { TIDAL_TONES, type TidalTone } from "../lib/groupTidalEdges.ts";
import type { CatalogObject } from "../api/objects.ts";
import type { AtlasCamera } from "../lib/atlasCamera.ts";
import {
  greatCircleVertices,
  hasSkyPosition,
  visibleGreatCircleSegments,
} from "../lib/mdConnection.ts";
import {
  nearestMarkerAtPixel,
  overviewMarkerZoomFov,
} from "../lib/atlasMarkerZoom.ts";
import type { AtlasRange } from "../lib/atlasBounds.ts";
import {
  findReticleTarget,
  markerDiameter,
  reticlePopupAllowed,
} from "../lib/reticle.ts";
import { popupObjectRoute } from "../lib/popupNavigation.ts";
import {
  initialAladinTarget,
  isValidInitialAladinFocus,
} from "../lib/aladinInitialView.ts";
import { shouldDismissSkyPopup } from "../lib/mapInteraction.ts";
import { morphologyColor } from "../lib/morphologyColors.ts";
import {
  drawOverviewMarker,
  drawSelectedObjectMarker,
  OVERVIEW_MARKER_MAX_DIAMETER,
} from "../lib/overviewMarkers.ts";
import { formatJ2000Coordinate } from "../lib/popupCoordinates.ts";
import { installDetailInitialFovCalibration } from "../lib/detailFovCalibration.ts";
import {
  getGalaxyAngularScale,
  type GalaxyAngularScale,
} from "../lib/galaxyAngularScale.ts";
import { createGalaxySurveySwitcher } from "../lib/galaxySurveySwitcher.ts";
import {
  createGalaxyOverlayController,
  type ComparisonAladinView,
} from "../lib/galaxySurveyOverlay.ts";

// Aladin Lite v3 exposes these methods at runtime, but the npm typings used
// by this project omit them. Keep the compatibility boundary local to the map.
type AtlasGraphicOverlay = {
  add: (shape: object) => void;
  removeAll: () => void;
  reportChange: () => void;
};
type AtlasDrawingApi = {
  graphicOverlay: (options: {
    name: string;
    color: string;
    lineWidth: number;
  }) => AtlasGraphicOverlay;
  circle: (ra: number, dec: number, radiusDeg: number) => object;
  polyline: (vertices: [number, number][]) => object;
};
type AtlasDrawingView = {
  addOverlay: (overlay: AtlasGraphicOverlay) => void;
  pix2world: (x: number, y: number) => number[] | null;
};
const atlasDrawingApi = A as typeof A & AtlasDrawingApi;

const DEFAULT_HIPS_SURVEY = "https://skies.esac.esa.int/DSSColor";

export type SkyFocus = {
  ra: number;
  dec: number;
  requestId: number;
  fov?: number;
};

type AladinMapProps = {
  objects: CatalogObject[];
  contextObjects?: CatalogObject[];
  referenceObjects?: CatalogObject[];
  focus: SkyFocus | null;
  fov?: number;
  /** Applies to individual galaxy views only; the Atlas keeps DSS2. */
  detailSurveyId?: string;
  onDetailSurveyError?: (message: string | null) => void;
  /** Optional comparison HiPS, independent of the base survey. */
  detailOverlaySurveyId?: string | null;
  detailOverlayOpacity?: number;
  onDetailOverlayError?: (message: string | null) => void;
  enableReticlePopups?: boolean;
  region?: SkyRegion | null;
  drawingMode?: "circle" | "rectangle" | null;
  tidalRange?: AtlasRange | null;
  onRegionDraw?: (region: SkyRegion) => void;
  onCancelDraw?: () => void;
  onObjectNavigate?: (pgc: number) => string | null;
  onAtlasCamera?: (view: AtlasCamera | null) => void;
  onDetailScaleChange?: (scale: GalaxyAngularScale | null) => void;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatQuantity(
  value: number | null | undefined,
  digits: number,
  unit = "",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function popupField(label: string, value: string): string {
  return `<div class="lv-popup-field"><span class="lv-popup-label">${label}:</span><span class="lv-popup-value" title="${escapeHtml(value)}">${escapeHtml(value)}</span></div>`;
}

/** MD membership is an adopted catalogue relation; preliminary computation
 * status remains documented in the physical-data metadata/tooltips. */
function popupMdField(
  object: CatalogObject,
  reference: readonly CatalogObject[],
): string {
  const pgc = object.md_pgc;
  const valid = typeof pgc === "number" && Number.isSafeInteger(pgc) && pgc > 0;
  const md = valid ? (reference.find((row) => row.pgc === pgc) ?? null) : null;
  const label =
    md?.name.trim() || object.md_name?.trim() || (valid ? `PGC ${pgc}` : "—");
  if (md === null || !valid) return popupField("MD", label);
  const name = escapeHtml(label);
  const href = `/object/${pgc}`;
  const locate = hasSkyPosition(md)
    ? `<button type="button" class="lv-popup-md-locate" data-md-pgc="${pgc}" title="Locate ${name} on the map" aria-label="Locate ${name} on the map"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="2.25"/><path d="M8 1.25v3.1M8 11.65v3.1M1.25 8h3.1M11.65 8h3.1" stroke-linecap="round"/></svg></button>`
    : "";
  return `<div class="lv-popup-field"><span class="lv-popup-label">MD:</span><span class="lv-popup-value lv-popup-md-value"><a class="lv-popup-md-link" href="${href}" title="Open ${name} in LV LEDA">${name}</a>${locate}</span></div>`;
}

export function popupTitle(object: CatalogObject): string {
  const nature = escapeHtml(object.type_name ?? "—");
  const name = escapeHtml(object.name);
  const position = formatJ2000Coordinate(object.ra, object.dec);
  const coordinate = position
    ? `<span class="lv-popup-jcoord" title="ICRS, J2000">${position}</span>`
    : "";
  return `<div class="lv-popup-header"><div class="lv-popup-heading"><a class="lv-popup-name" href="/object/${object.pgc}">${name}</a>${coordinate}</div><span class="lv-popup-nature">${nature}</span></div>`;
}

export function popupDescription(
  object: CatalogObject,
  reference: readonly CatalogObject[] = [],
): string {
  const fields = [
    popupField("B", formatQuantity(object.b_mag, 2, "mag")),
    popupField("K<sub>s</sub>", formatQuantity(object.ks_mag, 2, "mag")),
    popupField(
      "V<sub>hel</sub>",
      formatQuantity(object.lvg_v_hel_kms, 1, "km/s"),
    ),
    popupField("W<sub>50</sub>", formatQuantity(object.w50_kms, 1, "km/s")),
    popupField("D", formatQuantity(object.dist, 2, "Mpc")),
    popupMdField(object, reference),
  ];
  return `<div class="lv-popup-grid">${fields.join("")}</div>`;
}

export function setCatalogSources(
  catalog: AladinCatalog,
  objects: CatalogObject[],
  sizeScale = 1,
  maxDiameter = 18,
  tidalRange: AtlasRange | null = null,
  reference: readonly CatalogObject[] = objects,
): void {
  catalog.removeAll();
  const sources = objects.flatMap((object) => {
    if (
      object.ra === null ||
      object.dec === null ||
      !Number.isFinite(object.ra) ||
      !Number.isFinite(object.dec)
    ) {
      return [];
    }
    const diameter = Math.max(
      4,
      Math.round(
        markerDiameter(object.abs_b_mag ?? null, maxDiameter) * sizeScale,
      ),
    );
    const marker = A.marker(
      object.ra,
      object.dec,
      {
        popupTitle: popupTitle(object),
        popupDesc: popupDescription(object, reference),
        useMarkerDefaultIcon: false,
      },
      {
        morphology_t: object.morphology_t ?? null,
        lv_marker_diameter: diameter,
        pgc: object.pgc,
        theta1: object.theta1 ?? null,
        tidal_min: tidalRange?.min ?? null,
        tidal_max: tidalRange?.max ?? null,
      },
    );
    marker.setSize(diameter);
    return [marker];
  });
  if (sources.length === 0) {
    return;
  }
  catalog.addSources(sources);
}

// ISSUE49_PRE_PUBLISH_LINT_FIX_20261118
// Keep the initial Atlas AIT fit isolated from React renders. This helper
// preserves Phase E/F behavior, including the first-resize correction and
// stopping all automatic updates as soon as the user takes control.
function installInitialAtlasResizeFit(
  view: AladinView,
  element: HTMLDivElement,
  getCurrentFocus: () => SkyFocus | null,
  isCancelled: () => boolean,
): () => void {
  const resizeApi = view as unknown as {
    on: (event: "resizeChanged", callback: () => void) => void;
    off?: (event: "resizeChanged") => void;
  };
  let stopped = false;
  let scheduledFrame: number | null = null;

  function stopAtlasFit(): void {
    if (stopped) return;
    stopped = true;
    if (scheduledFrame !== null) {
      cancelAnimationFrame(scheduledFrame);
      scheduledFrame = null;
    }
    resizeApi.off?.("resizeChanged");
    element.removeEventListener("pointerdown", stopAtlasFit);
    element.removeEventListener("wheel", stopAtlasFit);
    element.removeEventListener("touchstart", stopAtlasFit);
  }

  function fitAtlasAfterResize(): void {
    scheduledFrame = null;
    if (isCancelled() || stopped) return;
    if (getCurrentFocus() !== null) {
      stopAtlasFit();
      return;
    }
    const bounds = element.getBoundingClientRect();
    const [width, height] = view.getSize();
    if (
      bounds.width < 2 ||
      bounds.height < 2 ||
      Math.abs(bounds.width - width) > 2 ||
      Math.abs(bounds.height - height) > 2
    ) {
      // The internal Aladin viewport is still catching up with the CSS box.
      // Retry on the next frame, never on a timer or a React re-render.
      scheduledFrame = requestAnimationFrame(fitAtlasAfterResize);
      return;
    }
    const actual = view.getFov()[0];
    if (Number.isFinite(actual) && actual > 0 && actual < 359.5) {
      view.setZoomFactor(1.02);
    }
  }

  function scheduleAtlasFit(): void {
    if (isCancelled() || stopped) return;
    if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(fitAtlasAfterResize);
  }

  resizeApi.on("resizeChanged", scheduleAtlasFit);
  element.addEventListener("pointerdown", stopAtlasFit);
  element.addEventListener("wheel", stopAtlasFit, { passive: true });
  element.addEventListener("touchstart", stopAtlasFit, { passive: true });
  scheduleAtlasFit();
  return stopAtlasFit;
}

export function AladinMap({
  objects,
  contextObjects,
  referenceObjects,
  focus,
  fov = 180,
  detailSurveyId,
  onDetailSurveyError,
  detailOverlaySurveyId = null,
  detailOverlayOpacity = 0.5,
  onDetailOverlayError,
  enableReticlePopups = false,
  tidalRange = null,
  region = null,
  drawingMode = null,
  onRegionDraw,
  onCancelDraw,
  onObjectNavigate,
  onAtlasCamera,
  onDetailScaleChange,
}: AladinMapProps) {
  const isOverview = fov >= 180;
  const mapFov = isOverview ? 360 : fov;
  const mapSurvey = isOverview
    ? DEFAULT_HIPS_SURVEY
    : (detailSurveyId ?? DEFAULT_HIPS_SURVEY);
  const containerRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<AladinCatalog | null>(null);
  const contextCatalogRef = useRef<AladinCatalog | null>(null);
  const viewRef = useRef<AladinView | null>(null);
  const scaleCallbackRef = useRef(onDetailScaleChange);
  scaleCallbackRef.current = onDetailScaleChange;
  // A changing React callback must not reinitialize the Aladin/WebGL instance.
  const atlasCameraCallbackRef = useRef(onAtlasCamera);
  useEffect(() => {
    atlasCameraCallbackRef.current = onAtlasCamera;
  }, [onAtlasCamera]);
  // Initial FoV and survey are read after the asynchronous Aladin initialization.
  const latestFovRef = useRef(mapFov);
  const latestSurveyRef = useRef(mapSurvey);
  const surveyErrorRef = useRef(onDetailSurveyError);
  const overlayErrorRef = useRef(onDetailOverlayError);
  const overlayControllerRef = useRef<ReturnType<
    typeof createGalaxyOverlayController
  > | null>(null);
  const surveySwitcherRef = useRef<ReturnType<
    typeof createGalaxySurveySwitcher
  > | null>(null);
  const latestFocusRef = useRef(focus);
  const mountedFocusRef = useRef<SkyFocus | null>(null);
  const mountedFovRef = useRef<number | null>(null);
  useEffect(() => {
    latestFovRef.current = mapFov;
  }, [mapFov]);
  useEffect(() => {
    latestSurveyRef.current = mapSurvey;
  }, [mapSurvey]);
  useEffect(() => {
    surveyErrorRef.current = onDetailSurveyError;
  }, [onDetailSurveyError]);
  useEffect(() => {
    overlayErrorRef.current = onDetailOverlayError;
  }, [onDetailOverlayError]);
  useEffect(() => {
    latestFocusRef.current = focus;
  }, [focus]);
  const objectsRef = useRef(objects);
  const referenceObjectsRef = useRef(referenceObjects ?? objects);
  const mdOverlayRef = useRef<AtlasGraphicOverlay | null>(null);
  const atlasGroupOverlaysRef = useRef(
    new Map<TidalTone, AtlasGraphicOverlay>(),
  );
  const refreshGroupEdgesRef = useRef<(() => void) | null>(null);
  const mdCatalogRef = useRef<AladinCatalog | null>(null);
  const refreshReticlePopupRef = useRef<(() => void) | null>(null);
  const clearReticlePopupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedPgc, setSelectedPgc] = useState<number | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const regionOverlayRef = useRef<AtlasGraphicOverlay | null>(null);
  const previewOverlayRef = useRef<AtlasGraphicOverlay | null>(null);
  const dragStartRef = useRef<SkyCoordinates | null>(null);
  const drawSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dragPixelRef = useRef<{ x: number; y: number } | null>(null);
  const [dragReadout, setDragReadout] = useState<string | null>(null);
  const navigate = useNavigate();

  /** Double-click a galaxy marker to inspect its wider celestial neighbourhood.
   * A double click on blank sky remains Aladin's normal map interaction. */
  function onMarkerDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if (!isOverview || drawingMode !== null) return;
    const target = event.target;
    if (target instanceof Element && target.closest("a, button, input, select"))
      return;
    const view = viewRef.current;
    if (view === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const galaxy = nearestMarkerAtPixel(
      objectsRef.current,
      (ra, dec) => view.world2pix(ra, dec),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    if (galaxy === null || galaxy.ra === null || galaxy.dec === null) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedPgc(galaxy.pgc);
    view.gotoRaDec(galaxy.ra, galaxy.dec);
    view.setFoV(overviewMarkerZoomFov(galaxy));
  }

  function onPopupLinkClick(event: MouseEvent<HTMLDivElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const locate = target.closest("button.lv-popup-md-locate");
    if (locate instanceof HTMLButtonElement) {
      const pgc = Number(locate.dataset.mdPgc);
      const md = referenceObjectsRef.current.find((row) => row.pgc === pgc);
      const view = viewRef.current;
      if (md && hasSkyPosition(md) && view) {
        event.preventDefault();
        event.stopPropagation();
        view.gotoRaDec(md.ra, md.dec);
        setSelectedPgc(md.pgc);
        view.showPopup(
          md.ra,
          md.dec,
          popupTitle(md),
          popupDescription(md, referenceObjectsRef.current),
        );
        overlayControllerRef.current = createGalaxyOverlayController(
          view as unknown as ComparisonAladinView,
          (message) => overlayErrorRef.current?.(message),
        );
      }
      return;
    }
    const anchor = target.closest("a.lv-popup-name, a.lv-popup-md-link");
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }
    const destination = popupObjectRoute(
      anchor.getAttribute("href"),
      {
        button: event.button,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      },
      anchor.target,
    );
    if (destination === null) {
      return;
    }
    event.preventDefault();
    const destinationPgc = Number(destination.slice("/object/".length));
    const contextual = onObjectNavigate?.(destinationPgc);
    void navigate(contextual ?? destination);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const mountedGroupOverlays = atlasGroupOverlaysRef.current;
    let cancelled = false;
    function isCancelled(): boolean {
      return cancelled;
    }
    const listeners = { detach: null as (() => void) | null };
    const atlasFitCleanup = { detach: null as (() => void) | null };
    const firstFrameCleanup = { detach: null as (() => void) | null };
    const detailFitCleanup = { detach: null as (() => void) | null };

    async function mount(element: HTMLDivElement): Promise<void> {
      await A.init;
      if (cancelled) return;
      // Let the first responsive layout settle before creating the WebGL canvas.
      // The map is initialized only once for this mount, with its final target/FoV.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (isCancelled()) return;
      const initialFocus = latestFocusRef.current;
      const requestedFocusFov = initialFocus?.fov;
      const hasFocusFov =
        requestedFocusFov !== undefined &&
        Number.isFinite(requestedFocusFov) &&
        requestedFocusFov > 0;
      const initialFov = hasFocusFov ? requestedFocusFov : latestFovRef.current;
      const initialSurvey = latestSurveyRef.current;
      // ISSUE49_PHASE_G_FIRST_FRAME_20261118
      // Reserve the final-size Atlas box, but do not display its default
      // 300x150 WebGL backing canvas or partially loaded survey.
      const stageFirstFrame =
        isOverview && initialFocus === null && !hasFocusFov;
      if (stageFirstFrame) {
        element.style.visibility = "hidden";
        element.setAttribute("aria-busy", "true");
      }
      const view = A.aladin(element, {
        fov: initialFov,
        projection: isOverview ? "AIT" : "SIN",
        cooFrame: "equatorial",
        survey: initialSurvey,
        target: initialAladinTarget(initialFocus),
        showReticle: true,
        showSimbadPointerControl: false,
        showFullscreenControl: false,
      });
      // ISSUE49_PHASE_F_ATLAS_FIRST_RESIZE_20261118
      // In Aladin Lite v3 the WASM viewport initially uses window.innerWidth.
      // Its deferred FIRST resize multiplies the current zoom by
      // (Aladin element width / window.innerWidth). Precompensate now so that
      // the first rendered AIT view remains all-sky instead of briefly
      // jumping to a ~250-degree field before Phase E corrects it later.
      // Do this only for the initial unfocused Atlas; never for galaxy detail,
      // searches, user zoom/pan or subsequent browser/window resizes.
      if (isOverview && initialFocus === null && !hasFocusFov) {
        const atlasWidth = view.getSize()[0];
        const initialWasmWidth = window.innerWidth;
        const zoomApi = view as AladinView & {
          getZoomFactor?: () => number;
        };
        const currentZoom = zoomApi.getZoomFactor?.();
        if (
          Number.isFinite(atlasWidth) &&
          atlasWidth > 2 &&
          Number.isFinite(initialWasmWidth) &&
          initialWasmWidth >= atlasWidth &&
          typeof currentZoom === "number" &&
          Number.isFinite(currentZoom) &&
          currentZoom > 0
        ) {
          // The observed first resize factor was 1399/1897. The device pixel
          // ratio cancels in the WASM width ratio, so both widths are CSS px.
          const compensatedZoom =
            (currentZoom * initialWasmWidth * 1.02) / atlasWidth;
          if (compensatedZoom >= 1 && compensatedZoom <= 8) {
            view.setZoomFactor(compensatedZoom);
          }
        }
      }
      if (stageFirstFrame) {
        firstFrameCleanup.detach = stageAtlasFirstFrame(view, element);
      }
      mountedFocusRef.current = isValidInitialAladinFocus(initialFocus)
        ? initialFocus
        : null;
      const catalog = A.catalog({
        name: "Local volume",
        shape: isOverview ? drawOverviewMarker : drawSelectedObjectMarker,
        sourceSize: 7,
        color: (source: AladinSource) =>
          morphologyColor(
            (source.data as { morphology_t?: number | null } | null)
              ?.morphology_t,
          ),
      });
      mountedFovRef.current = initialFov;
      // Calibrate only once the actual square WASM/WebGL viewport has settled.
      // A late asynchronous resize must not undo a user's own pan or zoom.
      if (!isOverview) {
        detailFitCleanup.detach = installDetailInitialFovCalibration(
          view,
          element,
          initialFov,
          () => latestFocusRef.current?.requestId ?? null,
          initialFocus?.requestId ?? null,
          isCancelled,
        );
      }

      if (isOverview && !hasFocusFov) {
        atlasFitCleanup.detach = installInitialAtlasResizeFit(
          view,
          element,
          () => latestFocusRef.current,
          isCancelled,
        );
      }
      if (!isOverview) {
        const contextCatalog = A.catalog({
          name: "Other LV catalog objects",
          shape: "circle",
          sourceSize: 6,
          color: (source: AladinSource) =>
            morphologyColor(
              (source.data as { morphology_t?: number | null } | null)
                ?.morphology_t,
            ),
        });
        view.addCatalog(contextCatalog);
        contextCatalogRef.current = contextCatalog;
      }
      view.addCatalog(catalog);
      if (isOverview) {
        const mdCatalog = A.catalog({
          name: "Selected galaxy group / MD context (outside filters)",
          shape: drawSelectedObjectMarker,
          sourceSize: 7,
          color: "#f0cf88",
        });
        view.addCatalog(mdCatalog);
        mdCatalogRef.current = mdCatalog;
      }
      // One sky-coordinate overlay persists while the user pans or zooms.
      const overlay = atlasDrawingApi.graphicOverlay({
        name: "Atlas region selection",
        color: "#e8ca90",
        lineWidth: 1.8,
      });
      (view as AladinView & AtlasDrawingView).addOverlay(overlay);
      regionOverlayRef.current = overlay;
      const preview = atlasDrawingApi.graphicOverlay({
        name: "Atlas region preview",
        color: "#f6dba5",
        lineWidth: 1.8,
      });
      (view as AladinView & AtlasDrawingView).addOverlay(preview);
      previewOverlayRef.current = preview;
      const mdOverlay = atlasDrawingApi.graphicOverlay({
        name: "Selected galaxy — Main Disturber",
        color: "#e9bd70",
        lineWidth: 1.65,
      });
      (view as AladinView & AtlasDrawingView).addOverlay(mdOverlay);
      mdOverlayRef.current = mdOverlay;
      if (isOverview) {
        for (const tone of [
          "positive",
          "negative",
          "zero",
          "unknown",
        ] as const) {
          const layer = atlasDrawingApi.graphicOverlay({
            name: `Atlas group relations: ${tone}`,
            color: TIDAL_TONES[tone],
            lineWidth: 1.35,
          });
          (view as AladinView & AtlasDrawingView).addOverlay(layer);
          mountedGroupOverlays.set(tone, layer);
        }
      }

      let autoPopupPgc: number | null = null;
      let manualPopup = false;
      let markerClickedThisClick = false;
      let pendingUpdate: ReturnType<typeof setTimeout> | null = null;

      function clearAutoPopup(): void {
        if (autoPopupPgc !== null) {
          view.hidePopup();
          autoPopupPgc = null;
        }
      }

      function showReticlePopup(): void {
        if (manualPopup) {
          return;
        }
        if (!reticlePopupAllowed(view.getFov())) {
          clearAutoPopup();
          return;
        }
        const candidate = findReticleTarget(
          objectsRef.current,
          view.getSize(),
          (ra, dec) => view.world2pix(ra, dec),
          autoPopupPgc,
        );
        if (candidate?.pgc === autoPopupPgc) {
          return;
        }
        clearAutoPopup();
        if (
          candidate !== null &&
          candidate.ra !== null &&
          candidate.dec !== null
        ) {
          view.showPopup(
            candidate.ra,
            candidate.dec,
            popupTitle(candidate),
            popupDescription(candidate, referenceObjectsRef.current),
          );
          autoPopupPgc = candidate.pgc;
        }
      }

      function scheduleReticlePopup(): void {
        if (pendingUpdate !== null) {
          clearTimeout(pendingUpdate);
        }
        pendingUpdate = setTimeout(() => {
          pendingUpdate = null;
          showReticlePopup();
        }, 150);
      }

      function onViewChanged(): void {
        refreshGroupEdgesRef.current?.();
        if (manualPopup) {
          manualPopup = false;
          view.hidePopup();
        }
        if (!reticlePopupAllowed(view.getFov())) {
          if (pendingUpdate !== null) {
            clearTimeout(pendingUpdate);
            pendingUpdate = null;
          }
          clearAutoPopup();
          return;
        }
        scheduleReticlePopup();
      }
      function onObjectClicked(source: AladinSource | null): void {
        if (source !== null) {
          markerClickedThisClick = true;
          manualPopup = true;
          const markerPgc = (source.data as { pgc?: unknown } | null)?.pgc;
          setSelectedPgc(
            typeof markerPgc === "number" && Number.isSafeInteger(markerPgc)
              ? markerPgc
              : null,
          );
          autoPopupPgc = null;
          if (pendingUpdate !== null) {
            clearTimeout(pendingUpdate);
            pendingUpdate = null;
          }
        }
      }

      // Aladin emits objectClicked before click for a selected marker.
      // A plain click without a marker closes any manual or reticle popup.
      function onSkyClick(event: { isDragging: boolean }): void {
        const clickedMarker = markerClickedThisClick;
        markerClickedThisClick = false;
        if (!shouldDismissSkyPopup(clickedMarker, event.isDragging)) {
          return;
        }
        if (pendingUpdate !== null) {
          clearTimeout(pendingUpdate);
          pendingUpdate = null;
        }
        manualPopup = false;
        autoPopupPgc = null;
        setSelectedPgc(null);
        view.hidePopup();
      }

      view.on("objectClicked", onObjectClicked);
      view.on("click", onSkyClick);

      if (enableReticlePopups) {
        view.on("positionChanged", onViewChanged);
        view.on("zoomChanged", onViewChanged);
        refreshReticlePopupRef.current = showReticlePopup;
        clearReticlePopupRef.current = clearAutoPopup;
      }

      listeners.detach = () => {
        if (pendingUpdate !== null) {
          clearTimeout(pendingUpdate);
          pendingUpdate = null;
        }

        if (typeof view.off === "function") {
          if (enableReticlePopups) {
            view.off("positionChanged");
            view.off("zoomChanged");
          }
          view.off("objectClicked");
          view.off("click");
        } else {
          // Compatibility fallback for Aladin builds without off().
          if (enableReticlePopups) {
            view.on("positionChanged", () => {});
            view.on("zoomChanged", () => {});
          }
          view.on("objectClicked", () => {});
          view.on("click", () => {});
        }
      };

      viewRef.current = view;
      // Aladin Lite v3 implements getRaDec() at runtime, but its bundled
      // TypeScript AladinView declaration omits that method.
      atlasCameraCallbackRef.current?.(
        typeof (view as AladinView & { getRaDec?: unknown }).getRaDec ===
          "function"
          ? (view as AladinView & AtlasCamera)
          : null,
      );
      catalogRef.current = catalog;
      if (!isOverview) {
        const surveyView = view as AladinView & {
          setImageSurvey: (id: string) => void | Promise<unknown>;
        };
        surveySwitcherRef.current = createGalaxySurveySwitcher(
          initialSurvey,
          (id) => surveyView.setImageSurvey(id),
          (message) => surveyErrorRef.current?.(message),
        );
      }
      setMapError(null);
      setReady(true);
    }

    void mount(container).catch(() => {
      if (!cancelled) {
        setMapError(
          "Sky map could not be initialized. Object details remain available.",
        );
      }
    });

    return () => {
      cancelled = true;
      firstFrameCleanup.detach?.();
      atlasFitCleanup.detach?.();
      detailFitCleanup.detach?.();
      surveySwitcherRef.current?.dispose();
      surveySwitcherRef.current = null;
      overlayControllerRef.current?.dispose();
      overlayControllerRef.current = null;
      listeners.detach?.();
      clearReticlePopupRef.current = null;
      refreshReticlePopupRef.current = null;
      catalogRef.current = null;
      contextCatalogRef.current = null;
      viewRef.current = null;
      atlasCameraCallbackRef.current?.(null);
      mountedFocusRef.current = null;
      mountedFovRef.current = null;
      regionOverlayRef.current = null;
      previewOverlayRef.current = null;
      mdOverlayRef.current = null;
      mountedGroupOverlays.clear();
      refreshGroupEdgesRef.current = null;
      mdCatalogRef.current = null;
      setReady(false);
      container.replaceChildren();
    };
  }, [isOverview, enableReticlePopups]);

  // Live angular ruler: compute from the actual sky transform at the map centre.
  // Do not derive a pixel scale from the requested initial FoV; Aladin can resize
  // or the visitor can pan/zoom after initialization. This is galaxy-only.
  useEffect(() => {
    const view = viewRef.current;
    const element = containerRef.current;
    if (!ready || isOverview || !view || !element) return;
    let raf: number | null = null;
    function update(): void {
      raf = null;
      const compatible = view as AladinView & {
        pix2world: (x: number, y: number) => number[] | null;
      };
      scaleCallbackRef.current?.(getGalaxyAngularScale(compatible));
    }
    function schedule(): void {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }
    view.on("zoomChanged", schedule);
    element.addEventListener("pointerup", schedule);
    element.addEventListener("wheel", schedule, { passive: true });
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    resizeObserver?.observe(element);
    schedule();
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      element.removeEventListener("pointerup", schedule);
      element.removeEventListener("wheel", schedule);
      if (typeof view.off === "function") view.off("zoomChanged");
      scaleCallbackRef.current?.(null);
    };
  }, [ready, isOverview]);

  // Comparison modifies only a named IMAGE layer; geometry and catalogues persist.
  useEffect(() => {
    if (ready && !isOverview) {
      overlayControllerRef.current?.request(
        detailOverlaySurveyId,
        detailOverlayOpacity,
      );
    }
  }, [ready, isOverview, detailOverlaySurveyId, detailOverlayOpacity]);

  // Switching HiPS never remounts Aladin or recalibrates the adopted a26 FoV.
  useEffect(() => {
    if (ready && !isOverview) surveySwitcherRef.current?.request(mapSurvey);
  }, [ready, isOverview, mapSurvey]);

  useEffect(() => {
    referenceObjectsRef.current = referenceObjects ?? objects;
  }, [referenceObjects, objects]);

  useEffect(() => {
    objectsRef.current = objects;
    const catalog = catalogRef.current;
    if (!ready || catalog === null) {
      return;
    }
    clearReticlePopupRef.current?.();
    setCatalogSources(
      catalog,
      objects,
      1,
      isOverview ? OVERVIEW_MARKER_MAX_DIAMETER : 18,
      tidalRange,
      referenceObjects ?? objects,
    );
    refreshReticlePopupRef.current?.();
  }, [objects, ready, isOverview, tidalRange, referenceObjects]);

  useEffect(() => {
    const catalog = contextCatalogRef.current;
    if (!ready || catalog === null) {
      return;
    }
    setCatalogSources(catalog, contextObjects ?? [], 0.72);
  }, [contextObjects, ready]);

  // Update FoV in-place on object-to-object navigation without recreating Aladin.
  useEffect(() => {
    const view = viewRef.current;
    if (
      !ready ||
      view === null ||
      isOverview ||
      !Number.isFinite(mapFov) ||
      mapFov <= 0
    )
      return;
    if (mountedFovRef.current === mapFov) return;
    view.setFoV(mapFov);
    mountedFovRef.current = mapFov;
  }, [ready, mapFov, isOverview]);

  useEffect(() => {
    const view = viewRef.current;
    if (!ready || focus === null || view === null) {
      return;
    }
    const previous = mountedFocusRef.current;
    if (
      previous?.requestId === focus.requestId &&
      previous.ra === focus.ra &&
      previous.dec === focus.dec &&
      previous.fov === focus.fov
    )
      return;
    // New object => restore its adopted a26 field, even when both objects
    // have the same angular diameter and the previous map was user-zoomed.
    mountedFocusRef.current = focus;
    const requested =
      focus.fov !== undefined && Number.isFinite(focus.fov) && focus.fov > 0
        ? focus.fov
        : mapFov;
    if (!isOverview && Number.isFinite(requested) && requested > 0) {
      view.setFoV(requested);
      mountedFovRef.current = requested;
    }
    view.gotoRaDec(focus.ra, focus.dec);
  }, [focus, ready, isOverview, mapFov]);

  /** Same ICRS geometry for live preview and committed selection. */
  function paintCelestialRegion(
    overlay: AtlasGraphicOverlay | null,
    selected: SkyRegion | null,
  ): void {
    if (overlay === null) return;
    overlay.removeAll();
    overlay.reportChange();
    if (!isValidRegion(selected)) return;
    const points = regionBoundary(selected);
    if (points.length < 4) return;
    const closed = [...points, points[0]];
    let segment: [number, number][] = [closed[0]];
    for (let index = 1; index < closed.length; index++) {
      if (Math.abs(closed[index][0] - closed[index - 1][0]) > 180) {
        if (segment.length > 1) overlay.add(atlasDrawingApi.polyline(segment));
        segment = [];
      }
      segment.push(closed[index]);
    }
    if (segment.length > 1) overlay.add(atlasDrawingApi.polyline(segment));
  }

  useEffect(() => {
    if (ready) paintCelestialRegion(regionOverlayRef.current, region);
  }, [region, ready]);

  useEffect(() => {
    if (drawingMode !== null) drawSurfaceRef.current?.focus();
  }, [drawingMode]);

  function skyFromPixel(pixel: {
    x: number;
    y: number;
  }): SkyCoordinates | null {
    const view = viewRef.current;
    if (view === null) return null;
    const coordinates = (() => {
      try {
        return (view as AladinView & AtlasDrawingView).pix2world(
          pixel.x,
          pixel.y,
        );
      } catch {
        return null;
      }
    })();
    if (!coordinates || coordinates.length < 2) return null;
    const [ra, dec] = coordinates;
    if (![ra, dec].every(Number.isFinite) || Math.abs(dec) > 90) return null;
    return { ra: ((ra % 360) + 360) % 360, dec };
  }

  function pointInMap(event: ReactPointerEvent<HTMLDivElement>): {
    sky: SkyCoordinates;
    pixel: { x: number; y: number };
  } | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const pixel = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const sky = skyFromPixel(pixel);
    return sky === null ? null : { sky, pixel };
  }

  function clearDrawingPreview(): void {
    dragStartRef.current = null;
    dragPixelRef.current = null;
    paintCelestialRegion(previewOverlayRef.current, null);
    setDragReadout(null);
  }

  function drawRegionFromPoints(
    start: SkyCoordinates,
    end: SkyCoordinates,
    startPixel: { x: number; y: number },
    endPixel: { x: number; y: number },
  ): SkyRegion | null {
    if (drawingMode === "circle") {
      return {
        kind: "circle",
        center: start,
        radiusDeg: angularSeparationDeg(start.ra, start.dec, end.ra, end.dec),
      };
    }
    if (drawingMode !== "rectangle") return null;
    const middle = skyFromPixel({
      x: (startPixel.x + endPixel.x) / 2,
      y: (startPixel.y + endPixel.y) / 2,
    });
    return middle === null
      ? null
      : rectangleFromScreenCorners(start, end, middle);
  }

  function onDrawStart(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || drawingMode === null) return;
    const start = pointInMap(event);
    if (start === null) {
      setDragReadout("Start inside the sky projection");
      return;
    }
    dragStartRef.current = start.sky;
    dragPixelRef.current = start.pixel;
    setDragReadout("Drag to define the sky region");
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onDrawMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = dragStartRef.current;
    const startPixel = dragPixelRef.current;
    if (start === null || startPixel === null) return;
    const end = pointInMap(event);
    if (
      end === null ||
      Math.hypot(end.pixel.x - startPixel.x, end.pixel.y - startPixel.y) < 5
    ) {
      paintCelestialRegion(previewOverlayRef.current, null);
      return;
    }
    const selected = drawRegionFromPoints(
      start,
      end.sky,
      startPixel,
      end.pixel,
    );
    if (!isValidRegion(selected)) {
      paintCelestialRegion(previewOverlayRef.current, null);
      setDragReadout("Invalid sky region; zoom in and retry");
      return;
    }
    paintCelestialRegion(previewOverlayRef.current, selected);
    setDragReadout(
      selected.kind === "circle"
        ? selected.radiusDeg >= 1
          ? `Radius: ${selected.radiusDeg.toFixed(2)}°`
          : `Radius: ${(selected.radiusDeg * 60).toFixed(1)}′`
        : `ICRS rectangle · ${selected.decMin.toFixed(1)}° … ${selected.decMax.toFixed(1)}°`,
    );
  }

  function onDrawFinish(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = dragStartRef.current;
    const startPixel = dragPixelRef.current;
    const end = pointInMap(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    clearDrawingPreview();
    if (
      start === null ||
      startPixel === null ||
      end === null ||
      drawingMode === null
    )
      return;
    if (
      Math.hypot(end.pixel.x - startPixel.x, end.pixel.y - startPixel.y) < 5
    ) {
      setDragReadout("Drag at least 5 pixels; zoom in for precise regions");
      return;
    }
    const selected = drawRegionFromPoints(
      start,
      end.sky,
      startPixel,
      end.pixel,
    );
    if (isValidRegion(selected)) onRegionDraw?.(selected);
    else
      setDragReadout(
        "Selection crosses an undefined sky projection region; try again",
      );
  }

  function onDrawingKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      clearDrawingPreview();
      onCancelDraw?.();
    }
  }

  // Stage 04a: explicit catalogue group context, independent of Atlas filters.
  const atlasSelected = useMemo(() => {
    const reference = referenceObjects ?? objects;
    return reference.find((object) => object.pgc === selectedPgc) ?? null;
  }, [referenceObjects, objects, selectedPgc]);
  const atlasContext = useAtlasGroupContext(
    isOverview ? (atlasSelected?.pgc ?? null) : null,
  );
  const atlasGraph = useMemo(
    () =>
      atlasContext.detail === null
        ? null
        : buildAtlasGroupGraph(
            atlasContext.detail,
            referenceObjects ?? objects,
          ),
    [atlasContext.detail, referenceObjects, objects],
  );
  const visiblePgcs = useMemo(
    () => new Set(objects.map((row) => row.pgc)),
    [objects],
  );
  const atlasOutsideCount =
    atlasGraph?.points.filter((row) => !visiblePgcs.has(row.pgc)).length ?? 0;
  const atlasMd = useMemo(() => {
    const mdPgc = atlasSelected?.md_pgc;
    return typeof mdPgc === "number" &&
      Number.isSafeInteger(mdPgc) &&
      mdPgc > 0 &&
      mdPgc !== atlasSelected?.pgc
      ? ((referenceObjects ?? objects).find((row) => row.pgc === mdPgc) ?? null)
      : null;
  }, [atlasSelected, referenceObjects, objects]);

  useEffect(() => {
    const overlay = mdOverlayRef.current;
    const view = viewRef.current;
    const contextual = mdCatalogRef.current;
    if (!ready || overlay === null || view === null) return;
    const mountedView = view;
    const mdLayer = overlay;
    const groupOverlays = atlasGroupOverlaysRef.current;
    const reference = referenceObjects ?? objects;
    const useMd =
      !isOverview ||
      atlasContext.status === "none" ||
      atlasContext.status === "error";
    const mdVertices =
      useMd && hasSkyPosition(atlasSelected) && hasSkyPosition(atlasMd)
        ? greatCircleVertices(atlasSelected, atlasMd)
        : [];
    let frame: number | null = null;
    function paint(): void {
      mdLayer.removeAll();
      for (const layer of groupOverlays.values()) layer.removeAll();
      const width = mountedView.getSize()[0];
      function project(ra: number, dec: number) {
        return mountedView.world2pix(ra, dec);
      }
      for (const segment of visibleGreatCircleSegments(
        mdVertices,
        project,
        width,
      ))
        mdLayer.add(atlasDrawingApi.polyline(segment));
      for (const arc of atlasGraph?.arcs ?? []) {
        const layer = groupOverlays.get(arc.edge.tone);
        if (layer === undefined) continue;
        for (const segment of visibleGreatCircleSegments(
          arc.vertices,
          project,
          width,
        ))
          layer.add(atlasDrawingApi.polyline(segment));
      }
      mdLayer.reportChange();
      for (const layer of groupOverlays.values()) layer.reportChange();
    }
    function schedule(): void {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        paint();
      });
    }
    refreshGroupEdgesRef.current = schedule;
    paint();
    if (contextual !== null) {
      const extra = new Map<number, CatalogObject>();
      for (const row of atlasGraph?.points ?? []) {
        if (!visiblePgcs.has(row.pgc)) extra.set(row.pgc, row);
      }
      if (
        useMd &&
        atlasMd !== null &&
        hasSkyPosition(atlasMd) &&
        !visiblePgcs.has(atlasMd.pgc)
      )
        extra.set(atlasMd.pgc, atlasMd);
      if (
        atlasSelected !== null &&
        hasSkyPosition(atlasSelected) &&
        !visiblePgcs.has(atlasSelected.pgc)
      )
        extra.set(atlasSelected.pgc, atlasSelected);
      setCatalogSources(
        contextual,
        [...extra.values()],
        1,
        OVERVIEW_MARKER_MAX_DIAMETER,
        tidalRange,
        reference,
      );
    }
    return () => {
      refreshGroupEdgesRef.current = null;
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [
    atlasSelected,
    atlasMd,
    atlasContext.status,
    atlasGraph,
    visiblePgcs,
    objects,
    referenceObjects,
    ready,
    tidalRange,
    isOverview,
  ]);

  return (
    <>
      <div
        ref={containerRef}
        onClickCapture={onPopupLinkClick}
        onDoubleClickCapture={onMarkerDoubleClick}
        className={
          isOverview ? "aladin-frame aladin-frame--overview" : "aladin-frame"
        }
      />
      {isOverview && drawingMode === null && atlasSelected !== null ? (
        <AtlasGroupContext
          context={atlasContext}
          selected={atlasSelected}
          graph={atlasGraph}
          outsideCount={atlasOutsideCount}
          hasMd={hasSkyPosition(atlasMd)}
        />
      ) : null}
      {isOverview && drawingMode !== null ? (
        <div
          ref={drawSurfaceRef}
          className="atlas-draw-surface"
          role="group"
          tabIndex={0}
          aria-label={`Draw ${drawingMode} sky region: press Escape to cancel`}
          onPointerDown={onDrawStart}
          onPointerMove={onDrawMove}
          onPointerUp={onDrawFinish}
          onPointerCancel={clearDrawingPreview}
          onKeyDown={onDrawingKeyDown}
        >
          <span className="atlas-draw-instruction">
            Drag over the sky to select in ICRS · Esc cancels
          </span>
          {dragReadout !== null ? (
            <span className="atlas-draw-hint">{dragReadout}</span>
          ) : null}
          <button
            type="button"
            className="atlas-draw-cancel"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              clearDrawingPreview();
              onCancelDraw?.();
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {mapError !== null ? (
        <p className="catalog-status catalog-status-error" role="alert">
          {mapError}
        </p>
      ) : null}
    </>
  );
}
