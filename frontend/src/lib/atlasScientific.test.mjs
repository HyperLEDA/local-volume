import test from "node:test";
import assert from "node:assert/strict";
import {
  regionContains,
  rectangleFromCorners,
  regionBoundary,
} from "./skyRegion.ts";
import { summarizeAtlas } from "./atlasSummary.ts";
import { buildAtlasCsv } from "./atlasExport.ts";
import { readAtlasState, atlasQueryParam } from "./atlasUrlState.ts";
import { DEFAULT_SCIENTIFIC_FILTERS } from "./scientificFilters.ts";

test("cone and rectangle select objects across RA=0", () => {
  const c = { kind: "circle", center: { ra: 359.9, dec: 12 }, radiusDeg: 0.4 };
  assert.equal(regionContains(c, 0.1, 12), true);
  assert.equal(regionContains(c, 2, 12), false);
  const r = { kind: "rectangle", raFrom: 350, raTo: 10, decMin: -5, decMax: 5 };
  assert.equal(regionContains(r, 359, 0), true);
  assert.equal(regionContains(r, 3, 0), true);
  assert.equal(regionContains(r, 40, 0), false);
  assert.equal(regionContains(r, 3, 7), false);
  assert.equal(regionContains(null, 3, 0), false);
});
test("rectangle from corners is minimal RA interval, boundary finite", () => {
  const r = rectangleFromCorners({ ra: 353, dec: -12 }, { ra: 4, dec: 3 });
  assert.ok(r);
  assert.equal(r.raFrom, 353);
  assert.equal(r.raTo, 4);
  assert.equal(regionContains(r, 358, 0), true);
  for (const p of regionBoundary(r)) assert.ok(p.every(Number.isFinite));
  const c = { kind: "circle", center: { ra: 1, dec: 82 }, radiusDeg: 10 };
  for (const p of regionBoundary(c)) assert.ok(p.every(Number.isFinite));
});
test("summary takes valid positive distances only", () => {
  const s = summarizeAtlas([
    { dist: 2, theta1: 0 },
    { dist: 10, theta1: null },
    { dist: -1, theta1: NaN },
    { dist: 4 },
  ]);
  assert.equal(s.selected, 4);
  assert.equal(s.distanceKnown, 3);
  assert.equal(s.medianDistance, 4);
  assert.equal(s.tidalKnown, 1);
});
test("CSV quotes and disarms formulas; missing measurements remain blank", () => {
  const csv = buildAtlasCsv([
    { pgc: 42, name: '=CMD,"bad"', ra: 2, dec: 3, dist: null, md_name: null },
  ]);
  assert.match(csv, /"'=CMD,""bad"""/);
  assert.match(csv, /"42"/);
  assert.ok(csv.includes(',,"2"') === false);
  assert.match(csv, /,"3",,,/);
});
test("selection URL restores typed ranges, rejects bad values", () => {
  const filters = {
    ...DEFAULT_SCIENTIFIC_FILTERS,
    distance: { active: true, min: 1, max: 4 },
  };
  const state = {
    query: "NGC 3077",
    filters,
    region: { kind: "rectangle", raFrom: 350, raTo: 5, decMin: -2, decMax: 2 },
    nearby: null,
    radiusArcmin: 30,
  };
  const param = new URLSearchParams({ atlas: atlasQueryParam(state) });
  assert.deepEqual(readAtlasState("?" + param.toString()), state);
  assert.equal(readAtlasState("?atlas=%7Bbad").query, "");
});

test("URL state includes nearby cone parameters and rejects malformed regions", () => {
  const state = {
    query: "359.9 +0.1",
    filters: DEFAULT_SCIENTIFIC_FILTERS,
    region: {
      kind: "circle",
      center: { ra: 359.9, dec: 0.1 },
      radiusDeg: 0.75,
    },
    nearby: { ra: 0.2, dec: 0.1 },
    radiusArcmin: 15,
  };
  const search = "?" + new URLSearchParams({ atlas: atlasQueryParam(state) });
  assert.deepEqual(readAtlasState(search), state);
  const bad = {
    v: 1,
    region: { kind: "circle", center: null, radiusDeg: 3 },
    nearby: { ra: 500, dec: 0 },
    radiusArcmin: NaN,
  };
  const recovered = readAtlasState(
    "?" + new URLSearchParams({ atlas: JSON.stringify(bad) }),
  );
  assert.equal(recovered.region, null);
  assert.equal(recovered.nearby, null);
  assert.equal(recovered.radiusArcmin, 30);
});

test("default unfiltered atlas has no share-state URL", () => {
  assert.equal(
    atlasQueryParam({
      query: "",
      filters: DEFAULT_SCIENTIFIC_FILTERS,
      region: null,
      nearby: null,
      radiusArcmin: 30,
    }),
    "",
  );
});

test("rectangle handles polar sources and zero-degree RA crossing", () => {
  const r = {
    kind: "rectangle",
    raFrom: 359.95,
    raTo: 0.05,
    decMin: 88,
    decMax: 90,
  };
  assert.equal(regionContains(r, 0, 89), true);
  assert.equal(regionContains(r, 180, 89), false);
  assert.equal(regionContains(r, 0, 87), false);
});
