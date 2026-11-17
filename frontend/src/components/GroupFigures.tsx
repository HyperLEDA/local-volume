import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { GroupDetail } from "../api/groups.ts";
import { buildGroupFigures, groupFigureCsv } from "../lib/groupFigureData.ts";
import { renderGroupFigureJpeg } from "../lib/groupFigureJpeg.ts";
import { GroupFigureInspector } from "./GroupFigureInspector.tsx";

type Image = { key: string; url: string };

/** Scientific subscripts in UI titles and annotations; no innerHTML. */
function scientificText(value: string): ReactNode {
  const parts = value.split(
    /(ΔV_LG|V_LG|M_HI|M_26|M_B|R_p|R50|D_MD|D_sat|K_s)/g,
  );
  return parts.map((part, i) => {
    const labels: Partial<Record<string, readonly [string, string]>> = {
      ΔV_LG: ["ΔV", "LG"],
      V_LG: ["V", "LG"],
      M_HI: ["M", "HI"],
      M_26: ["M", "26"],
      M_B: ["M", "B"],
      R_p: ["R", "p"],
      R50: ["R", "50"],
      D_MD: ["D", "MD"],
      D_sat: ["D", "sat"],
      K_s: ["K", "s"],
    };
    const label = labels[part];
    return label ? (
      <span key={i}>
        {label[0]}
        <sub>{label[1]}</sub>
      </span>
    ) : (
      part
    );
  });
}

export function GroupFigures({ group }: { group: GroupDetail }) {
  const figures = useMemo(() => buildGroupFigures(group), [group]);
  const [images, setImages] = useState<Image[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    setImages([]);
    setError(null);
    const handle = window.setTimeout(() => {
      try {
        const rendered = figures.map((figure) => ({
          key: figure.key,
          url: renderGroupFigureJpeg(figure),
        }));
        if (!cancelled) setImages(rendered);
      } catch (reason) {
        if (!cancelled) setError(`Figure rendering failed: ${String(reason)}`);
      }
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [figures]);

  const byKey = useMemo(
    () => new Map(images.map((image) => [image.key, image.url])),
    [images],
  );
  const expandedFigure = figures.find((figure) => figure.key === expandedKey);
  const expandedUrl = expandedKey !== null ? byKey.get(expandedKey) : undefined;

  function openFigure(key: string): void {
    if (!byKey.has(key)) return;
    setExpandedKey(key);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }

  function downloadCsv(key: string): void {
    const figure = figures.find((item) => item.key === key);
    if (!figure) return;
    const blob = new Blob(["\uFEFF", groupFigureCsv(figure)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lv-leda-${group.root_pgc}-${group.definition}-${key}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function jpegFilename(key: string): string {
    return `lv-leda-${group.root_pgc}-${group.definition}-${key}.jpg`;
  }

  return (
    <section className="group-figures" aria-labelledby="group-figures-title">
      <h3 id="group-figures-title">Group diagnostics</h3>
      {error && (
        <p role="alert" className="catalog-status catalog-status-error">
          {error}
        </p>
      )}
      <div className="group-figures-grid">
        {figures.map((figure) => (
          <figure key={figure.key} className="group-figure">
            <div className="group-figure-heading">
              <h4>{scientificText(figure.title)}</h4>
            </div>
            {byKey.has(figure.key) ? (
              <button
                className="group-figure-open"
                type="button"
                aria-label={`Enlarge ${figure.title}`}
                title={`Enlarge ${figure.title}`}
                onClick={() => openFigure(figure.key)}
              >
                <img
                  src={byKey.get(figure.key)}
                  alt={`${figure.title}: ${figure.points.length} plotted points or bins`}
                  loading="lazy"
                />
              </button>
            ) : (
              <div className="group-figure-pending" role="status">
                {error ? "Unavailable" : "Rendering figure…"}
              </div>
            )}
            <figcaption>
              <span>{figure.unavailable ? "Insufficient data" : null}</span>
              <div className="group-figure-actions">
                {byKey.has(figure.key) && (
                  <a
                    href={byKey.get(figure.key)}
                    download={jpegFilename(figure.key)}
                  >
                    JPEG
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => downloadCsv(figure.key)}
                  disabled={!figure.csvRows.length}
                >
                  CSV
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      <dialog
        ref={dialogRef}
        className="group-figure-dialog"
        aria-label="Enlarged scientific figure"
        onClose={() => setExpandedKey(null)}
        onClick={(event: MouseEvent<HTMLDialogElement>) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="group-figure-dialog-inner">
          <div className="group-figure-dialog-header">
            <div>
              <h3>{scientificText(expandedFigure?.title ?? "Group figure")}</h3>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close enlarged figure"
            >
              ×
            </button>
          </div>
          {expandedUrl && expandedFigure && (
            <>
              <GroupFigureInspector
                figure={expandedFigure}
                group={group}
                imageUrl={expandedUrl}
              />
              <div className="group-figure-dialog-actions">
                <a
                  href={expandedUrl}
                  download={jpegFilename(expandedFigure.key)}
                >
                  Download JPEG
                </a>
                <button
                  type="button"
                  disabled={!expandedFigure.csvRows.length}
                  onClick={() => downloadCsv(expandedFigure.key)}
                >
                  Download CSV
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </section>
  );
}
