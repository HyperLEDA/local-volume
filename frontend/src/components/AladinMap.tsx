import A, { type AladinCatalog, type AladinView } from "aladin-lite";
import { useEffect, useRef, useState } from "react";
import type { CatalogObject } from "../api/objects.ts";

export type SkyFocus = {
  ra: number;
  dec: number;
  requestId: number;
};

type AladinMapProps = {
  objects: CatalogObject[];
  focus: SkyFocus | null;
  fov?: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setCatalogSources(
  catalog: AladinCatalog,
  objects: CatalogObject[],
): void {
  catalog.removeAll();
  const sources = objects.flatMap((object) => {
    if (object.ra === null || object.dec === null) {
      return [];
    }
    const name = escapeHtml(object.name);
    return [
      A.marker(object.ra, object.dec, {
        popupTitle: name,
        popupDesc: `<a class="aladin-object-link" href="/object/${object.pgc}">Open object page</a>`,
        useMarkerDefaultIcon: false,
      }),
    ];
  });
  if (sources.length === 0) {
    return;
  }
  catalog.addSources(sources);
}

export function AladinMap({ objects, focus, fov = 180 }: AladinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<AladinCatalog | null>(null);
  const viewRef = useRef<AladinView | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let cancelled = false;

    async function mount(element: HTMLDivElement): Promise<void> {
      await A.init;
      if (cancelled) {
        return;
      }
      const view = A.aladin(element, {
        fov,
        projection: "SIN",
        cooFrame: "equatorial",
        target: "180 +0",
        showSimbadPointerControl: false,
        showFullscreenControl: false,
      });
      const catalog = A.catalog({
        name: "Local volume",
        shape: "cross",
        sourceSize: 8,
        color: "#f2c14e",
      });
      view.setFoV(fov);
      view.addCatalog(catalog);
      viewRef.current = view;
      catalogRef.current = catalog;
      setReady(true);
    }

    void mount(container);

    return () => {
      cancelled = true;
      catalogRef.current = null;
      viewRef.current = null;
      setReady(false);
      container.replaceChildren();
    };
  }, [fov]);

  useEffect(() => {
    const catalog = catalogRef.current;
    if (!ready || catalog === null) {
      return;
    }
    setCatalogSources(catalog, objects);
  }, [objects, ready]);

  useEffect(() => {
    const view = viewRef.current;
    if (!ready || focus === null || view === null) {
      return;
    }
    view.gotoRaDec(focus.ra, focus.dec);
  }, [focus, ready]);

  return <div ref={containerRef} className="aladin-frame" />;
}
