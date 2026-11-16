import test from "node:test";
import assert from "node:assert/strict";
import {
  parseJCoordinates,
  parseAtlasCoordinates,
  DEFAULT_CONE_RADIUS_ARCMIN,
} from "./atlasCoordinateSearch.ts";
import {
  startFilterDraft,
  validateFilterDraft,
  resetFilterDraft,
} from "./atlasDraftFilters.ts";
import { DEFAULT_SCIENTIFIC_FILTERS } from "./scientificFilters.ts";
import {
  nearestMarkerAtPixel,
  overviewMarkerZoomFov,
} from "./atlasMarkerZoom.ts";

const bounds = {
  distance: { min: 0, max: 12 },
  heliocentric: { min: -333, max: 1745 },
  velocity: { min: -199, max: 1325 },
  morphology: { min: -5, max: 11 },
  magnitude: { min: 9, max: 24 },
  hi21: { min: 8, max: 19 },
  tidal: null,
};

test("J designation with decimal seconds is parsed as ICRS coordinates", () => {
  const parsed = parseJCoordinates("J103925.25+014305.5");
  assert.ok(parsed);
  assert.ok(Math.abs(parsed.ra - 159.8552083333) < 1e-8);
  assert.ok(Math.abs(parsed.dec - 1.7181944444) < 1e-8);
  assert.deepEqual(parseJCoordinates("J1200-3000"), { ra: 180, dec: -30 });
  assert.deepEqual(parseAtlasCoordinates("J000000+000000"), { ra: 0, dec: 0 });
  assert.equal(DEFAULT_CONE_RADIUS_ARCMIN, 30);
});

test("invalid J coordinates cannot silently wrap or exceed declination limits", () => {
  for (const query of [
    "J240000+000000",
    "J126000+000000",
    "J120000+916000",
    "J120000+900001",
    "J120000+006000",
    "J123456+12345",
    "xJ120000+000000",
  ])
    assert.equal(parseJCoordinates(query), null, query);
});

test("filters stage raw text including an empty zero field without applying", () => {
  const applied = {
    ...DEFAULT_SCIENTIFIC_FILTERS,
    distance: { active: true, min: 0, max: 12 },
  };
  const draft = startFilterDraft(applied, bounds);
  assert.equal(draft.distance.min, "0");
  draft.distance.min = "";
  assert.deepEqual(applied.distance, { active: true, min: 0, max: 12 });
  assert.equal(validateFilterDraft(draft, bounds).ok, false);
  draft.distance.min = "2.5";
  const result = validateFilterDraft(draft, bounds);
  assert.equal(result.ok, true);
  if (result.ok)
    assert.deepEqual(result.filters.distance, {
      active: true,
      min: 2.5,
      max: 12,
    });
});

test("Done clamps to actual catalogue bounds, not to stale default ranges", () => {
  const draft = startFilterDraft(DEFAULT_SCIENTIFIC_FILTERS, bounds);
  assert.deepEqual(draft.distance, { active: false, min: "0", max: "11" });
  draft.distance.active = true;
  draft.distance.min = "-10";
  draft.distance.max = "9999";
  const result = validateFilterDraft(draft, bounds);
  assert.equal(result.ok, true);
  if (result.ok)
    assert.deepEqual(result.filters.distance, {
      active: true,
      min: 0,
      max: 12,
    });
  assert.deepEqual(resetFilterDraft(bounds).hi21, {
    active: false,
    min: "8",
    max: "19",
  });
});

test("inverted filters rejected instead of changing selection", () => {
  const draft = startFilterDraft(DEFAULT_SCIENTIFIC_FILTERS, bounds);
  draft.heliocentric = { active: true, min: "100", max: "90" };
  assert.equal(validateFilterDraft(draft, bounds).ok, false);
});

test("double-click zoom only picks a visible marker and is broad", () => {
  const objects = [
    { pgc: 1, ra: 10, dec: 20, a26_arcmin: 1 },
    { pgc: 2, ra: 30, dec: 40, a26_arcmin: 45 },
  ];
  function project(ra, dec) {
    return [ra * 4, dec * 2];
  }
  assert.equal(nearestMarkerAtPixel(objects, project, 42, 41)?.pgc, 1);
  assert.equal(nearestMarkerAtPixel(objects, project, 500, 500), null);
  assert.equal(overviewMarkerZoomFov(objects[0]), 6);
  assert.equal(overviewMarkerZoomFov(objects[1]), 12);
});
