import { useMemo, useRef, useState, type MouseEvent } from "react";
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
  group: GroupDetail;
}) {
  const sat = group.members.find((member) => member.pgc === point.pgc);
  const md = group.members.find((member) => member.pgc === group.root_pgc);
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

/** Plot-position model is shared with the native JPEG renderer; no guessed pixels.
 * Scatter measurements have one-to-one PGC identities. Binned histograms and
 * aggregate step curves are intentionally not presented as individual galaxies. */
export function GroupFigureInspector({
  figure,
  group,
  imageUrl,
}: {
  figure: GroupFigure;
  group: GroupDetail;
  imageUrl: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const hits = useMemo(() => figureImageHits(figure), [figure]);
  const [hover, setHover] = useState<HoveredGalaxy | null>(null);

  function track(event: MouseEvent<HTMLImageElement>): void {
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
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
      const distanceSquared =
        (nativeX - hit.pixelX) ** 2 + (nativeY - hit.pixelY) ** 2;
      if (distanceSquared < nearest) {
        nearest = distanceSquared;
        closest = hit;
      }
    }
    if (!closest) {
      setHover(null);
      return;
    }
    const x = (closest.pixelX / FIGURE_NATIVE_SIZE.width) * bounds.width;
    const y = (closest.pixelY / FIGURE_NATIVE_SIZE.height) * bounds.height;
    setHover({
      point: closest.point,
      left: Math.max(5, Math.min(x + 15, bounds.width - 238)),
      top: Math.max(5, Math.min(y + 12, bounds.height - 132)),
    });
  }

  return (
    <div className="group-figure-inspector" onMouseLeave={() => setHover(null)}>
      <img
        ref={imageRef}
        src={imageUrl}
        alt={figure.title}
        onMouseMove={track}
        onMouseLeave={() => {
          /* Keep tooltip visible as pointer moves onto its link. */
        }}
      />
      {hover && hover.point.pgc ? (
        <div
          className="group-figure-tooltip"
          role="status"
          style={{ left: hover.left, top: hover.top }}
          onMouseMove={(event) => event.stopPropagation()}
        >
          <a href={`/object/${hover.point.pgc}`}>
            {hover.point.name?.trim() || `PGC ${hover.point.pgc}`}
          </a>
          <TooltipMeasurements
            figure={figure}
            point={hover.point}
            group={group}
          />
        </div>
      ) : null}
    </div>
  );
}
