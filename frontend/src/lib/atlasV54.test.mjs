import test from "node:test";
import assert from "node:assert/strict";
import { trgbDistanceCount } from "./atlasTrgbSummary.ts";

test("TRGB count uses only adopted source-native distance method and finite distance", () => {
  const selected = [
    { distance_method: "TRGB", dist: 4.2 },
    { distance_method: "rgb", dist: 1.05 },
    { distance_method: " TrGb ", dist: 9.2 },
    { distance_method: "TF", dist: 3.7 },
    { distance_method: "mem", dist: 2.1 },
    { distance_method: "TRGB", dist: null },
    { distance_method: "TRGB", dist: 0 },
    { distance_method: "TRGB", dist: Number.NaN },
    { distance_method: "TRGB?", dist: 3.0 },
    { distance_method: null, dist: 2.0 },
  ];
  assert.equal(trgbDistanceCount(selected), 3);
  assert.equal(trgbDistanceCount(selected.slice(3)), 0);
  assert.equal(trgbDistanceCount([]), 0);
});
