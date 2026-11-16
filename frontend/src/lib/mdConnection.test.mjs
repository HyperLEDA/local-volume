import test from "node:test";
import assert from "node:assert/strict";
import {
  greatCircleVertices,
  hasSkyPosition,
  visibleGreatCircleSegments,
} from "./mdConnection.ts";

test("MD link geometry crosses RA=0 by short arc", () => {
  const points = greatCircleVertices({ ra: 359, dec: 0 }, { ra: 1, dec: 0 });
  assert.ok(points.length >= 3);
  assert.ok(points.every((p) => p[0] > 355 || p[0] < 5));
  assert.ok(Math.abs(points[0][0] - 359) < 1e-6);
  assert.ok(Math.abs(points.at(-1)[0] - 1) < 1e-6);
});
test("MD edge is a great circle at high declination", () => {
  const points = greatCircleVertices({ ra: 0, dec: 60 }, { ra: 90, dec: 60 });
  assert.ok(points.some((p) => p[1] > 60));
});
test("Invalid, identical, and antipodal positions have no line", () => {
  assert.equal(hasSkyPosition({ ra: null, dec: 1 }), false);
  assert.deepEqual(
    greatCircleVertices({ ra: 1, dec: 3 }, { ra: 1, dec: 3 }),
    [],
  );
  assert.deepEqual(
    greatCircleVertices({ ra: 0, dec: 0 }, { ra: 180, dec: 0 }),
    [],
  );
});
test("Projection edge discontinuity splits the line", () => {
  const p = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ];
  const out = visibleGreatCircleSegments(
    p,
    (ra) => [ra < 2 ? ra : ra + 200, 50],
    400,
  );
  assert.deepEqual(out, [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [2, 0],
      [3, 0],
    ],
  ]);
});
