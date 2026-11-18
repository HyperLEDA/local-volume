// ISSUE49_PHASE_G_FIRST_FRAME_20261118
// Wait for a valid first *visible* full-sky frame. The scientific center/FoV
// and the user's later pan/zoom are never changed by this helper.
import type { AladinView } from "aladin-lite";

const INITIAL_ATLAS_FRAME_FALLBACK_MS = 3000;
const STABLE_PAINT_FRAMES = 3;

function isAllSkyImage(url: string): boolean {
  try {
    const path = new URL(url, window.location.href).pathname;
    return /\/Norder\d+\/Allsky\.(?:jpg|jpeg|png|webp)$/i.test(path);
  } catch {
    return false;
  }
}

function atlasBackingCanvasReady(view: AladinView, element: HTMLElement): boolean {
  const canvas = element.querySelector<HTMLCanvasElement>("canvas.aladin-imageCanvas");
  if (canvas === null) return false;
  const [width, height] = view.getSize();
  const dpr = window.devicePixelRatio;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) {
    return false;
  }
  // Aladin's backing canvas is resized from its browser-default 300x150 to
  // the actual device-resolution dimensions by its asynchronous WebGL resize.
  const expectedWidth = width * dpr;
  const expectedHeight = height * dpr;
  return (
    Math.abs(canvas.width - expectedWidth) <= 3 &&
    Math.abs(canvas.height - expectedHeight) <= 3
  );
}

/** Call immediately after A.aladin(), while its div has been hidden. */
export function stageAtlasFirstFrame(view: AladinView, element: HTMLDivElement): () => void {
  let finished = false;
  let readyFrames = 0;
  let allSkyImageFetched = performance.getEntriesByType("resource").some(
    (entry) => isAllSkyImage(entry.name),
  );
  let rafId: number | null = null;
  let observer: PerformanceObserver | null = null;
  const fallbackTimer: { id: number | null } = { id: null };

  function restoreVisibility(): void {
    element.style.removeProperty("visibility");
    element.removeAttribute("aria-busy");
  }

  function dispose(): void {
    if (finished) return;
    finished = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (fallbackTimer.id !== null) window.clearTimeout(fallbackTimer.id);
    observer?.disconnect();
    restoreVisibility();
  }

  try {
    observer = new PerformanceObserver((list) => {
      if (finished) return;
      if (list.getEntries().some((entry) => isAllSkyImage(entry.name))) {
        allSkyImageFetched = true;
      }
    });
    observer.observe({ type: "resource", buffered: true });
  } catch {
    observer?.disconnect();
    observer = null;
  }

  function pollFrame(): void {
    if (finished) return;
    try {
      const fov = view.getFov();
      const geometryReady =
        fov[0] >= 359.5 &&
        fov[1] >= 179 &&
        atlasBackingCanvasReady(view, element);
      readyFrames = geometryReady && allSkyImageFetched ? readyFrames + 1 : 0;
    } catch {
      readyFrames = 0;
    }
    if (readyFrames >= STABLE_PAINT_FRAMES) {
      dispose();
    } else {
      rafId = requestAnimationFrame(pollFrame);
    }
  }

  // A missing survey must never leave the map permanently invisible.
  fallbackTimer.id = window.setTimeout(dispose, INITIAL_ATLAS_FRAME_FALLBACK_MS);
  rafId = requestAnimationFrame(pollFrame);
  return dispose;
}
