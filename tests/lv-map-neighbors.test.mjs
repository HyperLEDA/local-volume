import { test } from "node:test";
import assert from "node:assert/strict";
import { angularSeparationDegrees, otherSkyObjects } from "../frontend/src/lib/skyContext.ts";

const item = (pgc, ra, dec) => ({ pgc, ra, dec });
const c = { ra: 359, dec: 0 };

test("10 degree selection crosses RA 360/0 correctly", () => {
  const rows = [item(1, 359, 0), item(2, 1, 0), item(3, 349, 0), item(4, 348.99, 0), item(5, null, 0)];
  assert.deepEqual(otherSkyObjects(rows, 1, c, 10).map((x) => x.pgc), [2, 3]);
});

test("great-circle distance is used near the poles", () => {
  const a = { ra: 10, dec: 89 };
  const b = { ra: 190, dec: 89 };
  assert.ok(Math.abs(angularSeparationDegrees(a, b) - 2) < 1e-8);
  assert.deepEqual(otherSkyObjects([item(5, 190, 89)], 1, a, 10).map((x) => x.pgc), [5]);
});

test("target, duplicate PGCs and invalid coordinates are omitted", () => {
  const rows = [item(1, 0, 0), item(2, 1, 0), item(2, 2, 0), item(3, 0, 91)];
  assert.deepEqual(otherSkyObjects(rows, 1, { ra: 0, dec: 0 }).map((x) => x.pgc), [2]);
  assert.deepEqual(otherSkyObjects(rows, 1, null), []);
});
