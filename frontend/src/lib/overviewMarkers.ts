import type { AladinSource } from "aladin-lite";
import { morphologyColor } from "./morphologyColors.ts";

/** The global map uses 7..14 px; object detail maps retain their 7..18 px cap. */
export const OVERVIEW_MARKER_MAX_DIAMETER = 14;
export const OVERVIEW_MARKER_STROKE_WIDTH = 1.5;
export const SELECTED_OBJECT_CROSS_COLOR = "#f6e5a8";
export const SELECTED_OBJECT_CROSS_LINE_WIDTH = 1.5;

function drawCircleOutline(
  source: AladinSource,
  ctx: CanvasRenderingContext2D,
  strokeStyle: string,
  lineWidth: number,
): boolean {
  const x = source.x;
  const y = source.y;
  const diameter = source.size ?? 7;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(diameter) ||
    diameter <= lineWidth
  ) {
    return false;
  }

  ctx.beginPath();
  ctx.arc(x, y, (diameter - lineWidth) / 2, 0, 2 * Math.PI);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  return true;
}

/** Custom A.catalog(shape) drawing for all-sky markers. */
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
  drawCircleOutline(
    source,
    ctx,
    morphologyColor(source.data?.morphology_t),
    OVERVIEW_MARKER_STROKE_WIDTH,
  );
  ctx.restore();
}

/** Selected object marker on object pages: circle in T-color plus a straight cross. */
export function drawSelectedObjectMarker(
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
  drawCircleOutline(
    source,
    ctx,
    morphologyColor(source.data?.morphology_t),
    OVERVIEW_MARKER_STROKE_WIDTH,
  );

  const arm = Math.max(4, diameter * 0.34);
  ctx.beginPath();
  ctx.moveTo(x - arm, y);
  ctx.lineTo(x + arm, y);
  ctx.moveTo(x, y - arm);
  ctx.lineTo(x, y + arm);
  ctx.strokeStyle = SELECTED_OBJECT_CROSS_COLOR;
  ctx.lineWidth = SELECTED_OBJECT_CROSS_LINE_WIDTH;
  ctx.stroke();
  ctx.restore();
}
