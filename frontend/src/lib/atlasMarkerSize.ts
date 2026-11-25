import { markerDiameter } from "./reticle.ts";

export type AtlasSizeMode = "fixed" | "absoluteB";
export type AtlasMarkerDensity = "small" | "normal" | "large";
const BASE_DIAMETER: Record<AtlasMarkerDensity, number> = {
  small: 4,
  normal: 6,
  large: 8,
};
export const ATLAS_SIZE_OPTIONS: readonly {
  value: AtlasSizeMode;
  label: string;
  title: string;
}[] = [
  { value: "fixed", label: "Fixed", title: "Equal-size galaxy symbols" },
  {
    value: "absoluteB",
    label: "B luminosity",
    title:
      "Symbol diameter based on absolute B magnitude, not physical diameter",
  },
];
export const ATLAS_DENSITY_OPTIONS: readonly {
  value: AtlasMarkerDensity;
  label: string;
}[] = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];
export function atlasMarkerDiameter(
  mode: AtlasSizeMode,
  density: AtlasMarkerDensity,
  absBMag: number | null | undefined,
): number {
  const base = BASE_DIAMETER[density];
  if (mode === "fixed") return base;
  // Exact existing 2D overview magnitude mapping (6..12 px), scaled to the chosen visual density.
  return Math.round((markerDiameter(absBMag ?? null, 12) * base) / 6);
}
export function atlasMarkerHitRadius(diameter: number): number {
  return Math.max(5, diameter / 2 + 1);
}
export function atlasMarkerHaloDiameter(diameter: number): number {
  return diameter + 11;
}
