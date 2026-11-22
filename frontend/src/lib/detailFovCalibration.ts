import type { AladinView } from "aladin-lite";

/** Only a square, fully synchronized WebGL viewport can represent an a26 x a26 field. */
export function detailViewportIsSquare(
  cssWidth: number,
  cssHeight: number,
  viewWidth: number,
  viewHeight: number,
): boolean {
  if (![cssWidth, cssHeight, viewWidth, viewHeight].every(Number.isFinite)) {
    return false;
  }
  if (Math.min(cssWidth, cssHeight, viewWidth, viewHeight) < 2) return false;
  return (
    Math.abs(cssWidth - cssHeight) <= Math.max(2, cssWidth * 0.01) &&
    Math.abs(cssWidth - viewWidth) <= 2 &&
    Math.abs(cssHeight - viewHeight) <= 2
  );
}

/** The Aladin API reports both horizontal and vertical FoV in degrees. */
export function detailFovNeedsCorrection(
  measured: readonly number[],
  requestedDegrees: number,
): boolean {
  if (!Number.isFinite(requestedDegrees) || requestedDegrees <= 0) return false;
  if (measured.length < 2) return false;
  return measured
    .slice(0, 2)
    .some(
      (extent) =>
        Number.isFinite(extent) &&
        extent > 0 &&
        Math.abs(extent - requestedDegrees) / requestedDegrees > 0.015,
    );
}

/**
 * Correct the initial *measured* FoV after Aladin's asynchronous WASM resize.
 * Never perform a late correction after the user has panned/zoomed or after
 * object-to-object navigation. React does not remount the map on these events.
 */
export function installDetailInitialFovCalibration(
  view: AladinView,
  element: HTMLDivElement,
  requestedDegrees: number,
  getCurrentRequestId: () => number | null,
  initialRequestId: number | null,
  isCancelled: () => boolean,
): () => void {
  let stopped = false;
  let frame: number | null = null;
  let unsettledFrames = 0;
  let corrections = 0;
  let observer: ResizeObserver | null = null;
  // Aladin Lite implements resizeChanged, but the published TypeScript
  // AladinView event overloads omit it. Narrow only this compatibility API.
  const resizeEvents = view as unknown as {
    on: (name: "resizeChanged", listener: () => void) => void;
    off?: (name: "resizeChanged") => void;
  };

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    observer?.disconnect();
    resizeEvents.off?.("resizeChanged");
    element.removeEventListener("pointerdown", stop);
    element.removeEventListener("wheel", stop);
    element.removeEventListener("touchstart", stop);
    element.removeEventListener("keydown", stop);
  }

  function fit(): void {
    frame = null;
    if (stopped || isCancelled()) return;
    if (getCurrentRequestId() !== initialRequestId) {
      stop();
      return;
    }
    const bounds = element.getBoundingClientRect();
    const [viewWidth, viewHeight] = view.getSize();
    if (
      !detailViewportIsSquare(
        bounds.width,
        bounds.height,
        viewWidth,
        viewHeight,
      )
    ) {
      // The Aladin canvas may still have its temporary initialization size.
      if (++unsettledFrames < 120) frame = requestAnimationFrame(fit);
      return;
    }
    const measured: readonly number[] = view.getFov();
    if (
      measured.length < 2 ||
      measured
        .slice(0, 2)
        .some((extent) => !Number.isFinite(extent) || extent <= 0)
    ) {
      if (++unsettledFrames < 120) frame = requestAnimationFrame(fit);
      return;
    }
    unsettledFrames = 0;
    if (corrections >= 4) return;
    if (detailFovNeedsCorrection(measured, requestedDegrees)) {
      corrections++;
      view.setFoV(requestedDegrees);
      frame = requestAnimationFrame(fit);
    }
  }

  function schedule(): void {
    if (stopped || isCancelled()) return;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  }

  function onResize(): void {
    corrections = 0;
    unsettledFrames = 0;
    schedule();
  }

  resizeEvents.on("resizeChanged", onResize);
  element.addEventListener("pointerdown", stop);
  element.addEventListener("wheel", stop, { passive: true });
  element.addEventListener("touchstart", stop, { passive: true });
  element.addEventListener("keydown", stop);
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(onResize);
    observer.observe(element);
  }
  schedule();
  return stop;
}
