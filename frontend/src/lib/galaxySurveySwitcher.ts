/**
 * Serializes user-requested survey changes on ONE Aladin instance.
 * A superseded pending choice cannot subsequently overwrite the final choice.
 * Tile loading/sky coverage is controlled by Aladin/HiPS, not this queue.
 */
export function createGalaxySurveySwitcher(
  initialSurvey: string,
  activate: (id: string) => void | Promise<unknown>,
  reportError: (message: string | null) => void,
) {
  let wanted = initialSurvey;
  let attempted = initialSurvey;
  let busy = false;
  let disposed = false;
  function isDisposed(): boolean {
    return disposed;
  }

  async function flush(): Promise<void> {
    if (busy || isDisposed()) return;
    busy = true;
    try {
      while (!isDisposed() && wanted !== attempted) {
        const next = wanted;
        attempted = next;
        try {
          // oxlint-disable-next-line no-await-in-loop -- HiPS changes must be serial.
          await activate(next);
          if (!isDisposed() && wanted === next) reportError(null);
        } catch (reason) {
          if (!isDisposed() && wanted === next) {
            reportError(
              `Could not switch to the selected HiPS survey: ${reason instanceof Error ? reason.message : String(reason)}`,
            );
          }
        }
      }
    } finally {
      busy = false;
    }
  }

  return {
    request(id: string): void {
      if (disposed || id === wanted) return;
      wanted = id;
      void flush();
    },
    dispose(): void {
      disposed = true;
    },
  };
}
