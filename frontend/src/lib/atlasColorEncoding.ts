import type { AtlasSpatialRow } from "./atlasSpatialScene.ts";
import type { AtlasPhotometry } from "./atlasPhotometry.ts";

export type AtlasColorMode =
  | "morphology"
  | "neutral"
  | "distance"
  | "velocity"
  | "absoluteB"
  | "theta"
  | "luminosityK"
  | "massHi"
  | "hiToK"
  | "density"
  | "peculiar";
export type AtlasNumericColorMode = Exclude<
  AtlasColorMode,
  "morphology" | "neutral"
>;
export const ATLAS_COLOR_OPTIONS: readonly {
  value: AtlasColorMode;
  label: string;
  title: string;
}[] = [
  { value: "morphology", label: "Morphology", title: "Morphological type T" },
  {
    value: "neutral",
    label: "Neutral",
    title: "No physical parameter encoded by colour",
  },
  { value: "distance", label: "Distance", title: "Adopted distance in Mpc" },
  {
    value: "velocity",
    label: "VLG",
    title: "Catalogue Local Group velocity in km/s",
  },
  {
    value: "absoluteB",
    label: "MB",
    title: "Catalogue derived absolute B magnitude",
  },
  { value: "theta", label: "Θ₁", title: "Catalogue computed tidal index" },
  {
    value: "luminosityK",
    label: "log Lₖ",
    title: "Computed Ks luminosity, including explicitly estimated photometry",
  },
  {
    value: "massHi",
    label: "log MHI",
    title: "Computed neutral hydrogen mass; upper limits separate",
  },
  {
    value: "hiToK",
    label: "H I / K",
    title: "log(MHI/LKs), not a stellar mass fraction",
  },
  {
    value: "peculiar",
    label: "Vpec",
    title: "Nominal radial Local Group velocity residual, VLG − H₀D",
  },
  {
    value: "density",
    label: "Local density",
    title: "Nominal catalogue sample number density; individual galaxies",
  },
];
const NUMERIC: Record<
  AtlasNumericColorMode,
  { label: string; unit: string; signed: boolean }
> = {
  distance: { label: "Adopted distance", unit: "Mpc", signed: false },
  velocity: { label: "Catalogue VLG", unit: "km/s", signed: true },
  absoluteB: { label: "Absolute B magnitude", unit: "mag", signed: false },
  theta: { label: "Computed Θ₁", unit: "", signed: true },
  luminosityK: { label: "log Lₖ", unit: "log₁₀(L☉)", signed: false },
  massHi: { label: "log MHI", unit: "log₁₀(M☉)", signed: false },
  hiToK: { label: "log(MHI/Lₖ)", unit: "log₁₀(M☉/L☉)", signed: false },
  peculiar: { label: "Radial Vpec, LG", unit: "km/s", signed: true },
  density: { label: "Sample number density", unit: "Mpc⁻³", signed: false },
};
export function atlasNumericDefinition(mode: AtlasColorMode) {
  return mode === "morphology" || mode === "neutral" ? null : NUMERIC[mode];
}
export const ATLAS_MISSING_COLOR = "#89929d";
export const ATLAS_UPPER_LIMIT_COLOR = "#bc8fd1";
export function isPhotometryColor(mode: AtlasColorMode): boolean {
  return mode === "luminosityK" || mode === "massHi" || mode === "hiToK";
}
const SEQUENTIAL = ["#4265be", "#2ca6a1", "#f3d66c"] as const;
const DIVERGING = ["#407acb", "#eee9dc", "#ca7040"] as const;
export type AtlasNumericScale = {
  mode: AtlasNumericColorMode;
  label: string;
  unit: string;
  signed: boolean;
  min: number;
  max: number;
  stops: readonly [string, string, string];
};
export type AtlasColorEncoding = {
  mode: AtlasColorMode;
  scale: AtlasNumericScale | null;
  values: ReadonlyMap<number, number>;
  limits: ReadonlyMap<number, number>;
  estimated: ReadonlySet<number>;
};

export function atlasNumericValue(
  row: AtlasSpatialRow,
  mode: AtlasNumericColorMode,
): number | null {
  if (isPhotometryColor(mode) || mode === "density" || mode === "peculiar")
    return null;
  // Distance uses exactly the spatial contract. Other fields retain the existing catalogue semantics.
  const value =
    mode === "distance"
      ? row.evidence?.dist_mpc
      : mode === "velocity"
        ? row.object.lvg_v_lg_kms
        : mode === "absoluteB"
          ? row.object.abs_b_mag
          : row.object.theta1;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (mode === "distance" && value <= 0)
  )
    return null;
  return value;
}

/** Domain from the positioned Atlas selection, before volume/depth/display filters. */
export function buildAtlasColorEncoding(
  rows: readonly AtlasSpatialRow[],
  mode: AtlasColorMode,
  photometry: AtlasPhotometry | null = null,
  densityValues?: ReadonlyMap<number, number>,
  peculiarVelocityValues?: ReadonlyMap<number, number>,
): AtlasColorEncoding {
  const values = new Map<number, number>();
  const limits = new Map<number, number>();
  const estimated = new Set<number>();
  if (mode === "neutral" || mode === "morphology")
    return { mode, scale: null, values, limits, estimated };
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    if (row.position === null) continue;
    let value =
      mode === "density"
        ? (densityValues?.get(row.object.pgc) ?? null)
        : mode === "peculiar"
          ? (peculiarVelocityValues?.get(row.object.pgc) ?? null)
          : atlasNumericValue(row, mode);
    if (isPhotometryColor(mode)) {
      if (
        !photometry ||
        row.evidence?.distance_computed_revision !== photometry.revision ||
        row.evidence.distance_formula_version !== photometry.formulaVersion
      )
        continue;
      const measurement = photometry.rows.get(row.object.pgc);
      if (!measurement) continue;
      const lk = measurement.log_lks_lsun;
      const hi = measurement.log_mhi_msun;
      value =
        mode === "luminosityK"
          ? lk
          : mode === "massHi"
            ? hi
            : hi !== null && lk !== null
              ? hi - lk
              : null;
      if (value === null || !Number.isFinite(value)) continue;
      if (mode !== "massHi" && measurement.ks_status === "estimated")
        estimated.add(row.object.pgc);
      if (mode !== "luminosityK" && measurement.hi_status === "upper_limit") {
        limits.set(row.object.pgc, value);
        continue;
      }
    }
    if (value === null || !Number.isFinite(value)) continue;
    values.set(row.object.pgc, value);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (!values.size) return { mode, scale: null, values, limits, estimated };
  const definition = NUMERIC[mode];
  if (definition.signed) {
    const extent = Math.max(Math.abs(min), Math.abs(max));
    min = -extent;
    max = extent;
  }
  return {
    mode,
    values,
    limits,
    estimated,
    scale: {
      mode,
      ...definition,
      min,
      max,
      stops: definition.signed ? DIVERGING : SEQUENTIAL,
    },
  };
}

function interpolateHex(a: string, b: string, t: number): string {
  const first = Number.parseInt(a.slice(1), 16);
  const second = Number.parseInt(b.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const left = (first >> shift) & 255;
    const right = (second >> shift) & 255;
    return Math.round(left + (right - left) * t)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

export function atlasNumericColor(
  scale: AtlasNumericScale | null,
  value: number | null | undefined,
): string {
  if (!scale || typeof value !== "number" || !Number.isFinite(value))
    return ATLAS_MISSING_COLOR;
  if (scale.max === scale.min) return scale.stops[1];
  // Avoid overflow for extreme finite endpoints; clamp only against the declared domain.
  const factor = Math.max(Math.abs(scale.min), Math.abs(scale.max), 1);
  const low = scale.min / factor;
  const high = scale.max / factor;
  const fraction =
    high === low
      ? 0.5
      : Math.max(0, Math.min(1, (value / factor - low) / (high - low)));
  return fraction <= 0.5
    ? interpolateHex(scale.stops[0], scale.stops[1], fraction * 2)
    : interpolateHex(scale.stops[1], scale.stops[2], fraction * 2 - 1);
}
export function atlasColorForPgc(
  encoding: AtlasColorEncoding,
  pgc: number,
): string {
  return encoding.limits.has(pgc)
    ? ATLAS_UPPER_LIMIT_COLOR
    : atlasNumericColor(encoding.scale, encoding.values.get(pgc));
}
