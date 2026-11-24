import type { AladinSource } from "aladin-lite";
import { morphologyColor } from "./morphologyColors.ts";
import { tidalStrokeWidth } from "./tidalMarker.ts";

/** The global map uses 6..12 px; object detail maps use 6..18 px. */
export const OVERVIEW_MARKER_MAX_DIAMETER = 12;
export const OVERVIEW_MARKER_STROKE_WIDTH = 1.5;
export const SELECTED_OBJECT_CROSS_COLOR = "#f6e5a8";
export const SELECTED_OBJECT_CROSS_LINE_WIDTH = 1.5;

/** Keep the catalogue-owned diameter independent of Aladin's source.size.
 * Existing callers without this field retain their native size.
 */
function markerDisplayDiameter(source: AladinSource): number {
  const diameter = source.data?.lv_marker_diameter;
  return typeof diameter === "number" &&
    Number.isFinite(diameter) &&
    diameter >= 4
    ? diameter
    : (source.size ?? 7);
}

function drawCircleOutline(
  source: AladinSource,
  ctx: CanvasRenderingContext2D,
  strokeStyle: string,
  lineWidth: number,
): boolean {
  const x = source.x;
  const y = source.y;
  const diameter = markerDisplayDiameter(source);
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
  // A 0.05 px white rim on either edge of the colored stroke.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.68)";
  ctx.lineWidth = lineWidth + 0.1;
  ctx.stroke();
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
  const diameter = markerDisplayDiameter(source);
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
    tidalStrokeWidth(
      source.data?.theta1,
      source.data?.tidal_min,
      source.data?.tidal_max,
    ),
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
  const diameter = markerDisplayDiameter(source);
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
