import test from "node:test";
import assert from "node:assert/strict";
import { atlasBounds, clampNumericFilter } from "./atlasBounds.ts";
import { tidalStrokeWidth } from "./tidalMarker.ts";
import {
  DEFAULT_SCIENTIFIC_FILTERS,
  matchesScientificFilters,
} from "./scientificFilters.ts";
import { readAtlasState, atlasQueryParam } from "./atlasUrlState.ts";
import { describeRegion } from "./skyRegion.ts";

test("theta stroke uses complete catalogue extrema rather than selection range", () => {
  const universe = [
    { theta1: -5, dist: 2, lvg_v_hel_kms: -120 },
    { theta1: 0, dist: 5, lvg_v_hel_kms: 20 },
    { theta1: 15, dist: 9, lvg_v_hel_kms: 200 },
  ];
  const full = atlasBounds(universe);
  assert.deepEqual(full.tidal, { min: -5, max: 15 });
  assert.equal(full.heliocentric?.min, -120);
  assert.equal(full.heliocentric?.max, 200);
  assert.equal(tidalStrokeWidth(-5, full.tidal.min, full.tidal.max), 1.2);
  assert.ok(
    Math.abs(tidalStrokeWidth(0, full.tidal.min, full.tidal.max) - 1.45) < 1e-9,
  );
  assert.equal(tidalStrokeWidth(15, full.tidal.min, full.tidal.max), 2.2);
  assert.equal(tidalStrokeWidth(null, full.tidal.min, full.tidal.max), 1.5);
  assert.equal(tidalStrokeWidth(0, 1, 1), 1.5);
});

test("numeric bounds clamp to catalogue min/max and preserve order", () => {
  assert.deepEqual(
    clampNumericFilter(
      { active: true, min: -1000, max: 3000 },
      { min: -120, max: 200 },
    ),
    { active: true, min: -120, max: 200 },
  );
  assert.deepEqual(
    clampNumericFilter(
      { active: true, min: 150, max: 180 },
      { min: 0, max: 100 },
    ),
    { active: true, min: 100, max: 100 },
  );
});

test("heliocentric velocity selection is independent of VLG", () => {
  const filters = {
    ...DEFAULT_SCIENTIFIC_FILTERS,
    heliocentric: { active: true, min: 100, max: 200 },
  };
  assert.equal(
    matchesScientificFilters(
      { lvg_v_hel_kms: 140, lvg_v_lg_kms: 600 },
      filters,
    ),
    true,
  );
  assert.equal(
    matchesScientificFilters(
      { lvg_v_hel_kms: 250, lvg_v_lg_kms: 140 },
      filters,
    ),
    false,
  );
  const state = {
    query: "",
    filters,
    region: null,
    nearby: null,
    radiusArcmin: 30,
  };
  const saved = new URLSearchParams({ atlas: atlasQueryParam(state) });
  assert.deepEqual(
    readAtlasState(`?${saved.toString()}`).filters.heliocentric,
    filters.heliocentric,
  );
});

test("large cones are reported in degrees", () => {
  assert.equal(
    describeRegion({
      kind: "circle",
      center: { ra: 25, dec: 12 },
      radiusDeg: 62,
    }),
    "Cone · 62.00°",
  );
});

test("drawn rectangle follows screen midpoint rather than shortest RA arc", async () => {
  const { rectangleFromScreenCorners, regionContains } =
    await import("./skyRegion.ts");
  const wide = rectangleFromScreenCorners(
    { ra: 10, dec: -10 },
    { ra: 350, dec: 10 },
    { ra: 180, dec: 0 },
  );
  assert.ok(wide);
  assert.equal(regionContains(wide, 180, 0), true);
  assert.equal(regionContains(wide, 0, 0), false);
  const seam = rectangleFromScreenCorners(
    { ra: 350, dec: -10 },
    { ra: 10, dec: 10 },
    { ra: 0, dec: 0 },
  );
  assert.ok(seam);
  assert.equal(regionContains(seam, 0, 0), true);
  assert.equal(regionContains(seam, 180, 0), false);
});
