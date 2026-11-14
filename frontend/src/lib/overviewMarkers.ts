import type { AladinSource } from "aladin-lite";
import { morphologyColor } from "./morphologyColors.ts";

/** The global map uses 7..15 px; object detail maps retain their 7..18 px cap. */
export const OVERVIEW_MARKER_MAX_DIAMETER = 15;
export const OVERVIEW_MARKER_STROKE_WIDTH = 1.5;

/** Custom A.catalog(shape) drawing, including A.marker(useMarkerDefaultIcon:false). */
export function drawOverviewMarker(
  source: AladinSource,
  ctx: CanvasRenderingContext2D,
): void {
  const x = source.x;
  const y = source.y;
  const diameter = source.size ?? 7;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(diameter) ||
    diameter <= OVERVIEW_MARKER_STROKE_WIDTH
  ) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, (diameter - OVERVIEW_MARKER_STROKE_WIDTH) / 2, 0, 2 * Math.PI);
  ctx.strokeStyle = morphologyColor(source.data?.morphology_t);
  ctx.lineWidth = OVERVIEW_MARKER_STROKE_WIDTH;
  ctx.stroke();
  ctx.restore();
}
