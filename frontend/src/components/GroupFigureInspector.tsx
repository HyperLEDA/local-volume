import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { GroupDetail } from "../api/groups.ts";
import type { GroupFigure, PlotPoint } from "../lib/groupFigureData.ts";
import { figureImageHits, FIGURE_NATIVE_SIZE } from "../lib/groupFigureJpeg.ts";

type HoveredGalaxy = {
  point: PlotPoint;
  left: number;
  top: number;
};

function formatted(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "—";
  const text = value.toFixed(decimals);
  return decimals === 0
    ? text
    : text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function TooltipMeasurements({
  figure,
  point,
  group,
}: {
  figure: GroupFigure;
  point: PlotPoint;
  group?: GroupDetail;
}) {
  const sat = group?.members.find((member) => member.pgc === point.pgc);
  const md = group?.members.find((member) => member.pgc === group.root_pgc);
  if (figure.key === "group-depth") {
    return (
      <>
        <div>
          R<sub>p</sub> = {formatted(point.x, 1)} kpc
        </div>
        <div>
          D<sub>sat</sub> ={" "}
          {typeof sat?.dist_mpc === "number" ? formatted(sat.dist_mpc, 3) : "—"}{" "}
          Mpc
        </div>
        <div>
          D<sub>sat</sub> − D<sub>MD</sub> = {formatted(point.y, 3)} Mpc
        </div>
        {typeof md?.dist_mpc === "number" && (
          <div>
            D<sub>MD</sub> = {formatted(md.dist_mpc, 3)} Mpc
          </div>
        )}
      </>
    );
  }
  if (figure.key === "projected-phase-space") {
    return (
      <>
        <div>
          R<sub>p</sub> = {formatted(point.x, 1)} kpc
        </div>
        <div>
          ΔV<sub>LG</sub> = {formatted(point.y, 1)} km/s
        </div>
      </>
    );
  }
  if (figure.key === "velocity-distance") {
    return (
      <>
        <div>D = {formatted(point.x, 3)} Mpc</div>
        <div>
          V<sub>LG</sub> = {formatted(point.y, 1)} km/s
        </div>
      </>
    );
  }
  if (figure.key === "morphological-segregation") {
    return (
      <>
        <div>
          R<sub>p</sub> = {formatted(point.x, 1)} kpc
        </div>
        <div>T = {formatted(point.y, 0)}</div>
      </>
    );
  }
  if (figure.key === "gas-content") {
    return (
      <>
        <div>
          R<sub>p</sub> = {formatted(point.x, 1)} kpc
        </div>
        <div>
          log₁₀(M<sub>HI</sub>/M<sub>26</sub>) {point.upperLimit ? "<" : "="}{" "}
          {formatted(point.y, 3)}
        </div>
      </>
    );
  }
  return (
    <>
      <div>
        {figure.xLabel} = {formatted(point.x, 3)}
      </div>
      <div>
        {figure.yLabel} = {formatted(point.y, 3)}
      </div>
    </>
  );
}

/**
 * Overlay hit testing reuses the exact position model of the JPEG renderer.
 * Binned/aggregate curves have no individual PGC, so remain non-clickable.
 * Pinning changes only the popup state; it never changes a scientific value.
 */
export function GroupFigureInspector({
  figure,
  group,
  imageUrl,
}: {
  figure: GroupFigure;
  group?: GroupDetail;
  imageUrl: string;
}) {
  const inspectorRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const hits = useMemo(() => figureImageHits(figure), [figure]);
  const [hover, setHover] = useState<HoveredGalaxy | null>(null);
  const [pinned, setPinned] = useState<HoveredGalaxy | null>(null);

  // Opening another figure must not retain a popup from the previous one.
  useEffect(() => {
    setHover(null);
    setPinned(null);
  }, [figure.key, group?.root_pgc, group?.definition]);

  useEffect(() => {
    if (pinned === null) return;
    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !inspectorRef.current?.contains(event.target)
      )
        setPinned(null);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // An Escape to unpin must not close the parent modal.
        event.preventDefault();
        event.stopPropagation();
        setPinned(null);
        setHover(null);
      }
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    window.addEventListener("keydown", dismissEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      window.removeEventListener("keydown", dismissEscape, true);
    };
  }, [pinned]);

  function hitAt(event: MouseEvent<HTMLImageElement>): HoveredGalaxy | null {
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    const nativeX =
      ((event.clientX - bounds.left) * FIGURE_NATIVE_SIZE.width) / bounds.width;
    const nativeY =
      ((event.clientY - bounds.top) * FIGURE_NATIVE_SIZE.height) /
      bounds.height;
    const threshold = Math.max(
      14,
      (12 * FIGURE_NATIVE_SIZE.width) / bounds.width,
    );
    let closest: (typeof hits)[number] | null = null;
    let nearest = threshold * threshold;
    for (const hit of hits) {
      if (
        typeof hit.point.pgc !== "number" ||
        !Number.isSafeInteger(hit.point.pgc) ||
        hit.point.pgc <= 0
      )
        continue;
      const distanceSquared =
        (nativeX - hit.pixelX) ** 2 + (nativeY - hit.pixelY) ** 2;
      if (distanceSquared < nearest) {
        nearest = distanceSquared;
        closest = hit;
      }
    }
    if (!closest) return null;
    const x = (closest.pixelX / FIGURE_NATIVE_SIZE.width) * bounds.width;
    const y = (closest.pixelY / FIGURE_NATIVE_SIZE.height) * bounds.height;
    return {
      point: closest.point,
      left: Math.max(5, Math.min(x + 15, bounds.width - 225)),
      top: Math.max(5, Math.min(y + 12, bounds.height - 132)),
    };
  }

  const shown = pinned ?? hover;
  return (
    <div
      ref={inspectorRef}
      className="group-figure-inspector"
      onMouseLeave={() => setHover(null)}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt={`${figure.title}. Hover over a galaxy for measurements; click a plotted galaxy to pin its details.`}
        onMouseMove={(event) => {
          if (pinned === null) setHover(hitAt(event));
        }}
        onClick={(event) => {
          setPinned(hitAt(event));
          setHover(null);
        }}
      />
      {shown && shown.point.pgc ? (
        <div
          className={`group-figure-tooltip${pinned ? " group-figure-tooltip--pinned" : ""}`}
          role={pinned ? "group" : "status"}
          aria-label={pinned ? "Pinned galaxy measurements" : undefined}
          style={{ left: shown.left, top: shown.top }}
          onMouseMove={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <a href={`/object/${shown.point.pgc}`}>
            {shown.point.name?.trim() || `PGC ${shown.point.pgc}`}
          </a>
          <TooltipMeasurements
            figure={figure}
            point={shown.point}
            group={group}
          />
          {pinned && (
            <button
              type="button"
              className="group-figure-tooltip-close"
              aria-label="Unpin galaxy measurements"
              onClick={() => {
                setPinned(null);
                setHover(null);
              }}
            >
              ×
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
