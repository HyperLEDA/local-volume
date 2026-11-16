import A, {
  type AladinCatalog,
  type AladinSource,
  type AladinView,
} from "aladin-lite";
import {
  useEffect,
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
import type { CatalogObject } from "../api/objects.ts";
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
import { needsInitialFovCorrection } from "../lib/objectFov.ts";
import { shouldDismissSkyPopup } from "../lib/mapInteraction.ts";
import { morphologyColor } from "../lib/morphologyColors.ts";
import {
  drawOverviewMarker,
  drawSelectedObjectMarker,
  OVERVIEW_MARKER_MAX_DIAMETER,
} from "../lib/overviewMarkers.ts";
import { formatJ2000Coordinate } from "../lib/popupCoordinates.ts";

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

// AIT full-sky disk occupies ~98% of the viewport; edges never clip.
// Values below 1 zoom in and crop the 360° × 180° all-sky ellipse.
const ALL_SKY_AIT_FIT_ZOOM_FACTOR = 1.02;

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
  enableReticlePopups?: boolean;
  region?: SkyRegion | null;
  drawingMode?: "circle" | "rectangle" | null;
  tidalRange?: AtlasRange | null;
  onRegionDraw?: (region: SkyRegion) => void;
  onCancelDraw?: () => void;
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

function popupTitle(object: CatalogObject): string {
  const nature = escapeHtml(object.type_name ?? "—");
  const name = escapeHtml(object.name);
  const position = formatJ2000Coordinate(object.ra, object.dec);
  const coordinate = position
    ? `<span class="lv-popup-jcoord" title="ICRS, J2000">${position}</span>`
    : "";
  return `<div class="lv-popup-header"><div class="lv-popup-heading"><a class="lv-popup-name" href="/object/${object.pgc}">${name}</a>${coordinate}</div><span class="lv-popup-nature">${nature}</span></div>`;
}

function popupDescription(
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

function setCatalogSources(
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
        pgc: object.pgc,
        theta1: object.theta1 ?? null,
        tidal_min: tidalRange?.min ?? null,
        tidal_max: tidalRange?.max ?? null,
      },
    );
    marker.setSize(
      Math.max(
        4,
        Math.round(
          markerDiameter(object.b_mag ?? null, maxDiameter) * sizeScale,
        ),
      ),
    );
    return [marker];
  });
  if (sources.length === 0) {
    return;
  }
  catalog.addSources(sources);
}

export function AladinMap({
  objects,
  contextObjects,
  referenceObjects,
  focus,
  fov = 180,
  enableReticlePopups = false,
  tidalRange = null,
  region = null,
  drawingMode = null,
  onRegionDraw,
  onCancelDraw,
}: AladinMapProps) {
  const isOverview = fov >= 180;
  const mapFov = isOverview ? 360 : fov;
  const containerRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<AladinCatalog | null>(null);
  const contextCatalogRef = useRef<AladinCatalog | null>(null);
  const viewRef = useRef<AladinView | null>(null);
  // Async Aladin initialization and first-resize calibration must use the latest FoV.
  const latestFovRef = useRef(mapFov);
  useEffect(() => {
    latestFovRef.current = mapFov;
  }, [mapFov]);
  const objectsRef = useRef(objects);
  const referenceObjectsRef = useRef(referenceObjects ?? objects);
  const mdOverlayRef = useRef<AtlasGraphicOverlay | null>(null);
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
    void navigate(destination);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let cancelled = false;
    const listeners = { detach: null as (() => void) | null };
    const initialFovCleanup = { detach: null as (() => void) | null };
    const overviewFitCleanup = { detach: null as (() => void) | null };

    async function mount(element: HTMLDivElement): Promise<void> {
      await A.init;
      if (cancelled) {
        return;
      }
      const view = A.aladin(element, {
        fov: latestFovRef.current,
        projection: isOverview ? "AIT" : "SIN",
        cooFrame: "equatorial",
        survey: DEFAULT_HIPS_SURVEY,
        target: "180 +0",
        showReticle: true,
        showSimbadPointerControl: false,
        showFullscreenControl: false,
      });
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
      function installOverviewFit(): void {
        if (typeof ResizeObserver === "undefined") return;

        let userInteracted = false;
        let fitTimer: ReturnType<typeof setTimeout> | null = null;
        let lastSize = "";
        const observer = new ResizeObserver(() => {
          if (cancelled || userInteracted) return;
          const rect = element.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return;
          const size = Math.round(rect.width) + "x" + Math.round(rect.height);
          if (size === lastSize) return;
          lastSize = size;
          if (fitTimer !== null) clearTimeout(fitTimer);
          fitTimer = setTimeout(() => {
            fitTimer = null;
            if (!cancelled && !userInteracted) {
              view.setZoomFactor(ALL_SKY_AIT_FIT_ZOOM_FACTOR);
            }
          }, 180);
        });
        function stopAutomaticFit(): void {
          userInteracted = true;
          if (fitTimer !== null) {
            clearTimeout(fitTimer);
            fitTimer = null;
          }
          observer.disconnect();
          element.removeEventListener("pointerdown", stopAutomaticFit);
          element.removeEventListener("wheel", stopAutomaticFit);
          element.removeEventListener("touchstart", stopAutomaticFit);
        }
        element.addEventListener("pointerdown", stopAutomaticFit);
        element.addEventListener("wheel", stopAutomaticFit, {
          passive: true,
        });
        element.addEventListener("touchstart", stopAutomaticFit, {
          passive: true,
        });
        observer.observe(element);
        overviewFitCleanup.detach = stopAutomaticFit;
      }

      view.setFoV(latestFovRef.current);
      if (isOverview) {
        view.setZoomFactor(ALL_SKY_AIT_FIT_ZOOM_FACTOR);

        // Aladin Lite rescales its internal zoom factor whenever its canvas
        // width changes. Restore the all-sky fit AFTER that resize, without
        // resetting the user's own zoom/pan interactions.
        installOverviewFit();
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
          name: "Selected galaxy Main Disturber",
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

      // Aladin can rescale the initial FoV while the square map is settling.
      // Correct it only once after layout, never after a user zooms or drags.
      let calibrationTimer: ReturnType<typeof setTimeout> | null = null;
      let calibrationObserver: ResizeObserver | null = null;
      let userInteracted = false;

      function endInitialFovCalibration(event?: Event): void {
        if (event !== undefined) {
          userInteracted = true;
        }
        if (calibrationTimer !== null) {
          clearTimeout(calibrationTimer);
          calibrationTimer = null;
        }
        calibrationObserver?.disconnect();
        element.removeEventListener("pointerdown", endInitialFovCalibration);
        element.removeEventListener("wheel", endInitialFovCalibration);
      }

      if (!isOverview && typeof ResizeObserver !== "undefined") {
        calibrationObserver = new ResizeObserver(() => {
          if (cancelled || userInteracted) {
            return;
          }
          if (calibrationTimer !== null) {
            clearTimeout(calibrationTimer);
          }
          calibrationTimer = setTimeout(() => {
            calibrationTimer = null;
            if (!cancelled && !userInteracted) {
              const actualFov = view.getFov()[0];
              if (needsInitialFovCorrection(actualFov, latestFovRef.current)) {
                view.setFoV(latestFovRef.current);
              }
            }
            endInitialFovCalibration();
          }, 250);
        });
        element.addEventListener("pointerdown", endInitialFovCalibration);
        element.addEventListener("wheel", endInitialFovCalibration, {
          passive: true,
        });
        calibrationObserver.observe(element);
        initialFovCleanup.detach = endInitialFovCalibration;
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
      catalogRef.current = catalog;
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
      initialFovCleanup.detach?.();
      overviewFitCleanup.detach?.();
      listeners.detach?.();
      clearReticlePopupRef.current = null;
      refreshReticlePopupRef.current = null;
      catalogRef.current = null;
      contextCatalogRef.current = null;
      viewRef.current = null;
      regionOverlayRef.current = null;
      previewOverlayRef.current = null;
      mdOverlayRef.current = null;
      mdCatalogRef.current = null;
      setReady(false);
      container.replaceChildren();
    };
  }, [isOverview, enableReticlePopups]);

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
    view.setFoV(mapFov);
  }, [ready, mapFov, isOverview]);

  useEffect(() => {
    const view = viewRef.current;
    if (!ready || focus === null || view === null) {
      return;
    }
    if (
      focus.fov !== undefined &&
      Number.isFinite(focus.fov) &&
      focus.fov > 0
    ) {
      view.setFoV(focus.fov);
    }
    view.gotoRaDec(focus.ra, focus.dec);
  }, [focus, ready]);

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

  // Draw only the currently clicked galaxy's MD connection (no implied group membership).
  useEffect(() => {
    const overlay = mdOverlayRef.current;
    const view = viewRef.current;
    const contextual = mdCatalogRef.current;
    if (!ready || overlay === null || view === null) return;
    overlay.removeAll();
    const selected =
      objects.find((object) => object.pgc === selectedPgc) ?? null;
    const reference = referenceObjects ?? objects;
    const md =
      selected &&
      typeof selected.md_pgc === "number" &&
      Number.isSafeInteger(selected.md_pgc) &&
      selected.md_pgc > 0
        ? (reference.find((object) => object.pgc === selected.md_pgc) ?? null)
        : null;
    if (
      hasSkyPosition(selected) &&
      hasSkyPosition(md) &&
      selected.pgc !== md.pgc
    ) {
      const vertices = greatCircleVertices(selected, md);
      const width = view.getSize()[0];
      const segments = visibleGreatCircleSegments(
        vertices,
        (ra, dec) => view.world2pix(ra, dec),
        width,
      );
      for (const segment of segments)
        overlay.add(atlasDrawingApi.polyline(segment));
    }
    overlay.reportChange();
    // The physical MD may be excluded by active filters; show its position explicitly.
    if (contextual !== null) {
      setCatalogSources(
        contextual,
        md !== null &&
          hasSkyPosition(md) &&
          !objects.some((row) => row.pgc === md.pgc)
          ? [md]
          : [],
        1,
        14,
        tidalRange,
        reference,
      );
    }
  }, [selectedPgc, objects, referenceObjects, ready, tidalRange]);

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
