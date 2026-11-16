import test from "node:test";
import assert from "node:assert/strict";
import { atlasBounds } from "./atlasBounds.ts";
import {
  suggestedDraftRange,
  startFilterDraft,
  validateFilterDraft,
} from "./atlasDraftFilters.ts";
import { DEFAULT_SCIENTIFIC_FILTERS } from "./scientificFilters.ts";
import { tidalStrokeWidth } from "./tidalMarker.ts";

test("LV distance starts at a sensible 11 Mpc suggestion, not a raw outlier", () => {
  const full = atlasBounds([
    { dist: 0.01 },
    { dist: 7.99 },
    { dist: 49.45 },
    { dist: null },
  ]);
  assert.deepEqual(full.distance, { min: 0.01, max: 49.45 });
  assert.deepEqual(suggestedDraftRange("distance", full.distance), {
    min: 0.01,
    max: 11,
  });
  const draft = startFilterDraft(DEFAULT_SCIENTIFIC_FILTERS, full);
  assert.deepEqual(draft.distance, { active: false, min: "0.01", max: "11" });
  draft.distance.active = true;
  const parsed = validateFilterDraft(draft, full);
  assert.equal(parsed.ok, true);
  if (parsed.ok)
    assert.deepEqual(parsed.filters.distance, {
      active: true,
      min: 0.01,
      max: 11,
    });
});

test("catalogue extrema are not silently discarded or rewritten", () => {
  const full = atlasBounds([
    { dist: 0.01, b_mag: -4.6 },
    { dist: 49.45, b_mag: 23.4 },
  ]);
  assert.deepEqual(full.distance, { min: 0.01, max: 49.45 });
  assert.deepEqual(full.magnitude, { min: -4.6, max: 23.4 });
  assert.deepEqual(suggestedDraftRange("magnitude", full.magnitude), {
    min: 0,
    max: 23.4,
  });
});

test("all numeric inputs retain precision in ordinary dot decimal notation", () => {
  const full = atlasBounds([{ dist: 0.01 }, { dist: 49.45 }]);
  const draft = startFilterDraft(DEFAULT_SCIENTIFIC_FILTERS, full);
  draft.distance.active = true;
  draft.distance.min = "1.25";
  draft.distance.max = "9.75";
  const valid = validateFilterDraft(draft, full);
  assert.equal(valid.ok, true);
  if (valid.ok)
    assert.deepEqual(valid.filters.distance, {
      active: true,
      min: 1.25,
      max: 9.75,
    });
  draft.distance.max = "9,75";
  assert.equal(validateFilterDraft(draft, full).ok, false);
});

test("marker stroke has a fixed 1.2–2.2 pixel physical scale", () => {
  assert.equal(tidalStrokeWidth(-2, -2, 2), 1.2);
  assert.equal(tidalStrokeWidth(0, -2, 2), 1.7);
  assert.equal(tidalStrokeWidth(2, -2, 2), 2.2);
  assert.equal(tidalStrokeWidth(null, -2, 2), 1.5);
});
