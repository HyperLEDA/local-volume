import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  captureAtlasCamera,
  restoreAtlasCamera,
  type AtlasCamera,
  type AtlasCameraSnapshot,
} from "./atlasCamera.ts";

type OptionalOrientation = {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

function isOptionalOrientation(value: unknown): value is OptionalOrientation {
  if (typeof value !== "object" || value === null) return false;
  return (
    (!("lock" in value) || typeof value.lock === "function") &&
    (!("unlock" in value) || typeof value.unlock === "function")
  );
}

function orientationFeature(): OptionalOrientation | null {
  if (typeof screen === "undefined") return null;
  const orientation: unknown = Reflect.get(screen, "orientation");
  return isOptionalOrientation(orientation) ? orientation : null;
}

function exitNativeFullscreen(): void {
  const exit: unknown = Reflect.get(document, "exitFullscreen");
  if (typeof exit === "function") {
    void (exit as () => Promise<void>).call(document).catch(() => {});
  }
}

/** The same mounted Atlas/WebGL element is expanded in place; never a portal. */
export function useAtlasFullscreen() {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const skyRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<AtlasCamera | null>(null);
  const pendingCameraRef = useRef<AtlasCameraSnapshot | null>(null);
  const savedScrollRef = useRef(0);
  const nativeFullscreenRef = useRef(false);
  const historyEntryRef = useRef(false);
  const restoreScrollRef = useRef(false);

  const onCameraReady = useCallback((camera: AtlasCamera | null) => {
    cameraRef.current = camera;
  }, []);

  const leave = useCallback((fromHistory = false) => {
    if (!activeRef.current) return;
    pendingCameraRef.current = captureAtlasCamera(cameraRef.current);
    activeRef.current = false;
    restoreScrollRef.current = true;
    setActive(false);
    document.documentElement.classList.remove("atlas-maximized-active");
    if (!fromHistory && historyEntryRef.current &&
      window.history.state?.lvAtlasMaximized === true) {
      window.history.back();
    }
    historyEntryRef.current = false;
    if (document.fullscreenElement === skyRef.current) exitNativeFullscreen();
    nativeFullscreenRef.current = false;
    try {
      orientationFeature()?.unlock?.();
    } catch {
      // Orientation unlock is best-effort on partially supported browsers.
    }
  }, []);

  const enter = useCallback(() => {
    const target = skyRef.current;
    if (!target || activeRef.current) return;
    savedScrollRef.current = window.scrollY;
    restoreScrollRef.current = false;
    pendingCameraRef.current = captureAtlasCamera(cameraRef.current);
    activeRef.current = true;
    setActive(true);
    // A same-URL history entry makes browser Back exit the maximized view.
    const previous = window.history.state;
    const state = previous && typeof previous === "object" ? { ...previous } : {};
    // Preserve React Router's history index when one is present.
    if (typeof state.idx === "number") state.idx += 1;
    window.history.pushState({ ...state, lvAtlasMaximized: true }, "", window.location.href);
    historyEntryRef.current = true;
    document.documentElement.classList.add("atlas-maximized-active");
    // Invoke on the click gesture; unsupported/rejected API is a CSS fallback.
    if (typeof target.requestFullscreen === "function") {
      try {
        void target.requestFullscreen({ navigationUI: "hide" }).then(async () => {
          if (!activeRef.current) {
            if (document.fullscreenElement === target) await document.exitFullscreen();
            return;
          }
          nativeFullscreenRef.current = true;
          try {
            await orientationFeature()?.lock?.("landscape");
          } catch {
            // iOS, orientation-locked devices and unsupported Android browsers.
          }
        }).catch(() => {
          nativeFullscreenRef.current = false;
        });
      } catch {
        // No native fullscreen support: leave the CSS maximized mode active.
      }
    }
  }, []);

  useLayoutEffect(() => {
    const section = skyRef.current;
    const map = section?.querySelector<HTMLElement>(".aladin-frame");
    if (!map) return;
    document.documentElement.classList.toggle("atlas-maximized-active", active);
    let frame: number | null = null;
    let attempts = 0;
    let cancelled = false;
    function reconcile() {
      frame = null;
      if (cancelled || !pendingCameraRef.current) return;
      attempts++;
      const camera = cameraRef.current;
      const size = camera?.getSize();
      const rect = map!.getBoundingClientRect();
      const ready = size && rect.width > 1 && rect.height > 1 &&
        Math.abs(size[0] - rect.width) < 3 &&
        Math.abs(size[1] - rect.height) < 3;
      if (ready && camera && attempts >= 2) {
        restoreAtlasCamera(camera, pendingCameraRef.current);
        if (!active && restoreScrollRef.current) {
          restoreScrollRef.current = false;
          window.scrollTo({ top: savedScrollRef.current, behavior: "auto" });
        }
        // Native fullscreen may resize AFTER the first CSS layout frame.
        // Keep correcting briefly, but cancel immediately on user input.
        if (attempts >= 32) pendingCameraRef.current = null;
      }
      if (pendingCameraRef.current && attempts < 45) {
        frame = requestAnimationFrame(reconcile);
      }
    }
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reconcile);
    });
    observer.observe(map);
    frame = requestAnimationFrame(reconcile);
    function cancelRestore(): void {
      pendingCameraRef.current = null;
    }
    map.addEventListener("pointerdown", cancelRestore);
    map.addEventListener("wheel", cancelRestore, { passive: true });
    map.addEventListener("keydown", cancelRestore);
    return () => {
      cancelled = true;
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      map.removeEventListener("pointerdown", cancelRestore);
      map.removeEventListener("wheel", cancelRestore);
      map.removeEventListener("keydown", cancelRestore);
    };
  }, [active]);

  useEffect(() => {
    const mountedSky = skyRef.current;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && activeRef.current) {
        event.preventDefault();
        leave();
      }
    }
    function onHistory() {
      if (activeRef.current) leave(true);
    }
    function onFullscreenChanged() {
      if (document.fullscreenElement === skyRef.current) {
        nativeFullscreenRef.current = true;
      } else if (nativeFullscreenRef.current) {
        leave();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onHistory);
    document.addEventListener("fullscreenchange", onFullscreenChanged);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onHistory);
      document.removeEventListener("fullscreenchange", onFullscreenChanged);
      document.documentElement.classList.remove("atlas-maximized-active");
      activeRef.current = false;
      if (document.fullscreenElement === mountedSky) exitNativeFullscreen();
      try {
        orientationFeature()?.unlock?.();
      } catch {
        // Orientation unlock is best-effort on partially supported browsers.
      }
    };
  }, [leave]);

  return { active, skyRef, enter, leave, onCameraReady };
}
