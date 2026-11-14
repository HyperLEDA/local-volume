/** de Vaucouleurs numeric T: ColorBrewer RdBu_r, blue early -> red late. */
export const UNKNOWN_MORPHOLOGY_COLOR = "#919aa3";

const T_MIN = -3;
const T_MAX = 10;

// Eleven ColorBrewer RdBu colors in reverse of the canonical red-to-blue order.
const RDBU_REVERSED = [
  "#053061",
  "#2166ac",
  "#4393c3",
  "#92c5de",
  "#d1e5f0",
  "#f7f7f7",
  "#fddbc7",
  "#f4a582",
  "#d6604d",
  "#b2182b",
  "#67001f",
] as const;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) =>
    parseInt(hex.slice(index, index + 2), 16),
  ) as [number, number, number];
}

/** Missing/invalid values remain gray; valid T is clamped to [-3, 10]. */
export function morphologyColor(type: unknown): string {
  if (typeof type !== "number" || !Number.isFinite(type)) {
    return UNKNOWN_MORPHOLOGY_COLOR;
  }

  const fraction =
    (Math.max(T_MIN, Math.min(T_MAX, type)) - T_MIN) / (T_MAX - T_MIN);
  const position = fraction * (RDBU_REVERSED.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return RDBU_REVERSED[lower];

  const start = rgb(RDBU_REVERSED[lower]);
  const end = rgb(RDBU_REVERSED[upper]);
  const mix = position - lower;
  return `#${start
    .map((channel, index) =>
      Math.round(channel + (end[index] - channel) * mix)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Kept in sync with source colors; not rendered as a legend in the overview UI.
export const MORPHOLOGY_GRADIENT = `linear-gradient(to right, ${RDBU_REVERSED.map(
  (color, index) => `${color} ${(index * 100) / (RDBU_REVERSED.length - 1)}%`,
).join(", ")})`;
