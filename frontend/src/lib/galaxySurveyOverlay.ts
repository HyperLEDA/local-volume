/** A single, named overlay is kept separate from the base survey and sky catalogues. */
export const GALAXY_COMPARISON_LAYER = "lv-leda-galaxy-comparison";

export type ComparisonLayer = { setOpacity: (opacity: number) => void };
export type ComparisonAladinView = {
  setOverlayImageLayer: (id: string, name: string) => void | Promise<unknown>;
  getOverlayImageLayer: (name: string) => ComparisonLayer | null | undefined;
  removeImageLayer: (name: string) => void;
};

type OverlayRequest = { surveyId: string | null; opacity: number };

export function normaliseOpacity(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

/**
 * Serialize HiPS replacements and honour the LAST user choice. Alpha-only
 * changes update the existing image layer, without re-adding or remounting it.
 * This concerns the layer registration, not asynchronous HiPS tile coverage.
 */
export function createGalaxyOverlayController(
  view: ComparisonAladinView,
  reportError: (error: string | null) => void,
) {
  let wanted: OverlayRequest = { surveyId: null, opacity: 0.5 };
  let registered: string | null = null;
  let running = false;
  let disposed = false;
  function isDisposed(): boolean { return disposed; }

  function removeOnlyComparisonLayer(): void {
    if (registered === null) return;
    view.removeImageLayer(GALAXY_COMPARISON_LAYER);
    registered = null;
  }

  async function flush(): Promise<void> {
    if (isDisposed() || running) return;
    running = true;
    try {
      while (!isDisposed()) {
        const { surveyId } = wanted;
        if (surveyId === null) {
          try {
            removeOnlyComparisonLayer();
            reportError(null);
          } catch (error) {
            reportError(`Could not remove comparison layer: ${String(error)}`);
          }
          return;
        }
        if (registered === surveyId) {
          try {
            const layer = view.getOverlayImageLayer(GALAXY_COMPARISON_LAYER);
            if (!layer) throw new Error("Comparison image layer is unavailable");
            layer.setOpacity(wanted.opacity);
            reportError(null);
          } catch (error) {
            reportError(`Could not update comparison opacity: ${String(error)}`);
          }
          return;
        }

        const requested = surveyId;
        try {
          // oxlint-disable-next-line no-await-in-loop -- only one image layer may be replaced at a time.
          await view.setOverlayImageLayer(requested, GALAXY_COMPARISON_LAYER);
          if (isDisposed()) {
            try { view.removeImageLayer(GALAXY_COMPARISON_LAYER); } catch { /* unmounted */ }
            return;
          }
          registered = requested;
          const layer = view.getOverlayImageLayer(GALAXY_COMPARISON_LAYER);
          if (!layer) throw new Error("Comparison image layer is unavailable");
          // Respect opacity changes that arrived while the survey was loading.
          layer.setOpacity(wanted.surveyId === requested ? wanted.opacity : 0);
          if (wanted.surveyId === requested) reportError(null);
        } catch (error) {
          try { view.removeImageLayer(GALAXY_COMPARISON_LAYER); } catch { /* best effort */ }
          registered = null;
          if (wanted.surveyId === requested) {
            reportError(`Could not load comparison HiPS: ${String(error)}`);
            return;
          }
        }
        // If a new survey was requested during loading, loop to the last one.
      }
    } finally {
      running = false;
    }
  }

  return {
    request(surveyId: string | null, opacity: number): void {
      if (disposed) return;
      wanted = { surveyId: surveyId?.trim() || null, opacity: normaliseOpacity(opacity) };
      if (!running) void flush();
    },
    dispose(): void {
      disposed = true;
      // The parent Aladin mount will also be destroyed. Remove only this layer.
      try { removeOnlyComparisonLayer(); } catch { /* unmounted view */ }
    },
  };
}
