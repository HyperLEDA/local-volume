import A, {
  type AladinCatalog,
  type AladinSource,
  type AladinView,
} from "aladin-lite";
import { useEffect, useRef, useState } from "react";
import type { CatalogObject } from "../api/objects.ts";
import { findReticleTarget, markerDiameter } from "../lib/reticle.ts";

const DEFAULT_HIPS_SURVEY = "https://skies.esac.esa.int/DSSColor";

export type SkyFocus = {
  ra: number;
  dec: number;
  requestId: number;
};

type AladinMapProps = {
  objects: CatalogObject[];
  focus: SkyFocus | null;
  fov?: number;
  enableReticlePopups?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatRa(degrees: number | null): string {
  if (degrees === null || !Number.isFinite(degrees)) {
    return "—";
  }
  const totalCentiseconds =
    Math.round((((degrees % 360) + 360) % 360) * 24000) % 8640000;
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const seconds = ((totalCentiseconds % 6000) / 100)
    .toFixed(2)
    .padStart(5, "0");
  return `${pad2(hours)}h ${pad2(minutes)}m ${seconds}s`;
}

function formatDec(degrees: number | null): string {
  if (degrees === null || !Number.isFinite(degrees)) {
    return "—";
  }
  const totalTenths = Math.round(Math.abs(degrees) * 36000);
  const wholeDegrees = Math.floor(totalTenths / 36000);
  const arcminutes = Math.floor((totalTenths % 36000) / 600);
  const arcseconds = ((totalTenths % 600) / 10).toFixed(1).padStart(4, "0");
  const sign = degrees < 0 || Object.is(degrees, -0) ? "−" : "+";
  return `${sign}${pad2(wholeDegrees)}° ${pad2(arcminutes)}′ ${arcseconds}″`;
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
  return `<div class="lv-popup-field"><span class="lv-popup-label">${label}</span><span class="lv-popup-value" title="${escapeHtml(value)}">${escapeHtml(value)}</span></div>`;
}

function popupTitle(object: CatalogObject): string {
  const nature = escapeHtml(object.type_name ?? "—");
  const name = escapeHtml(object.name);
  return `<div class="lv-popup-header"><a class="lv-popup-name" href="/object/${object.pgc}">${name}</a><span class="lv-popup-nature">${nature}</span></div>`;
}

function popupDescription(object: CatalogObject): string {
  const fields = [
    popupField("RA", formatRa(object.ra)),
    popupField("Dec", formatDec(object.dec)),
    popupField("B<sub>T</sub>", formatQuantity(object.bt, 2, "mag")),
    popupField("D<sub>26</sub>", formatQuantity(object.d_26, 1)),
    popupField("V<sub>hel</sub>", formatQuantity(object.v_hel, 1, "km/s")),
    popupField("W<sub>50</sub>", formatQuantity(object.w_50, 1, "km/s")),
  ];
  return `<div class="lv-popup-grid">${fields.join("")}</div>`;
}

function setCatalogSources(
  catalog: AladinCatalog,
  objects: CatalogObject[],
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
    const marker = A.marker(object.ra, object.dec, {
      popupTitle: popupTitle(object),
      popupDesc: popupDescription(object),
      useMarkerDefaultIcon: false,
    });
    marker.setSize(markerDiameter(object.bt));
    return [marker];
  });
  if (sources.length === 0) {
    return;
  }
  catalog.addSources(sources);
}

export function AladinMap({
  objects,
  focus,
  fov = 180,
  enableReticlePopups = false,
}: AladinMapProps) {
  const isOverview = fov >= 180;
  const mapFov = isOverview ? 360 : fov;
  const containerRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<AladinCatalog | null>(null);
  const viewRef = useRef<AladinView | null>(null);
  const objectsRef = useRef(objects);
  const refreshReticlePopupRef = useRef<(() => void) | null>(null);
  const clearReticlePopupRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let cancelled = false;
    const listeners = { detach: null as (() => void) | null };

    async function mount(element: HTMLDivElement): Promise<void> {
      await A.init;
      if (cancelled) {
        return;
      }
      const view = A.aladin(element, {
        fov: mapFov,
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
        shape: "circle",
        sourceSize: 7,
        color: "#f2c14e",
      });
      view.setFoV(mapFov);
      if (isOverview) {
        view.setZoomFactor(1.25);
      }
      view.addCatalog(catalog);

      let autoPopupPgc: number | null = null;
      let manualPopup = false;
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
            popupDescription(candidate),
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
        scheduleReticlePopup();
      }
      function onObjectClicked(source: AladinSource | null): void {
        if (source !== null) {
          manualPopup = true;
          autoPopupPgc = null;
          if (pendingUpdate !== null) {
            clearTimeout(pendingUpdate);
            pendingUpdate = null;
          }
        }
      }

      if (enableReticlePopups) {
        view.on("positionChanged", onViewChanged);
        view.on("zoomChanged", onViewChanged);
        view.on("objectClicked", onObjectClicked);
        refreshReticlePopupRef.current = showReticlePopup;
        clearReticlePopupRef.current = clearAutoPopup;
        listeners.detach = () => {
          if (pendingUpdate !== null) {
            clearTimeout(pendingUpdate);
          }
          view.off("positionChanged");
          view.off("zoomChanged");
          view.off("objectClicked");
        };
      }

      viewRef.current = view;
      catalogRef.current = catalog;
      setReady(true);
    }

    void mount(container);

    return () => {
      cancelled = true;
      listeners.detach?.();
      clearReticlePopupRef.current = null;
      refreshReticlePopupRef.current = null;
      catalogRef.current = null;
      viewRef.current = null;
      setReady(false);
      container.replaceChildren();
    };
  }, [isOverview, mapFov, enableReticlePopups]);

  useEffect(() => {
    objectsRef.current = objects;
    const catalog = catalogRef.current;
    if (!ready || catalog === null) {
      return;
    }
    clearReticlePopupRef.current?.();
    setCatalogSources(catalog, objects);
    refreshReticlePopupRef.current?.();
  }, [objects, ready]);

  useEffect(() => {
    const view = viewRef.current;
    if (!ready || focus === null || view === null) {
      return;
    }
    view.gotoRaDec(focus.ra, focus.dec);
  }, [focus, ready]);

  return (
    <div
      ref={containerRef}
      className={
        isOverview ? "aladin-frame aladin-frame--overview" : "aladin-frame"
      }
    />
  );
}
