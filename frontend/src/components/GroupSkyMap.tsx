import A, {
  type AladinCatalog,
  type AladinSource,
  type AladinView,
} from "aladin-lite";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import type { GroupDetail, GroupMember } from "../api/groups.ts";
import { fetchObjects, type CatalogObject } from "../api/objects.ts";
import { atlasBounds, type AtlasRange } from "../lib/atlasBounds.ts";
import { popupObjectRoute } from "../lib/popupNavigation.ts";
import { groupPopupRoute } from "../lib/groupBrowsing.ts";
import { greatCircleVertices } from "../lib/mdConnection.ts";
import { trimGroupEdge } from "../lib/groupEdgeTrim.ts";
import {
  groupTidalEdges,
  TIDAL_TONES,
  type TidalTone,
} from "../lib/groupTidalEdges.ts";
import { GroupTidalUI } from "./GroupTidalUI.tsx";
import {
  buildCelestialSubgroups,
  type CelestialSubgroup,
} from "../lib/groupCelestialSubgroups.ts";
import { markerDiameter } from "../lib/reticle.ts";
import { morphologyColor } from "../lib/morphologyColors.ts";
import {
  drawOverviewMarker,
  OVERVIEW_MARKER_MAX_DIAMETER,
} from "../lib/overviewMarkers.ts";
import {
  popupDescription,
  popupTitle,
  setCatalogSources,
} from "./AladinMap.tsx";
import {
  hasSkySignal,
  hasWebpSignature,
} from "../lib/groupPreviewImageQuality.ts";

type PositionedMember = GroupMember & { ra: number; dec: number };
type SubgroupPresentation = {
  enabled: boolean;
  filter: number | "all";
  emphasized: number | null;
};

type GroupGraphicOverlay = {
  add: (shape: object) => void;
  removeAll: () => void;
  reportChange: () => void;
};
type CaptureView = GroupDrawingView & {
  pix2world: (x: number, y: number) => number[] | null;
  // Aladin can render a specifically sized screenshot, avoiding the arbitrary
  // dimensions of getViewData() when the preview generator is embedded.
  getViewDataURL: (options: {
    format: "image/png";
    width: number;
    height: number;
    logo: boolean;
  }) => Promise<string>;
  getSize: () => [number, number];
};

/** Do not ever stretch a nonsquare sky screenshot into a square galaxy thumbnail. */
async function captureSquareWebp(view: CaptureView): Promise<Blob> {
  const [viewWidth, viewHeight] = view.getSize();
  if (
    !Number.isFinite(viewWidth) ||
    !Number.isFinite(viewHeight) ||
    viewWidth < 100 ||
    viewHeight < 100 ||
    Math.abs(viewWidth - viewHeight) > Math.max(2, viewWidth * 0.015)
  ) {
    throw new Error(
      `Aladin preview must have a square viewport; got ${viewWidth}x${viewHeight}`,
    );
  }
  // The documented Aladin API accepts explicit screenshot dimensions here,
  // unlike getViewData('blob'), which uses the underlying view dimensions.
  const url = await view.getViewDataURL({
    format: "image/png",
    width: 512,
    height: 512,
    logo: false,
  });
  if (!url.startsWith("data:image/png")) {
    throw new Error("Aladin did not return a PNG screenshot");
  }
  const png = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(png);
  try {
    if (Math.abs(bitmap.width - bitmap.height) > 2 || bitmap.width < 256) {
      throw new Error(
        `Aladin exported a non-square image: ${bitmap.width}x${bitmap.height}`,
      );
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D is unavailable");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, 512, 512);
    if (!hasSkySignal(context.getImageData(0, 0, 512, 512).data, 512, 512)) {
      throw new Error(
        "DSS2 image is not yet visible in the captured sky field",
      );
    }
    const webp = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("WebP encoding failed")),
        "image/webp",
        0.92,
      );
    });
    // File size reflects image compressibility; it is NOT evidence of validity.
    // Verify actual WebP container bytes instead of rejecting small astronomy images.
    const signature = new Uint8Array(await webp.slice(0, 12).arrayBuffer());
    if (webp.type !== "image/webp" || !hasWebpSignature(signature)) {
      throw new Error(
        `WebP encoding failed (type=${webp.type || "unknown"}, bytes=${webp.size})`,
      );
    }
    return webp;
  } finally {
    bitmap.close();
  }
}
type GroupDrawingApi = {
  graphicOverlay: (options: {
    name: string;
    color: string;
    lineWidth: number;
    lineDash?: number[];
  }) => GroupGraphicOverlay;
  polyline: (vertices: [number, number][]) => object;
  polygon: (
    vertices: [number, number][],
    options?: {
      fill?: boolean;
      fillColor?: string;
      opacity?: number;
      color?: string;
      lineWidth?: number;
      hoverColor?: string;
      selectionColor?: string;
      selectionLineWidth?: number;
    },
  ) => object;
};
type GroupDrawingView = AladinView & {
  addOverlay: (overlay: GroupGraphicOverlay) => void;
  remove?: () => void;
};

const drawingApi = A as typeof A & GroupDrawingApi;
const SURVEY = "https://skies.esac.esa.int/DSSColor";
const DEG = Math.PI / 180;

type AtlasCatalogSnapshot = {
  objects: CatalogObject[];
  byPgc: Map<number, CatalogObject>;
  tidalRange: AtlasRange | null;
};

// The Atlas already exposes all catalogue parameters. Load that same snapshot
// once for all group maps, rather than inventing a second popup data model.
let catalogPromise: Promise<AtlasCatalogSnapshot> | null = null;
function fetchAtlasSnapshot(): Promise<AtlasCatalogSnapshot> {
  if (catalogPromise === null) {
    catalogPromise = fetchObjects()
      .then((objects) => ({
        objects,
        byPgc: new Map(objects.map((object) => [object.pgc, object])),
        tidalRange: atlasBounds(objects).tidal,
      }))
      .catch((error: unknown) => {
        catalogPromise = null;
        throw error;
      });
  }
  return catalogPromise;
}

function isPositioned(member: GroupMember): member is PositionedMember {
  return (
    typeof member.ra === "number" &&
    Number.isFinite(member.ra) &&
    typeof member.dec === "number" &&
    Number.isFinite(member.dec) &&
    member.dec >= -90 &&
    member.dec <= 90
  );
}

// SIN is orthographic: use the actual two-dimensional projected envelope,
// not a radius multiplied by an arbitrary angular factor.
export function groupFullExtentFov(
  members: readonly PositionedMember[],
  root: PositionedMember,
): number {
  const dec0 = root.dec * DEG;
  let maxOffset = 0;
  for (const member of members) {
    const dec = member.dec * DEG;
    const deltaRa = (member.ra - root.ra) * DEG;
    const visible =
      Math.sin(dec0) * Math.sin(dec) +
      Math.cos(dec0) * Math.cos(dec) * Math.cos(deltaRa);
    if (visible <= 0) return 178; // A single SIN hemisphere cannot show an antipodal member.
    const x = Math.cos(dec) * Math.sin(deltaRa);
    const y =
      Math.cos(dec0) * Math.sin(dec) -
      Math.sin(dec0) * Math.cos(dec) * Math.cos(deltaRa);
    maxOffset = Math.max(maxOffset, Math.abs(x), Math.abs(y));
  }
  // Fill approximately 91% of the half-width, keeping a small margin for markers.
  return Math.max(
    0.15,
    Math.min(178, (2 * Math.asin(Math.min(1, maxOffset / 0.91))) / DEG),
  );
}

function allMembersFit(
  view: AladinView,
  members: readonly PositionedMember[],
  width: number,
  height: number,
  padding: number,
): { factor: number; missing: number } {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const allowedWidth = Math.max(1, halfWidth - padding);
  const allowedHeight = Math.max(1, halfHeight - padding);
  let factor = 1;
  let missing = 0;
  for (const member of members) {
    const pixel = view.world2pix(member.ra, member.dec);
    if (!pixel || !Number.isFinite(pixel[0]) || !Number.isFinite(pixel[1])) {
      missing++;
      continue;
    }
    factor = Math.max(
      factor,
      Math.abs(pixel[0] - halfWidth) / allowedWidth,
      Math.abs(pixel[1] - halfHeight) / allowedHeight,
    );
  }
  return { factor, missing };
}

export function GroupSkyMap({
  group,
  onMemberNavigate,
  miniature = false,
  previewVariant = "hierarchy",
  portraitFov = 1,
  onSnapshot,
  onSnapshotError,
}: {
  group: GroupDetail;
  onMemberNavigate?: (pgc: number) => string | null;
  miniature?: boolean;
  previewVariant?: "hierarchy" | "portrait";
  portraitFov?: number;
  onSnapshot?: (blob: Blob) => void;
  onSnapshotError?: (reason: string) => void;
}) {
  const skyRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CaptureView | null>(null);
  const catalogueRef = useRef<AtlasCatalogSnapshot | null>(null);
  const navigate = useNavigate();
  const [mapError, setMapError] = useState<string | null>(null);
  // Stage 03d: native celestial subgroup contours — no frame-dependent rasterizer.
  const nativeSubgroupController = useRef<
    ((state: SubgroupPresentation) => void) | null
  >(null);
  const nativeSubgroupState = useRef<SubgroupPresentation>({
    enabled: true,
    filter: "all",
    emphasized: null,
  });
  const presentNativeSubgroups = useCallback(
    (state: SubgroupPresentation): void => {
      nativeSubgroupState.current = state;
      nativeSubgroupController.current?.(state);
    },
    [],
  );

  const [mapRevision, setMapRevision] = useState(0);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  function onPopupClick(event: MouseEvent<HTMLDivElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const locate = target.closest("button.lv-popup-md-locate");
    if (locate instanceof HTMLButtonElement) {
      const pgc = Number(locate.dataset.mdPgc);
      const md = catalogueRef.current?.byPgc.get(pgc);
      const map = viewRef.current;
      if (
        md &&
        typeof md.ra === "number" &&
        typeof md.dec === "number" &&
        map
      ) {
        event.preventDefault();
        event.stopPropagation();
        map.gotoRaDec(md.ra, md.dec);
        map.showPopup(
          md.ra,
          md.dec,
          popupTitle(md),
          popupDescription(md, catalogueRef.current?.objects ?? []),
        );
      }
      return;
    }
    const anchor = target.closest("a.lv-popup-name, a.lv-popup-md-link");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const route = popupObjectRoute(
      anchor.getAttribute("href"),
      {
        button: event.button,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      },
      anchor.getAttribute("target") ?? "",
    );
    if (route === null) return;
    const destination = groupPopupRoute(route, group.members, onMemberNavigate);
    event.preventDefault();
    event.stopPropagation();
    void navigate(destination);
  }

  useEffect(() => {
    const sky = skyRef.current;
    if (!sky) return;
    const element: HTMLDivElement = sky;
    setMapError(null);
    const root = group.members.find((member) => member.pgc === group.root_pgc);
    if (!root || !isPositioned(root)) return;

    const portrait = miniature && previewVariant === "portrait";
    const members = group.members.filter(isPositioned);
    const byPgc = new Map(members.map((member) => [member.pgc, member]));
    // Identical adopted angular framing to the individual object's map.
    const initialFov = portrait
      ? Number.isFinite(portraitFov) && portraitFov > 0
        ? portraitFov
        : 1
      : groupFullExtentFov(members, root);
    const rootRa = root.ra;
    const rootDec = root.dec;
    let cancelled = false;
    const captureAbort = new AbortController();
    function isCaptureAborted(): boolean {
      return captureAbort.signal.aborted;
    }
    let userInteracted = false;
    let view: CaptureView | null = null;
    let snapshotRequested = false;
    let observer: ResizeObserver | null = null;
    let unregisterEdgeUpdate: (() => void) | null = null;
    let interactionFrame: number | null = null;
    let lastProjectionSignature:
      [number, number, number, number, number] | null = null;
    function scheduleInteractionUpdate(): void {
      if (cancelled || miniature || interactionFrame !== null) return;
      interactionFrame = window.requestAnimationFrame(() => {
        interactionFrame = null;
        if (!cancelled) {
          const w = element.clientWidth;
          const h = element.clientHeight;
          const center = viewRef.current?.world2pix(rootRa, rootDec);
          const fov = viewRef.current?.getFov()[0] ?? Number.NaN;
          const signature: [number, number, number, number, number] = [
            w,
            h,
            center?.[0] ?? Number.NaN,
            center?.[1] ?? Number.NaN,
            fov,
          ];
          const previous = lastProjectionSignature;
          if (
            previous &&
            previous[0] === w &&
            previous[1] === h &&
            Math.abs(signature[2] - previous[2]) < 0.25 &&
            Math.abs(signature[3] - previous[3]) < 0.25 &&
            Math.abs(fov - previous[4]) <
              Math.max(0.00001, Math.abs(fov) * 0.00015)
          )
            return;
          lastProjectionSignature = signature;
          setMapSize((old) =>
            old.width === w && old.height === h ? old : { width: w, height: h },
          );
          setMapRevision((value) => value + 1);
        }
      });
    }
    const timers: number[] = [];

    // Fit to what Aladin actually renders, after its first responsive resize.
    // On the interactive map this ceases as soon as the user starts navigating.
    function fitToMembers(): void {
      if (cancelled || userInteracted || !view || portrait) return;
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width < 80 || height < 80) return;
      const padding = miniature ? 17 : 18;
      const { factor, missing } = allMembersFit(
        view,
        members,
        width,
        height,
        padding,
      );
      if (factor <= 1.015 && missing === 0) return;
      const currentFov = view.getFov()[0];
      if (!Number.isFinite(currentFov) || currentFov <= 0) return;
      const expansion = missing ? 1.5 : Math.max(1.025, factor * 1.03);
      const nextFov = Math.min(178, currentFov * expansion);
      if (nextFov > currentFov + 0.01) view.setFoV(nextFov);
    }

    function markInteraction(): void {
      if (!miniature) userInteracted = true;
    }

    async function initialize(): Promise<void> {
      await A.init;
      const atlas = portrait ? null : await fetchAtlasSnapshot();
      if (cancelled) return;
      if (atlas !== null) {
        const missing = members.filter(
          (member) => !atlas.byPgc.has(member.pgc),
        );
        if (missing.length > 0) {
          throw new Error(
            `The current Atlas lacks ${missing.length} group object(s): ${missing.map((member) => member.pgc).join(", ")}`,
          );
        }
        catalogueRef.current = atlas;
      }
      const visibleObjects =
        atlas === null
          ? []
          : members.map((member) => atlas.byPgc.get(member.pgc)!);

      const createdView = A.aladin(element, {
        survey: SURVEY,
        cooFrame: "equatorial",
        target: `${rootRa} ${rootDec}`,
        fov: initialFov,
        projection: "SIN",
        showReticle: false,
        showSimbadPointerControl: false,
        showFullscreenControl: false,
        showZoomControl: !miniature,
        showLayersControl: !miniature,
        showGotoControl: !miniature,
        showProjectionControl: !miniature,
        showFrame: !miniature,
        showFov: !miniature,
        showCooLocation: !miniature,
        showStatusBar: !miniature,
        showCooGrid: false,
        showCooGridControl: false,
        showContextMenu: false,
        showShareControl: false,
        showSettingsControl: false,
      } as Parameters<typeof A.aladin>[1]);
      view = createdView as CaptureView;
      viewRef.current = view;

      // Build sky polygons once from SOURCE membership. Aladin owns their
      // projection, panning and zooming; React must not rebuild their outlines.
      const celestial = miniature ? [] : buildCelestialSubgroups(group);
      if (celestial.length > 0) {
        // Stage 03e: opacity-isolated native celestial contours.
        // The translucent fill never changes shared Canvas globalAlpha.
        const subgroupFill = drawingApi.graphicOverlay({
          name: "Subgroup translucent hover fill",
          color: "#87d6d1",
          lineWidth: 0.1,
        });
        const outlines = drawingApi.graphicOverlay({
          name: "Source-defined MD subgroup boundaries",
          color: "#a8dce2",
          lineWidth: 1.6,
          lineDash: [5, 5],
        });
        const highlights = drawingApi.graphicOverlay({
          name: "Hovered MD subgroup stroke",
          color: "#d2fff0",
          lineWidth: 1.9,
        });
        view.addOverlay(subgroupFill);
        view.addOverlay(outlines);
        view.addOverlay(highlights);
        let lastFilter = "";
        let lastEmphasis: number | null = null;
        const nativeByPgc = new Map<number, CelestialSubgroup>(
          celestial.map((subgroup) => [subgroup.pgc, subgroup]),
        );
        const presentation = {
          apply(state: SubgroupPresentation): void {
            const filter = state.enabled ? String(state.filter) : "off";
            if (lastFilter !== filter) {
              lastFilter = filter;
              outlines.removeAll();
              for (const subgroup of celestial) {
                if (
                  !state.enabled ||
                  (state.filter !== "all" && subgroup.pgc !== state.filter)
                )
                  continue;
                for (const vertices of subgroup.polygons) {
                  outlines.add(
                    drawingApi.polygon(
                      vertices.map(([ra, dec]): [number, number] => [ra, dec]),
                      {
                        fill: false,
                        color: "#a8dce2",
                        opacity: 1,
                        lineWidth: 1.6,
                        hoverColor: "#a8dce2",
                        selectionColor: "#a8dce2",
                        selectionLineWidth: 1.6,
                      },
                    ),
                  );
                }
              }
              outlines.reportChange();
              subgroupFill.removeAll();
              subgroupFill.reportChange();
              highlights.removeAll();
              highlights.reportChange();
              lastEmphasis = null;
            }
            const desired =
              state.enabled &&
              (state.filter === "all" || state.filter === state.emphasized)
                ? state.emphasized
                : null;
            if (lastEmphasis === desired) return;
            lastEmphasis = desired;
            subgroupFill.removeAll();
            highlights.removeAll();
            const selected =
              desired === null ? undefined : nativeByPgc.get(desired);
            if (selected) {
              // Never fill projected holes: they may contain non-member galaxies.
              const hasHoles = selected.polygons.length > 1;
              for (const vertices of selected.polygons) {
                if (!hasHoles) {
                  // Alpha belongs to fillColor, not to the shared drawing state.
                  subgroupFill.add(
                    drawingApi.polygon(
                      vertices.map(([ra, dec]): [number, number] => [ra, dec]),
                      {
                        fill: true,
                        color: "#87d6d1",
                        fillColor: "rgba(135, 214, 209, 0.13)",
                        opacity: 1,
                        lineWidth: 0.1,
                      },
                    ),
                  );
                }
                // An independent opaque stroke remains visible throughout hover.
                highlights.add(
                  drawingApi.polygon(
                    vertices.map(([ra, dec]): [number, number] => [ra, dec]),
                    {
                      fill: false,
                      color: "#d2fff0",
                      opacity: 1,
                      lineWidth: 1.9,
                      hoverColor: "#d2fff0",
                      selectionColor: "#d2fff0",
                      selectionLineWidth: 1.9,
                    },
                  ),
                );
              }
            }
            subgroupFill.reportChange();
            highlights.reportChange();
          },
        };
        nativeSubgroupController.current = presentation.apply;
        presentation.apply(nativeSubgroupState.current);
      }

      // The overlay is attached before adding links; its drawing remains
      // attached to the native Aladin zoom/pan transforms.
      const lines = new Map<TidalTone, GroupGraphicOverlay>();
      let markerRadius = new Map<number, number>();
      const mapView = createdView as CaptureView;
      const scienceEdges = groupTidalEdges(members);
      function updateGroupEdges(): void {
        if (cancelled || lines.size === 0) return;
        for (const overlay of lines.values()) overlay.removeAll();
        for (const edge of scienceEdges) {
          const parent = byPgc.get(edge.parentPgc);
          const member = byPgc.get(edge.memberPgc);
          if (!parent || !member) continue;
          const arc = greatCircleVertices(parent, member);
          const clipped = trimGroupEdge(
            arc,
            markerRadius.get(parent.pgc) ?? 3.5,
            markerRadius.get(member.pgc) ?? 3.5,
            (ra, dec) => mapView.world2pix(ra, dec),
          );
          const overlay = lines.get(edge.tone);
          if (overlay && clipped.length >= 2)
            overlay.add(drawingApi.polyline(clipped));
        }
        for (const overlay of lines.values()) overlay.reportChange();
        scheduleInteractionUpdate();
      }

      // Close-up preview is the unannotated DSS2 field of the root galaxy.
      // Only the hierarchy preview and interactive group map draw relations.
      if (!portrait && atlas !== null) {
        // Aladin owns both layers, so they follow the same coordinate transform
        // and the same render cycle when panning and zooming.
        for (const tone of [
          "positive",
          "negative",
          "zero",
          "unknown",
        ] as TidalTone[]) {
          const overlay = drawingApi.graphicOverlay({
            name: `Group MD relations: ${tone}`,
            color: TIDAL_TONES[tone],
            lineWidth: miniature ? 0.9 : 1.35,
          });
          lines.set(tone, overlay);
          view.addOverlay(overlay);
        }
        const bounds = members.map((member) => {
          const object = atlas.byPgc.get(member.pgc);
          const diameter = Math.max(
            4,
            Math.round(
              markerDiameter(
                object?.b_mag ?? null,
                OVERVIEW_MARKER_MAX_DIAMETER,
              ),
            ),
          );
          return [member.pgc, diameter / 2] as const;
        });
        markerRadius = new Map(bounds);
        // Regenerate only when pixel scale changes. The native Aladin overlay
        // continues to track pan movements without a separate animated canvas.
        mapView.on("zoomChanged", updateGroupEdges);
        mapView.on("positionChanged", scheduleInteractionUpdate);
        unregisterEdgeUpdate = () => {
          mapView.off?.("zoomChanged");
          mapView.off?.("positionChanged");
        };

        const catalog: AladinCatalog = A.catalog({
          name: "Group galaxies",
          shape: drawOverviewMarker,
          sourceSize: 7,
          color: (source: AladinSource) =>
            morphologyColor(
              typeof source.data?.morphology_t === "number"
                ? source.data.morphology_t
                : null,
            ),
        });
        // Reuse the exact Atlas marker/popup implementation, including global
        // Theta1 stroke bounds, photometric diameters and MD navigation fields.
        view.addCatalog(catalog);
        setCatalogSources(
          catalog,
          visibleObjects,
          1,
          OVERVIEW_MARKER_MAX_DIAMETER,
          atlas.tidalRange,
          atlas.objects,
        );
        view.gotoRaDec(rootRa, rootDec);
        view.setFoV(initialFov);
        updateGroupEdges();
        observer = new ResizeObserver(() => {
          fitToMembers();
          updateGroupEdges();
          scheduleInteractionUpdate();
        });
        observer.observe(element);
        for (const delay of [100, 350, 850, 1400]) {
          timers.push(window.setTimeout(fitToMembers, delay));
        }
      } else {
        // No marker/catalogue/overlay for an MD portrait.
        view.gotoRaDec(rootRa, rootDec);
        view.setFoV(initialFov);
      }
      if (onSnapshot) {
        timers.push(
          window.setTimeout(() => {
            if (cancelled || !view || snapshotRequested) return;
            snapshotRequested = true;
            fitToMembers();
            if (!portrait) {
              const { factor, missing } = allMembersFit(
                view,
                members,
                element.clientWidth,
                element.clientHeight,
                17,
              );
              if (missing > 0 || factor > 1.02) {
                onSnapshotError?.(
                  `Preview incomplete: ${missing} off-projection markers; boundary factor ${factor.toFixed(2)}`,
                );
                return;
              }
            }
            if (
              typeof view.getViewDataURL !== "function" ||
              typeof view.getSize !== "function"
            ) {
              onSnapshotError?.(
                "Installed Aladin Lite lacks sized screenshot export",
              );
              return;
            }
            // DSS2 HiPS tile loading is asynchronous. Retry captures of a sky
            // field that is not yet painted; never persist an empty placeholder.
            const captureView = view;
            const reportImage = onSnapshot;
            const delays = [0, 1800, 2600, 3800];
            async function captureAttempt(
              attempt: number,
              previousError: unknown = null,
            ): Promise<void> {
              if (isCaptureAborted()) return;
              if (attempt >= delays.length) {
                onSnapshotError?.(
                  `Preview capture failed after ${delays.length} attempts: ${String(previousError)}`,
                );
                return;
              }
              if (delays[attempt] > 0) {
                await new Promise<void>((resolve) => {
                  window.setTimeout(resolve, delays[attempt]);
                });
              }
              if (isCaptureAborted()) return;
              try {
                const blob = await captureSquareWebp(captureView);
                if (!isCaptureAborted()) reportImage(blob);
              } catch (error: unknown) {
                await captureAttempt(attempt + 1, error);
              }
            }
            void captureAttempt(0);
          }, 4800),
        );
      }
    }

    element.addEventListener("pointerdown", markInteraction, { passive: true });
    element.addEventListener("wheel", markInteraction, { passive: true });
    element.addEventListener("touchstart", markInteraction, { passive: true });
    void initialize().catch((error: unknown) => {
      if (!cancelled) {
        element.dataset.layerError = String(error);
        setMapError(`Group map unavailable: ${String(error)}`);
        onSnapshotError?.(
          `Aladin layer initialization failed: ${String(error)}`,
        );
      }
    });
    return () => {
      cancelled = true;
      captureAbort.abort();
      observer?.disconnect();
      unregisterEdgeUpdate?.();
      if (interactionFrame !== null)
        window.cancelAnimationFrame(interactionFrame);
      for (const timer of timers) window.clearTimeout(timer);
      element.removeEventListener("pointerdown", markInteraction);
      element.removeEventListener("wheel", markInteraction);
      element.removeEventListener("touchstart", markInteraction);
      nativeSubgroupController.current = null;
      view?.remove?.();
      viewRef.current = null;
      catalogueRef.current = null;
      element.replaceChildren();
    };
  }, [
    group,
    miniature,
    previewVariant,
    portraitFov,
    onSnapshot,
    onSnapshotError,
  ]);

  return (
    <div
      className={`aladin-frame group-sky-map${miniature ? " group-sky-map--miniature" : ""}`}
      aria-label={`DSS2 Color SIN projection of ${group.name}: ${group.member_count} galaxies and their main-disturber links`}
      onClickCapture={onPopupClick}
    >
      <div className="group-sky-image" ref={skyRef} />
      {!miniature && (
        <GroupTidalUI
          group={group}
          view={viewRef.current}
          revision={mapRevision}
          width={mapSize.width}
          height={mapSize.height}
          onMemberNavigate={onMemberNavigate}
          onSubgroupPresentation={presentNativeSubgroups}
        />
      )}
      {mapError !== null && !miniature ? (
        <p role="alert" className="catalog-status catalog-status-error">
          {mapError}
        </p>
      ) : null}
    </div>
  );
}
