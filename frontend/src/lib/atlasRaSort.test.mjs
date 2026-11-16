import test from "node:test";
import assert from "node:assert/strict";
import { sortObjectsByRa } from "./atlasRaSort.ts";

test("RA ascending order wraps 360 to 0 and uses Dec / PGC for ties", () => {
  const input = [
    { pgc: 21, ra: 358, dec: 1 },
    { pgc: 5, ra: 10, dec: 2 },
    { pgc: 4, ra: 0, dec: 0 },
    { pgc: 6, ra: 10, dec: -2 },
    { pgc: 3, ra: 360, dec: -1 },
    { pgc: 7, ra: 10, dec: -2 },
  ];
  assert.deepEqual(
    sortObjectsByRa(input).map((row) => row.pgc),
    [3, 4, 6, 7, 5, 21],
  );
  assert.deepEqual(
    input.map((row) => row.pgc),
    [21, 5, 4, 6, 3, 7],
  );
});

test("missing or invalid sky coordinates are placed at the end", () => {
  const input = [
    { pgc: 9, ra: null, dec: null },
    { pgc: 4, ra: 12, dec: null },
    { pgc: 3, ra: 25, dec: 0 },
    { pgc: 2, ra: -1, dec: 10 },
    { pgc: 1, ra: 3, dec: 4 },
    { pgc: 5, ra: 11, dec: 91 },
  ];
  assert.deepEqual(
    sortObjectsByRa(input).map((row) => row.pgc),
    [1, 3, 2, 4, 5, 9],
  );
});

test("sort is deterministic for exact ties", () => {
  assert.deepEqual(
    sortObjectsByRa([
      { pgc: 102, ra: 41, dec: 8 },
      { pgc: 101, ra: 41, dec: 8 },
    ]).map((row) => row.pgc),
    [101, 102],
  );
});
