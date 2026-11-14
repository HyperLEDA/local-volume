import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  morphologyColor,
  MORPHOLOGY_GRADIENT,
  UNKNOWN_MORPHOLOGY_COLOR,
} from "../frontend/src/lib/morphologyColors.ts";
import { objectFovDegrees, needsInitialFovCorrection } from "../frontend/src/lib/objectFov.ts";

test("muted morphology bins preserve red negatives, a transitional zero, and blue positives", () => {
  const expected = [
    [-5, "#c96d76"],
    [-3, "#c96d76"],
    [-1, "#d99ea4"],
    [0, "#a995a6"],
    [2, "#91a8c6"],
    [5, "#6489bc"],
    [10, "#3f6fab"],
  ];

  for (const [t, color] of expected) {
    assert.equal(morphologyColor(t), color);
  }
  assert.equal(morphologyColor(null), UNKNOWN_MORPHOLOGY_COLOR);
});

test("unavailable or invalid numeric T is not invented", () => {
  for (const missing of [null, undefined, NaN, Infinity, "5", "G", {}]) {
    assert.equal(morphologyColor(missing), UNKNOWN_MORPHOLOGY_COLOR);
  }
});

test("a26 is a DIAMETER in arcmin; FOV permits 50% radius margin", () => {
  // diameter=6.8 arcmin; wanted full square FOV=1.5*6.8 arcmin
  assert.ok(Math.abs(objectFovDegrees({ a26_arcmin: 6.8 }) - 0.17) < 1e-12);
  assert.equal(objectFovDegrees({ a26_arcmin: 40 }), 1);
  assert.equal(objectFovDegrees({ a26_arcmin: 600 }), 15);
});

test("invalid or absent Holmberg diameter uses stable fallback", () => {
  assert.equal(objectFovDegrees({ a26_arcmin: null }), 1);
  assert.equal(objectFovDegrees({ a26_arcmin: -5 }), 1);
  assert.equal(objectFovDegrees({ a26_arcmin: Number.NaN }), 1);
  assert.equal(objectFovDegrees({ a26_arcmin: 0.1 }), 0.025);
  assert.equal(objectFovDegrees({ a26_arcmin: 10000 }), 60);
});

test("initial field correction remains isolated from user interaction", () => {
  assert.equal(needsInitialFovCorrection(0.17, 0.17), false);
  assert.equal(needsInitialFovCorrection(0.2, 0.17), true);
});

test("numeric morphology T is propagated to public summary response", () => {
  const api = readFileSync("frontend/src/api/objects.ts", "utf8");
  const query = readFileSync("lv_backend/data/objects.py", "utf8");
  const schema = readFileSync("lv_backend/presentation/schemas.py", "utf8");
  assert.match(api, /morphology_t: morphologyT/);
  assert.match(api, /morphology_t: morphologyT\?\.\[index\] \?\? null/);
  assert.match(query, /obs\.a26_arcmin, obs\.morphology_t/);
  assert.match(schema, /morphology_t: list\[int \| None\]/);
});
