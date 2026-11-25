import { decodeAtlasSlice, type AtlasSlice } from "./atlasSpatialSlice.ts";
import { decodeAtlasRegion, type AtlasRegion } from "./atlasSpatialRegion.ts";
import type { AtlasDistanceMode } from "./atlasSpatialScene.ts";

import {
  decodePopulation,
  POPULATION_POLICY,
  DWARF_ABSOLUTE_B_LIMIT,
  type AtlasPopulation,
} from "./atlasPopulation.ts";

export type SpatialSample = {
  population?: AtlasPopulation & {
    policy: typeof POPULATION_POLICY;
    dwarfAbsoluteBLimit: number;
  };
  version: 1;
  createdAt: string;
  pgcs: number[];
  slice: AtlasSlice | null;
  region: AtlasRegion | null;
  distanceMode: AtlasDistanceMode;
  localOnly: boolean;
};
export type SpatialSampleState = {
  token: string | null;
  sample: SpatialSample | null;
};
const PARAM = "spatialSample";
const PREFIX = "lv-leda:spatial-sample:v1:";
const MAX_IDS = 100000;
function validPgc(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validToken(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
export function decodeSpatialSample(raw: unknown): SpatialSample | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    r.version !== 1 ||
    typeof r.createdAt !== "string" ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    !Array.isArray(r.pgcs) ||
    r.pgcs.length > MAX_IDS ||
    !r.pgcs.every(validPgc) ||
    new Set(r.pgcs).size !== r.pgcs.length ||
    typeof r.localOnly !== "boolean" ||
    (r.distanceMode !== "individual" &&
      r.distanceMode !== "catalogue" &&
      r.distanceMode !== "verified")
  )
    return null;
  const slice = decodeAtlasSlice(r.slice);
  const region = decodeAtlasRegion(r.region);
  const population = decodePopulation(r.population);
  const metadata = r.population as Record<string, unknown> | undefined;
  if (
    r.population !== undefined &&
    (!population ||
      !population.ids.length ||
      metadata?.policy !== POPULATION_POLICY ||
      metadata.dwarfAbsoluteBLimit !== DWARF_ABSOLUTE_B_LIMIT)
  )
    return null;
  if (
    (slice !== null && region !== null) ||
    (!slice && !region && !population) ||
    (r.slice !== null && !slice) ||
    (r.region !== null && !region)
  )
    return null;
  return {
    ...(population
      ? {
          population: {
            ...population,
            policy: POPULATION_POLICY,
            dwarfAbsoluteBLimit: DWARF_ABSOLUTE_B_LIMIT,
          },
        }
      : {}),
    version: 1,
    createdAt: r.createdAt,
    pgcs: [...r.pgcs].sort((a, b) => a - b),
    slice,
    region,
    distanceMode: r.distanceMode,
    localOnly: r.localOnly,
  };
}
export function makeSpatialSample(
  pgcs: readonly number[],
  slice: AtlasSlice | null,
  region: AtlasRegion | null,
  distanceMode: AtlasDistanceMode,
  localOnly: boolean,
  population?: AtlasPopulation,
): SpatialSample | null {
  return decodeSpatialSample({
    ...(population?.ids.length
      ? {
          population: {
            ...population,
            policy: POPULATION_POLICY,
            dwarfAbsoluteBLimit: DWARF_ABSOLUTE_B_LIMIT,
          },
        }
      : {}),
    version: 1,
    createdAt: new Date().toISOString(),
    pgcs: [...pgcs],
    slice,
    region,
    distanceMode,
    localOnly,
  });
}
/** A missing token is unfiltered; a missing snapshot for an active token is empty. */
export function spatialSampleIds(
  state: SpatialSampleState,
): ReadonlySet<number> | null {
  return state.token === null ? null : new Set(state.sample?.pgcs ?? []);
}
export function readSpatialSample(search: string): SpatialSampleState {
  const token = new URLSearchParams(search).get(PARAM);
  if (token === null || !validToken(token)) return { token, sample: null };
  try {
    return {
      token,
      sample: decodeSpatialSample(
        JSON.parse(sessionStorage.getItem(PREFIX + token) ?? "null"),
      ),
    };
  } catch {
    return { token, sample: null };
  }
}
export function storeSpatialSample(
  sample: SpatialSample,
): SpatialSampleState | null {
  const validated = decodeSpatialSample(sample);
  if (!validated) return null;
  try {
    const token = crypto.randomUUID();
    sessionStorage.setItem(PREFIX + token, JSON.stringify(validated));
    return { token, sample: validated };
  } catch {
    return null;
  }
}
export function spatialSampleUrl(href: string, token: string | null): string {
  const url = new URL(href);
  if (token === null) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, token);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function spatialSampleLabel(sample: SpatialSample): string {
  const geometry = sample.slice
    ? `Slice · ${sample.slice.frame}`
    : sample.region
      ? `${sample.region.kind === "sphere" ? "Sphere" : "Box"} · ${sample.region.frame}`
      : null;
  return [geometry, sample.population ? "Populations" : null]
    .filter(Boolean)
    .join(" · ");
}
export function downloadSpatialSample(sample: SpatialSample): void {
  const blob = new Blob([JSON.stringify(sample, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lv-leda-spatial-sample.json";
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
