import { useState } from "react";
import "./objectMeasurementExports.css";
import type { CatalogObjectDetail, ParameterRow } from "../api/objects.ts";
import {
  buildGalaxyExport,
  galaxyExportCsv,
  galaxyExportJson,
} from "../lib/objectMeasurementsExport.ts";

type Props = { galaxy: CatalogObjectDetail; observed: readonly ParameterRow[] };
type ExportFormat = "csv" | "json";

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ObjectMeasurementExports({ galaxy, observed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportAs(format: ExportFormat): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/object/${galaxy.pgc}/physical`);
      if (!response.ok && response.status !== 404)
        throw new Error(`Physical measurements could not be retrieved (${response.status})`);
      const payload = response.ok
        ? (await response.json()) as { data?: Record<string, string | number | boolean | null> }
        : null;
      const doc = buildGalaxyExport(galaxy, observed, payload?.data ?? null);
      const name = `LVLEDA_PGC${galaxy.pgc}_measurements.${format}`;
      download(
        name,
        format === "csv" ? galaxyExportCsv(doc) : galaxyExportJson(doc),
        format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="object-measurement-exports" aria-label="Object measurement exports">
      <span>Measurements</span>
      <button type="button" disabled={busy} onClick={() => void exportAs("csv")}>CSV</button>
      <button type="button" disabled={busy} onClick={() => void exportAs("json")}>JSON</button>
      {error !== null ? <span role="alert">{error}</span> : null}
    </div>
  );
}
