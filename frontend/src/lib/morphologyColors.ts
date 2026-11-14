/** Numeric de Vaucouleurs T -> continuous blue-to-red scale for the LV atlas. */
export const UNKNOWN_MORPHOLOGY_COLOR = "#919aa3";

// The visible reference spans T=-3 to T=+10. Earlier types are clamped
// to the cool endpoint and later types to the warm endpoint, not discarded.
const STOPS = [
  [-3, "#30123b"],
  [-2, "#466be3"],
  [0, "#17b3eb"],
  [2, "#2be084"],
  [5, "#ecf33b"],
  [8, "#f88021"],
  [10, "#8b0f11"],
] as const;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) =>
    parseInt(hex.slice(index, index + 2), 16),
  ) as [number, number, number];
}

/** Missing/invalid T is visibly neutral. Never infer T from type_name. */
export function morphologyColor(type: unknown): string {
  if (typeof type !== "number" || !Number.isFinite(type)) {
    return UNKNOWN_MORPHOLOGY_COLOR;
  }
  if (type <= STOPS[0][0]) return STOPS[0][1];
  const last = STOPS[STOPS.length - 1];
  if (type >= last[0]) return last[1];
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const [leftT, leftHex] = STOPS[i];
    const [rightT, rightHex] = STOPS[i + 1];
    if (type === leftT) return leftHex;
    if (type <= rightT) {
      const fraction = (type - leftT) / (rightT - leftT);
      const a = rgb(leftHex);
      const b = rgb(rightHex);
      return `#${a
        .map((channel, index) =>
          Math.round(channel + (b[index] - channel) * fraction)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`;
    }
  }
  return last[1];
}

/** Legend stops exactly match the colors assigned to map sources. */
export const MORPHOLOGY_GRADIENT = `linear-gradient(to right, ${STOPS.map(
  ([type, color]) => `${color} ${(((type + 3) / 13) * 100).toFixed(3)}%`,
).join(", ")})`;
