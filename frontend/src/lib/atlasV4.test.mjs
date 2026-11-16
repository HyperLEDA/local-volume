import test from "node:test";
import assert from "node:assert/strict";
import { atlasBounds, clampScientificFilters } from "./atlasBounds.ts";
import {
  DEFAULT_SCIENTIFIC_FILTERS,
  matchesScientificFilters,
  NUMERIC_FILTER_KEYS,
} from "./scientificFilters.ts";
import { atlasQueryParam, readAtlasState } from "./atlasUrlState.ts";

test("catalogue range for H I magnitude is global, and selection works", () => {
  const rows = [
    { hi21_mag: 9, lvg_v_hel_kms: 50 },
    { hi21_mag: 16 },
    { hi21_mag: 4, hi21_limit: ">" },
    { hi21_mag: null },
  ];
  const bounds = atlasBounds(rows);
  assert.deepEqual(bounds.hi21, { min: 9, max: 16 });
  // The lower magnitude limit must not affect catalogue min/max or pass as a detection.
  assert.equal(
    matchesScientificFilters(rows[2], {
      ...DEFAULT_SCIENTIFIC_FILTERS,
      hi21: { active: true, min: 0, max: 10 },
      includeMissing: false,
    }),
    false,
  );
  assert.deepEqual(NUMERIC_FILTER_KEYS, [
    "distance",
    "heliocentric",
    "velocity",
    "morphology",
    "magnitude",
    "hi21",
  ]);
  const f = {
    ...DEFAULT_SCIENTIFIC_FILTERS,
    hi21: { active: true, min: 10, max: 14 },
    includeMissing: false,
  };
  assert.equal(matchesScientificFilters(rows[0], f), false);
  assert.equal(matchesScientificFilters(rows[3], f), false);
  assert.equal(matchesScientificFilters({ ...rows[0], hi21_mag: 12 }, f), true);
  assert.equal(
    matchesScientificFilters(rows[3], { ...f, includeMissing: true }),
    true,
  );
  assert.deepEqual(
    clampScientificFilters(
      { ...f, hi21: { active: true, min: -9, max: 999 } },
      bounds,
    ).hi21,
    { active: true, min: 9, max: 16 },
  );
});

test("share URL keeps H I filter and old v1 URLs remain readable", () => {
  const selected = {
    query: "",
    region: null,
    nearby: null,
    radiusArcmin: 30,
    filters: {
      ...DEFAULT_SCIENTIFIC_FILTERS,
      hi21: { active: true, min: 11, max: 15 },
    },
  };
  const state = readAtlasState(
    `?${new URLSearchParams({ atlas: atlasQueryParam(selected) })}`,
  );
  assert.deepEqual(state.filters.hi21, selected.filters.hi21);
  const old = JSON.stringify({
    v: 1,
    filters: { distance: { active: false, min: 0, max: 11 } },
  });
  assert.deepEqual(
    readAtlasState(`?${new URLSearchParams({ atlas: old })}`).filters.hi21,
    DEFAULT_SCIENTIFIC_FILTERS.hi21,
  );
});
