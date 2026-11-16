import test from "node:test";
import assert from "node:assert/strict";
import { tidalStrokeWidth } from "./tidalMarker.ts";
import { suggestedDraftRange } from "./atlasDraftFilters.ts";
import { trgbDistanceCount } from "./atlasTrgbSummary.ts";

test("theta1 stroke uses the full 1.2 to 2.2 px catalog range", () => {
  assert.equal(tidalStrokeWidth(-2, -2, 2), 1.2);
  assert.equal(tidalStrokeWidth(0, -2, 2), 1.7);
  assert.equal(tidalStrokeWidth(2, -2, 2), 2.2);
  assert.equal(tidalStrokeWidth(null, -2, 2), 1.5);
});

test("draft suggestions keep valid bounds and preserve null for unavailable quantities", () => {
  assert.equal(suggestedDraftRange("distance", null), null);
  assert.deepEqual(suggestedDraftRange("distance", { min: 0.01, max: 49.45 }), {
    min: 0.01,
    max: 11,
  });
});

test("TRGB counter is zero only when no adopted TRGB distances are in the selection", () => {
  assert.equal(trgbDistanceCount([{ distance_method: "rgb", dist: 2 }]), 1);
  assert.equal(trgbDistanceCount([{ distance_method: "TF", dist: 2 }]), 0);
});
