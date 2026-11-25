import type { AtlasColorMode } from "./atlasColorEncoding.ts";
import type { AtlasIntervalMode } from "./atlasDistanceIntervals.ts";
import type { AtlasMarkerDensity, AtlasSizeMode } from "./atlasMarkerSize.ts";
import type { AtlasLayers } from "./atlasScientificLayers.ts";
import { ATLAS_SHELL_RADII, type AtlasGuides } from "./atlasSpatialGuides.ts";
import type {
  AtlasDisplayMode,
  AtlasProjection,
  AtlasTheme,
} from "./atlasSpatialRenderer.ts";
import type { AtlasDistanceMode } from "./atlasSpatialScene.ts";
import type { ObserverFrame } from "./spatialFrames.ts";
import type { Vec3 } from "./groupGeometry3d.ts";

import { decodeAtlasSlice, type AtlasSlice } from "./atlasSpatialSlice.ts";

import { decodeAtlasRegion, type AtlasRegion } from "./atlasSpatialRegion.ts";

import {
  decodePopulation,
  defaultPopulation,
  type AtlasPopulation,
} from "./atlasPopulation.ts";

import {
  decodeComparison,
  type PopulationComparison,
} from "./atlasPopulationComparison.ts";

export type AtlasPreferences = {
  comparison: PopulationComparison | null;
  population: AtlasPopulation;
  region: AtlasRegion | null;
  slice: AtlasSlice | null;
  frame: ObserverFrame;
  projection: AtlasProjection;
  mode: AtlasDistanceMode;
  displayMode: AtlasDisplayMode;
  theme: AtlasTheme;
  colorMode: AtlasColorMode;
  sizeMode: AtlasSizeMode;
  markerDensity: AtlasMarkerDensity;
  localOnly: boolean;
  grid: boolean;
  guides: AtlasGuides;
  layers: AtlasLayers;
  intervalMode: AtlasIntervalMode;
  selectedGalaxy: number | null;
  selectedGroup: number | null;
};
export type AtlasCameraState = {
  position: Vec3;
  target: Vec3;
  up: Vec3;
  zoom: number;
  halfHeight: number | null;
};
const PREF_KEY = "lv-leda:spatial-preferences:v1";
const CAMERA_KEY = "lv-leda:spatial-camera:v1";
const memory = new Map<string, string>();
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function read(key: string): unknown {
  try {
    return JSON.parse(
      memory.get(key) ?? sessionStorage.getItem(key) ?? "null",
    ) as unknown;
  } catch {
    try {
      return JSON.parse(memory.get(key) ?? "null") as unknown;
    } catch {
      return null;
    }
  }
}
function write(key: string, value: unknown) {
  const json = JSON.stringify(value);
  memory.set(key, json);
  try {
    sessionStorage.setItem(key, json);
  } catch {
    /* In-memory fallback for blocked storage. */
  }
}
function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return options.find((option) => option === value) ?? fallback;
}
function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function pgc(value: unknown, allowed: ReadonlySet<number>): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    allowed.has(value)
    ? value
    : null;
}
export function decodeAtlasPreferences(
  raw: unknown,
  allowed: ReadonlySet<number>,
  theme: AtlasTheme,
): AtlasPreferences {
  const r = record(raw),
    guides = record(r.guides),
    layers = record(r.layers);
  const shells = Array.isArray(guides.shells) ? guides.shells : [];
  const displayMode = choice(r.displayMode, ["groups", "galaxies"], "groups");
  const selectedGroup =
    displayMode === "groups" && layers.groups !== false
      ? pgc(r.selectedGroup, allowed)
      : null;
  const region =
    displayMode === "galaxies" ? decodeAtlasRegion(r.region) : null;
  return {
    comparison:
      displayMode === "galaxies" ? decodeComparison(r.comparison) : null,
    population:
      displayMode === "galaxies"
        ? (decodePopulation(r.population) ?? defaultPopulation())
        : defaultPopulation(),
    region,
    frame: choice(
      r.frame,
      ["SUPERGALACTIC", "GALACTIC", "ICRS"],
      "SUPERGALACTIC",
    ),
    projection: choice(
      r.projection,
      ["orthographic", "perspective"],
      "orthographic",
    ),
    mode: choice(r.mode, ["individual", "catalogue", "verified"], "individual"),
    displayMode,
    slice:
      displayMode === "galaxies" && region === null
        ? decodeAtlasSlice(r.slice)
        : null,
    theme: choice(r.theme, ["dark", "light"], theme),
    colorMode: choice(
      r.colorMode,
      [
        "morphology",
        "neutral",
        "distance",
        "velocity",
        "absoluteB",
        "theta",
        "luminosityK",
        "massHi",
        "hiToK",
      ],
      "morphology",
    ),
    sizeMode: choice(r.sizeMode, ["fixed", "absoluteB"], "fixed"),
    markerDensity: choice(
      r.markerDensity,
      ["small", "normal", "large"],
      "normal",
    ),
    localOnly: flag(r.localOnly, true),
    grid: flag(r.grid, false),
    guides: {
      plane: flag(guides.plane, false),
      shells: ATLAS_SHELL_RADII.filter((radius) => shells.includes(radius)),
    },
    layers: {
      groups: flag(layers.groups, true),
      field: flag(layers.field, true),
      md: flag(layers.md, false),
    },
    intervalMode: choice(r.intervalMode, ["off", "selected", "all"], "off"),
    selectedGalaxy:
      selectedGroup === null &&
      (displayMode === "galaxies" || layers.field !== false)
        ? pgc(r.selectedGalaxy, allowed)
        : null,
    selectedGroup,
  };
}
export function readAtlasPreferences(
  allowed: ReadonlySet<number>,
  theme: AtlasTheme,
) {
  return decodeAtlasPreferences(read(PREF_KEY), allowed, theme);
}
export function saveAtlasPreferences(value: AtlasPreferences) {
  write(PREF_KEY, value);
}
function vector(value: unknown): Vec3 | null {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(
      (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e9,
    )
  )
    return null;
  return [value[0] as number, value[1] as number, value[2] as number];
}
export function decodeAtlasCamera(
  raw: unknown,
  projection: AtlasProjection,
): AtlasCameraState | null {
  const r = record(raw),
    position = vector(r.position),
    target = vector(r.target),
    up = vector(r.up);
  const zoom = r.zoom,
    halfHeight = r.halfHeight;
  if (
    !position ||
    !target ||
    !up ||
    Math.hypot(...up) < 1e-6 ||
    Math.hypot(
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    ) < 1e-9 ||
    typeof zoom !== "number" ||
    !Number.isFinite(zoom) ||
    zoom < 0.12 ||
    zoom > 30
  )
    return null;
  if (projection === "orthographic") {
    if (
      typeof halfHeight !== "number" ||
      !Number.isFinite(halfHeight) ||
      halfHeight <= 0 ||
      halfHeight > 1e9
    )
      return null;
    return { position, target, up, zoom, halfHeight };
  }
  return halfHeight === null
    ? { position, target, up, zoom, halfHeight }
    : null;
}
export function readAtlasCamera(
  key: string,
  projection: AtlasProjection,
): AtlasCameraState | null {
  const r = record(read(CAMERA_KEY));
  return r.key === key ? decodeAtlasCamera(r.camera, projection) : null;
}
export function saveAtlasCamera(key: string, camera: AtlasCameraState) {
  write(CAMERA_KEY, { key, camera });
}
export function clearAtlasCamera() {
  write(CAMERA_KEY, null);
}
/** Exact scene identity, not a hash or scientific sample manifest. */
export function atlasCameraKey(
  frame: ObserverFrame,
  projection: AtlasProjection,
  mode: AtlasDistanceMode,
  localOnly: boolean,
  displayMode: AtlasDisplayMode,
  points: readonly { object: { pgc: number }; position: Vec3 }[],
  groups: readonly { pgc: number; position: Vec3; radiusMpc: number }[],
): string {
  return JSON.stringify([
    frame,
    projection,
    mode,
    localOnly,
    displayMode,
    points.map((p) => [p.object.pgc, ...p.position]),
    displayMode === "groups"
      ? groups.map((g) => [g.pgc, ...g.position, g.radiusMpc])
      : [],
  ]);
}
export function atlasSpatialUrl(href: string, open: boolean): string {
  const url = new URL(href);
  if (open) url.searchParams.set("spatial", "1");
  else url.searchParams.delete("spatial");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Only explicit sky selections override saved spatial preferences. Undefined means no request. */
export function applySkySelection(
  previous: AtlasPreferences,
  requested: number | null | undefined,
  allowed: ReadonlySet<number>,
): AtlasPreferences {
  if (requested === undefined) return previous;
  if (requested === null || !allowed.has(requested))
    return { ...previous, selectedGalaxy: null, selectedGroup: null };
  return {
    ...previous,
    displayMode: "galaxies",
    selectedGalaxy: requested,
    selectedGroup: null,
  };
}
