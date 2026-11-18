import { useId, useState } from "react";
import type { CatalogObject } from "../api/objects.ts";
import { summarizeAtlas } from "../lib/atlasSummary.ts";
import { medianHeliocentricVelocity } from "../lib/atlasVelocitySummary.ts";
import { trgbDistanceCount } from "../lib/atlasTrgbSummary.ts";
import {
  buildAtlasCsv,
  buildAtlasTsv,
  buildAtlasJson,
  type AtlasExportFormat,
  type AtlasExportMetadata,
} from "../lib/atlasExport.ts";
import type { ScientificFiltersState } from "../lib/scientificFilters.ts";
import type { SkyRegion } from "../lib/skyRegion.ts";
import type { SkyCoordinates } from "../lib/skySearch.ts";

type Props = {
  objects: CatalogObject[];
  total: number;
  query: string;
  filters: ScientificFiltersState;
  region: SkyRegion | null;
  nearby: SkyCoordinates | null;
  radiusArcmin: number;
};

function saveDownload(name: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AtlasSelectionSummary({
  objects,
  total,
  query,
  filters,
  region,
  nearby,
  radiusArcmin,
}: Props) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuId = useId();
  const summary = summarizeAtlas(objects);
  const velocity = medianHeliocentricVelocity(objects);
  const trgbCount = trgbDistanceCount(objects);
  const methodKnown = objects.some(
    (object) =>
      typeof object.distance_method === "string" &&
      object.distance_method.trim() !== "",
  );

  async function buildMetadata(): Promise<AtlasExportMetadata> {
    let generation: Record<string, unknown> | null = null;
    try {
      const response = await fetch("/api/v1/physical/refresh-status");
      if (response.ok) {
        const body = (await response.json()) as {
          data: Record<string, unknown>;
        };
        generation = body.data;
      }
    } catch {
      /* Missing refresh metadata must not block export. */
    }
    const metadata = {
      schema: "LV-atlas-selection-v1",
      exported_at_utc: new Date().toISOString(),
      selection_url: window.location.href,
      query,
      filters,
      region,
      nearby,
      radius_arcmin: radiusArcmin,
      selected_objects: objects.length,
      total_objects: total,
      physical_refresh_state: generation,
      scientific_warning:
        "Calculated theta1/MD use an incomplete Local Volume donor census, not the published full-neighborhood indices.",
      reproducibility_note:
        "Live catalogue is not a frozen snapshot. The refresh state is queried at export time.",
    };
    return metadata;
  }

  async function exportMetadata(): Promise<void> {
    const metadata = await buildMetadata();
    saveDownload(
      "lv-atlas-selection-metadata.json",
      `${JSON.stringify(metadata, null, 2)}\n`,
      "application/json",
    );
  }

  async function exportSelection(format: AtlasExportFormat): Promise<void> {
    setExportOpen(false);
    if (format === "csv") {
      saveDownload(
        "lv-atlas-selection.csv",
        buildAtlasCsv(objects),
        "text/csv;charset=utf-8",
      );
    } else if (format === "tsv") {
      saveDownload(
        "lv-atlas-selection.tsv",
        buildAtlasTsv(objects),
        "text/tab-separated-values;charset=utf-8",
      );
    } else {
      const metadata = await buildMetadata();
      saveDownload(
        "lv-atlas-selection.json",
        buildAtlasJson(objects, metadata),
        "application/json;charset=utf-8",
      );
    }
  }

  async function share(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Link copied");
    } catch {
      setShareStatus("Copy the browser URL");
    }
  }

  return (
    <div className="atlas-results" aria-label="Selection statistics and export">
      <div className="atlas-results-statistics">
        <div className="atlas-stat">
          <span>Selected</span>
          <strong>
            {summary.selected} <small>/ {total}</small>
          </strong>
        </div>
        <div className="atlas-stat">
          <span>
            Median <i>V</i>
            <sub>h</sub>
          </span>
          <strong>
            {velocity.median === null
              ? "—"
              : `${velocity.median.toFixed(1)} km/s`}
          </strong>
          <small>{velocity.measured} measured</small>
        </div>
        <div className="atlas-stat">
          <span>Median D</span>
          <strong>
            {summary.medianDistance === null
              ? "—"
              : `${summary.medianDistance.toFixed(2)} Mpc`}
          </strong>
          <small>{summary.distanceKnown} measured</small>
        </div>
        <div
          className="atlas-stat"
          title="Adopted distance method TRGB or rgb, among selected galaxies with finite positive distances; source-native LV method, not all historical measurements"
        >
          <span>TRGB distances</span>
          <strong>
            {methodKnown ? trgbCount : "—"}{" "}
            <small>/ {summary.distanceKnown}</small>
          </strong>
        </div>
      </div>
      <div className="atlas-results-actions">
        <div
          className="atlas-export-anchor"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setExportOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setExportOpen(false);
          }}
        >
          <button
            type="button"
            aria-expanded={exportOpen}
            aria-controls={exportMenuId}
            aria-label="Export current Atlas selection"
            onClick={() => setExportOpen((open) => !open)}
          >
            Export ▾
          </button>
          {exportOpen ? (
            <div
              id={exportMenuId}
              className="atlas-export-menu"
              role="group"
              aria-label="Export formats"
            >
              <button type="button" onClick={() => void exportSelection("csv")}>
                CSV
              </button>
              <button type="button" onClick={() => void exportSelection("tsv")}>
                TSV
              </button>
              <button
                type="button"
                onClick={() => void exportSelection("json")}
              >
                JSON
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          title="Selection criteria and physical-refresh generation"
          onClick={() => void exportMetadata()}
        >
          Metadata
        </button>
        <div
          className="atlas-share-anchor"
          onPointerLeave={() => setShareStatus(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setShareStatus(null);
          }}
        >
          <button type="button" onClick={() => void share()}>
            Share
          </button>
          {shareStatus !== null ? (
            <span role="status" className="atlas-share-popup">
              {shareStatus}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
