import type { GroupFigure, PlotPoint } from "./groupFigureData.ts";

const W = 1600;
const H = 900;
export const FIGURE_NATIVE_SIZE = { width: W, height: H } as const;
// No title, subtitle, sample count, or UI decoration inside the exported figure.
const RECT = { x: 155, y: 66, w: 1370, h: 682 };
const PALETTE = {
  ink: "#18252e",
  axis: "#25343d",
  grid: "#e5e9ec",
  member: "#145d70",
  host: "#ae6330",
  limit: "#9a5e36",
  background: "#ffffff",
};
type Domain = [number, number];

function domain(
  values: number[],
  explicit?: Domain,
  includeZero = false,
): Domain {
  if (explicit) return explicit;
  if (!values.length) return [0, 1];
  let lo = Math.min(...values),
    hi = Math.max(...values);
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) {
    const span = Math.max(1, Math.abs(lo) * 0.1);
    lo -= span;
    hi += span;
  }
  const pad = (hi - lo) * 0.055;
  return [lo - pad, hi + pad];
}

function ticks(min: number, max: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [];
  const unit = 10 ** Math.floor(Math.log10(span / 5));
  const ratio = span / (5 * unit);
  const step = unit * (ratio > 5 ? 10 : ratio > 2 ? 5 : ratio > 1 ? 2 : 1);
  const initial = Math.ceil(min / step) * step;
  return Array.from(
    { length: 22 },
    (_, index) => initial + index * step,
  ).filter((number) => number >= min - 1e-10 && number <= max + 1e-10);
}
function display(value: number): string {
  if (Math.abs(value) < 1e-9) return "0";
  return Math.abs(value) >= 100
    ? value.toFixed(0)
    : Math.abs(value) >= 10
      ? value.toFixed(1).replace(/\.0$/, "")
      : value.toFixed(2).replace(/\.?0+$/, "");
}

/** Draw plain-text plot labels with real small lowered subscripts.
 * Canvas is not HTML; treating literal underscores as glyphs is not typesetting. */
function drawScientificAxisLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
): void {
  const runs: { value: string; sub: boolean }[] = [];
  const pattern = /_([A-Za-z0-9]+)/g;
  let last = 0;
  for (
    let match = pattern.exec(label);
    match !== null;
    match = pattern.exec(label)
  ) {
    if (match.index > last)
      runs.push({ value: label.slice(last, match.index), sub: false });
    runs.push({ value: match[1], sub: true });
    last = match.index + match[0].length;
  }
  if (last < label.length) runs.push({ value: label.slice(last), sub: false });
  const mainFont = "29px Georgia, 'Times New Roman', serif";
  const smallFont = "21px Georgia, 'Times New Roman', serif";
  const widths = runs.map((run) => {
    ctx.font = run.sub ? smallFont : mainFont;
    return ctx.measureText(run.value).width;
  });
  const total = widths.reduce((sum, width) => sum + width, 0);
  ctx.save();
  ctx.textAlign = "left";
  ctx.fillStyle = PALETTE.ink;
  let cursor = x - total / 2;
  runs.forEach((run, i) => {
    ctx.font = run.sub ? smallFont : mainFont;
    ctx.fillText(run.value, cursor, y + (run.sub ? 9 : 0));
    cursor += widths[i];
  });
  ctx.restore();
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  open = false,
): void {
  ctx.beginPath();
  ctx.arc(x, y, 6.3, 0, 2 * Math.PI);
  ctx.fillStyle = open ? "white" : color;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}
function cross(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y + 10);
  ctx.strokeStyle = PALETTE.host;
  ctx.lineWidth = 3;
  ctx.stroke();
}
function upperLimit(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  dot(ctx, x, y, PALETTE.limit, true);
  ctx.strokeStyle = PALETTE.limit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x, y + 31);
  ctx.moveTo(x - 6, y + 24);
  ctx.lineTo(x, y + 31);
  ctx.lineTo(x + 6, y + 24);
  ctx.stroke();
}

/** The shared plot transform guarantees hover positions coincide with JPEG dots. */
function plotCoordinates(plot: GroupFigure) {
  const halfBin = plot.kind === "histogram" ? (plot.binWidth ?? 0) / 2 : 0;
  const xs = plot.points.flatMap(({ x, xErrorMinus, xErrorPlus }) => [
    x - halfBin - (xErrorMinus ?? 0),
    x + halfBin + (xErrorPlus ?? 0),
  ]);
  const ys = plot.points.flatMap(({ y, yErrorMinus, yErrorPlus }) => [
    y - (yErrorMinus ?? 0),
    y + (yErrorPlus ?? 0),
    ...(plot.kind === "histogram" && y > 0
      ? [Math.max(0, y - Math.sqrt(y)), y + Math.sqrt(y)]
      : []),
  ]);
  const [xMin, xMax] = domain(xs, plot.xDomain);
  const [yMin, yMax] = domain(ys, plot.yDomain, plot.kind !== "scatter");
  function px(x: number): number {
    return RECT.x + (RECT.w * (x - xMin)) / (xMax - xMin);
  }
  function py(y: number): number {
    return RECT.y + RECT.h * (1 - (y - yMin) / (yMax - yMin));
  }
  return { xMin, xMax, yMin, yMax, px, py };
}

/** Individual measurements only: histogram bins do not identify a single galaxy. */
export function figureImageHits(plot: GroupFigure): {
  pixelX: number;
  pixelY: number;
  point: PlotPoint;
}[] {
  if (plot.kind !== "scatter" || plot.unavailable) return [];
  const { px, py } = plotCoordinates(plot);
  return plot.points
    .filter(
      (point) =>
        typeof point.pgc === "number" &&
        Number.isSafeInteger(point.pgc) &&
        point.pgc > 0,
    )
    .map((point) => ({ pixelX: px(point.x), pixelY: py(point.y), point }))
    .filter(
      (hit) =>
        Number.isFinite(hit.pixelX) &&
        Number.isFinite(hit.pixelY) &&
        hit.pixelX >= RECT.x &&
        hit.pixelX <= RECT.x + RECT.w &&
        hit.pixelY >= RECT.y &&
        hit.pixelY <= RECT.y + RECT.h,
    );
}

/** The export is a publication-style raster figure: scientific axes and data, without embedded UI headings. */
export function renderGroupFigureJpeg(plot: GroupFigure): string {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot get a 2D canvas context");
  ctx.fillStyle = PALETTE.background;
  ctx.fillRect(0, 0, W, H);
  if (plot.points.length === 0 || plot.unavailable) {
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "center";
    ctx.font = "27px Arial, sans-serif";
    ctx.fillText(
      plot.unavailable ?? "No eligible measurements",
      W / 2,
      H / 2,
      W - 170,
    );
    return canvas.toDataURL("image/jpeg", 0.94);
  }

  const { xMin, xMax, yMin, yMax, px, py } = plotCoordinates(plot);

  ctx.save();
  ctx.textAlign = "center";
  for (const t of ticks(xMin, xMax)) {
    const x = px(t);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, RECT.y);
    ctx.lineTo(x, RECT.y + RECT.h);
    ctx.stroke();
    ctx.fillStyle = PALETTE.axis;
    ctx.font = "23px Arial, sans-serif";
    ctx.fillText(display(t), x, RECT.y + RECT.h + 37);
  }
  for (const t of ticks(yMin, yMax)) {
    const y = py(t);
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(RECT.x, y);
    ctx.lineTo(RECT.x + RECT.w, y);
    ctx.stroke();
    ctx.fillStyle = PALETTE.axis;
    ctx.textAlign = "right";
    ctx.font = "23px Arial, sans-serif";
    ctx.fillText(display(t), RECT.x - 17, y + 8);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(RECT.x, RECT.y, RECT.w, RECT.h);
  ctx.clip();
  for (const ref of plot.references ?? []) {
    if (ref.axis === "x" && (ref.at < xMin || ref.at > xMax)) continue;
    if (ref.axis === "y" && (ref.at < yMin || ref.at > yMax)) continue;
    const x = ref.axis === "x" ? px(ref.at) : RECT.x;
    const y = ref.axis === "y" ? py(ref.at) : RECT.y;
    ctx.strokeStyle = ref.style === "dashed" ? "#8a969e" : "#9cabb3";
    ctx.lineWidth = 1.7;
    ctx.setLineDash(ref.style === "dashed" ? [9, 6] : []);
    ctx.beginPath();
    if (ref.axis === "x") {
      ctx.moveTo(x, RECT.y);
      ctx.lineTo(x, RECT.y + RECT.h);
    } else {
      ctx.moveTo(RECT.x, y);
      ctx.lineTo(RECT.x + RECT.w, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Issue #85: optional straight reference relations in the native Group Page renderer.
  // The viewport is already clipped above, so extrapolated segments are not drawn outside it.
  for (const relation of plot.lines ?? []) {
    ctx.save();
    ctx.strokeStyle = "#86929a";
    ctx.lineWidth = 1.65;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(px(xMin), py(relation.slope * xMin + relation.intercept));
    ctx.lineTo(px(xMax), py(relation.slope * xMax + relation.intercept));
    ctx.stroke();
    ctx.restore();
  }
  if (plot.kind === "scatter") {
    const colors: Record<string, string> = {
      "T ≤ 2": "#8b4d5d",
      "3 ≤ T ≤ 8": "#146b82",
      "T = 9": "#a47e21",
      "T = 10": "#68758b",
    };
    for (const point of plot.points) {
      const x = px(point.x),
        y = py(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      // Measurement-only 1σ bars; missing uncertainty is not replaced by zero.
      const xlo = point.xErrorMinus,
        xhi = point.xErrorPlus;
      const ylo = point.yErrorMinus,
        yhi = point.yErrorPlus;
      ctx.save();
      ctx.strokeStyle = "#647986";
      ctx.lineWidth = 1.5;
      if (xlo !== undefined && xhi !== undefined) {
        const a = px(point.x - xlo),
          b = px(point.x + xhi);
        ctx.beginPath();
        ctx.moveTo(a, y);
        ctx.lineTo(b, y);
        ctx.moveTo(a, y - 5);
        ctx.lineTo(a, y + 5);
        ctx.moveTo(b, y - 5);
        ctx.lineTo(b, y + 5);
        ctx.stroke();
      }
      if (ylo !== undefined && yhi !== undefined) {
        const a = py(point.y - ylo),
          b = py(point.y + yhi);
        ctx.beginPath();
        ctx.moveTo(x, a);
        ctx.lineTo(x, b);
        ctx.moveTo(x - 5, a);
        ctx.lineTo(x + 5, a);
        ctx.moveTo(x - 5, b);
        ctx.lineTo(x + 5, b);
        ctx.stroke();
      }
      ctx.restore();
      if (point.root) cross(ctx, x, y);
      else if (point.upperLimit) upperLimit(ctx, x, y);
      else dot(ctx, x, y, colors[point.category ?? ""] ?? PALETTE.member);
    }
  } else if (plot.kind === "histogram") {
    const width = plot.binWidth ?? 1;
    ctx.fillStyle = "#a8c6cf";
    ctx.strokeStyle = PALETTE.member;
    ctx.lineWidth = 2;
    for (const point of plot.points) {
      const left = px(point.x - width / 2),
        right = px(point.x + width / 2),
        top = py(point.y),
        base = py(0);
      ctx.fillRect(
        left + 1.2,
        top,
        Math.max(1, right - left - 2.4),
        base - top,
      );
      ctx.strokeRect(
        left + 1.2,
        top,
        Math.max(1, right - left - 2.4),
        base - top,
      );
      if (point.y > 0) {
        const cx = (left + right) / 2;
        const yLow = py(Math.max(0, point.y - Math.sqrt(point.y)));
        const yHigh = py(point.y + Math.sqrt(point.y));
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx, yLow);
        ctx.lineTo(cx, yHigh);
        ctx.moveTo(cx - 5, yLow);
        ctx.lineTo(cx + 5, yLow);
        ctx.moveTo(cx - 5, yHigh);
        ctx.lineTo(cx + 5, yHigh);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.member;
        ctx.lineWidth = 2;
      }
    }
  } else {
    ctx.strokeStyle = PALETTE.member;
    ctx.lineWidth = 3;
    ctx.beginPath();
    let previous: PlotPoint | null = null;
    for (const point of plot.points) {
      if (previous === null) ctx.moveTo(px(point.x), py(point.y));
      else {
        ctx.lineTo(px(point.x), py(previous.y));
        ctx.lineTo(px(point.x), py(point.y));
      }
      previous = point;
    }
    ctx.stroke();
  }
  if (plot.rug?.length) {
    ctx.strokeStyle = "#38525e";
    ctx.lineWidth = 1.6;
    const bottom = RECT.y + RECT.h;
    for (const x of plot.rug) {
      ctx.beginPath();
      ctx.moveTo(px(x), bottom - 10);
      ctx.lineTo(px(x), bottom);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.strokeStyle = PALETTE.axis;
  ctx.lineWidth = 2;
  ctx.strokeRect(RECT.x, RECT.y, RECT.w, RECT.h);
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = "center";
  ctx.font = "29px Georgia, 'Times New Roman', serif";
  drawScientificAxisLabel(ctx, plot.xLabel, RECT.x + RECT.w / 2, H - 59);
  ctx.save();
  ctx.translate(48, RECT.y + RECT.h / 2);
  ctx.rotate(-Math.PI / 2);
  drawScientificAxisLabel(ctx, plot.yLabel, 0, 0);
  ctx.restore();
  // A reference-line label is a scientific legend, not an interface heading.
  if (plot.lines?.length && plot.lines[0].label) {
    ctx.save();
    ctx.fillStyle = PALETTE.axis;
    ctx.textAlign = "left";
    ctx.font = "21px Arial, sans-serif";
    ctx.fillText(plot.lines[0].label, RECT.x + 26, RECT.y + 34);
    ctx.restore();
  }
  // Legitimate legend (not a figure title): categories are otherwise ambiguous.
  if (plot.key === "morphological-segregation") {
    const entries = [
      ["T ≤ 2", "#8b4d5d"],
      ["3 ≤ T ≤ 8", "#146b82"],
      ["T = 9", "#a47e21"],
      ["T = 10", "#68758b"],
    ] as const;
    ctx.textAlign = "left";
    ctx.font = "20px Arial, sans-serif";
    entries.forEach(([label, color], i) => {
      const x = 230 + i * 305;
      ctx.beginPath();
      ctx.arc(x, H - 19, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(label, x + 13, H - 12);
    });
  }
  if (plot.key === "gas-content") {
    ctx.fillStyle = PALETTE.limit;
    ctx.font = "19px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("↓ upper limits", RECT.x + RECT.w, H - 12);
  }
  return canvas.toDataURL("image/jpeg", 0.94);
}
