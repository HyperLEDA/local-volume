import test from "node:test";
import assert from "node:assert/strict";
import { findAtlasNamedTarget } from "./atlasNamedSearch.ts";
import { tidalStrokeWidth } from "./tidalMarker.ts";

const rows = [
  { pgc: 1, name: "NGC 55", names: ["ESO 293-50"], ra: 3.72, dec: -39.2 },
  { pgc: 2, name: "NGC 59", names: ["PGC 1034"], ra: 3.1, dec: -21.4 },
  { pgc: 3, name: "UGC 12894", names: [], ra: 0.34, dec: 8.1 },
  { pgc: 4, name: "PGC 40", names: [], ra: null, dec: null },
];

test("exact galaxy name, PGC, and alias resolve to same sky target", () => {
  for (const query of ["NGC 55", "pgc 1", "1", "eso 293-50"]) {
    assert.equal(findAtlasNamedTarget(rows, query)?.pgc, 1);
  }
});

test("unique partial name moves map but ambiguous names do not", () => {
  assert.equal(findAtlasNamedTarget(rows, "UGC 128")?.pgc, 3);
  assert.equal(findAtlasNamedTarget(rows, "NGC"), null);
  assert.equal(findAtlasNamedTarget(rows, "  "), null);
});

test("objects without valid sky coordinates do not become map targets", () => {
  assert.equal(findAtlasNamedTarget(rows, "PGC 40"), null);
});

test("Theta1 stroke maps unfiltered end points to 1.2..2.2px", () => {
  assert.equal(tidalStrokeWidth(-5, -5, 5), 1.2);
  assert.equal(tidalStrokeWidth(0, -5, 5), 1.7);
  assert.equal(tidalStrokeWidth(5, -5, 5), 2.2);
  assert.equal(tidalStrokeWidth(undefined, -5, 5), 1.5);
});
