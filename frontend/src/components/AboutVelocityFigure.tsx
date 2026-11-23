import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { GroupFigure } from "../lib/groupFigureData.ts";
import { groupFigureCsv } from "../lib/groupFigureData.ts";
import { renderGroupFigureJpeg } from "../lib/groupFigureJpeg.ts";
import { GroupFigureInspector } from "./GroupFigureInspector.tsx";
import "../styles/groups.css";

/** Same scientific figure renderer, native dialog and point inspector as Group Page. */
export type AboutVelocityDatum = {
  pgc: number;
  name: string;
  distance: number;
  velocity: number;
  method: string;
};

type PlotMethods = {
  dataset: string;
  retrieved_at_utc: string;
  plotted_count: number;
  plotted_pgcs: number[];
  [key: string]: unknown;
};

const HUBBLE_REFERENCE = 70; // km/s/Mpc, illustrative reference; never fitted.

export function buildAboutVelocityGroupFigure(
  rows: readonly AboutVelocityDatum[],
): GroupFigure {
  const velocityBounds = rows.map((row) => row.velocity);
  const minV = Math.min(-400, ...velocityBounds);
  const maxV = Math.max(1200, 11 * HUBBLE_REFERENCE, ...velocityBounds);
  return {
    key: "velocity-distance",
    title: "The nearby velocity field",
    xLabel: "D [Mpc]",
    yLabel: "V_LG [km s⁻¹]",
    subtitle: "Local Group velocities and adopted TRGB distances",
    kind: "scatter",
    xDomain: [0, 11],
    yDomain: [Math.floor(minV / 200) * 200, Math.ceil(maxV / 200) * 200],
    lines: [
      { slope: HUBBLE_REFERENCE, intercept: 0, label: "H₀ = 70 km s⁻¹ Mpc⁻¹" },
    ],
    points: rows.map((row) => ({
      pgc: row.pgc,
      name: row.name,
      x: row.distance,
      y: row.velocity,
    })),
    csvRows: rows.map((row) => ({
      pgc: row.pgc,
      name: row.name,
      distance_mpc: row.distance,
      v_lg_kms: row.velocity,
      distance_method: row.method,
    })),
  };
}

function saveFile(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function AboutVelocityFigure({
  rows,
  methods,
  loading = false,
  failed = false,
}: {
  rows: readonly AboutVelocityDatum[];
  methods: PlotMethods | null;
  loading?: boolean;
  failed?: boolean;
}) {
  const figure = useMemo(() => buildAboutVelocityGroupFigure(rows), [rows]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    setImageUrl(null);
    setImageError(false);
    const handle = window.setTimeout(() => {
      if (cancelled) return;
      if (!figure.points.length) return;
      try {
        const result = renderGroupFigureJpeg(figure);
        setImageUrl(result);
      } catch {
        setImageError(true);
      }
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [figure]);

  function downloadJpeg() {
    if (!imageUrl) return;
    const anchor = document.createElement("a");
    anchor.href = imageUrl;
    anchor.download = "lv-leda-trgb-vlg.jpg";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function downloadPng() {
    if (!imageUrl) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { alpha: false });
      if (context) {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) saveFile(blob, "lv-leda-trgb-vlg.png");
        }, "image/png");
      }
    };
    image.src = imageUrl;
  }

  function downloadCsv() {
    if (!rows.length) return;
    saveFile(
      new Blob(["\uFEFF", groupFigureCsv(figure)], {
        type: "text/csv;charset=utf-8",
      }),
      "lv-leda-trgb-vlg.csv",
    );
  }

  function downloadMethods() {
    if (!methods) return;
    saveFile(
      new Blob([JSON.stringify(methods, null, 2), "\n"], {
        type: "application/json;charset=utf-8",
      }),
      "lv-leda-trgb-vlg-method.json",
    );
  }

  return (
    <figure
      className="about-v19-velocity group-figure"
      aria-labelledby="about-v10-flow-title"
    >
      <div className="group-figure-heading about-v19-velocity-heading">
        <h3 id="about-v10-flow-title">The nearby velocity field</h3>
        {rows.length > 0 && (
          <span className="about-v19-count">{rows.length} galaxies</span>
        )}
      </div>
      {imageUrl ? (
        <button
          type="button"
          className="group-figure-open about-v19-figure-open"
          aria-label="Enlarge the nearby velocity field"
          title="Enlarge figure"
          onClick={() => dialogRef.current?.showModal()}
        >
          <img
            src={imageUrl}
            alt="Distance–velocity diagram for Local Volume galaxies with TRGB distances and a Hubble-law reference"
          />
        </button>
      ) : (
        <div
          className="group-figure-pending about-v19-figure-pending"
          role="status"
        >
          {imageError || failed
            ? "Diagram unavailable"
            : loading
              ? "Preparing figure…"
              : "No eligible galaxies"}
        </div>
      )}
      <figcaption className="about-v19-velocity-caption">
        <span>
          Galaxies with adopted TRGB distances and velocities in the Local Group
          frame. The dashed line shows the Hubble-law reference for H
          <sub>0</sub> = 70 km s<sup>−1</sup> Mpc<sup>−1</sup>.
        </span>
        <div className="group-figure-actions">
          {imageUrl && (
            <button type="button" onClick={downloadJpeg}>
              JPEG
            </button>
          )}
          {imageUrl && (
            <button type="button" onClick={downloadPng}>
              PNG
            </button>
          )}
          <button type="button" disabled={!rows.length} onClick={downloadCsv}>
            CSV
          </button>
        </div>
      </figcaption>
      <dialog
        ref={dialogRef}
        className="group-figure-dialog about-v19-figure-dialog"
        aria-label="Enlarged nearby velocity field"
        onClick={(event: MouseEvent<HTMLDialogElement>) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="group-figure-dialog-inner">
          <div className="group-figure-dialog-header">
            <h3>The nearby velocity field</h3>
            <button
              type="button"
              aria-label="Close enlarged figure"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </div>
          {imageUrl && (
            <>
              <GroupFigureInspector figure={figure} imageUrl={imageUrl} />
              <div className="group-figure-dialog-actions about-v19-figure-actions">
                <button type="button" onClick={downloadJpeg}>
                  Download JPEG
                </button>
                <button type="button" onClick={downloadPng}>
                  Download PNG
                </button>
                <button type="button" onClick={downloadCsv}>
                  Download CSV
                </button>
                <button type="button" onClick={downloadMethods}>
                  Data &amp; methods
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </figure>
  );
}
