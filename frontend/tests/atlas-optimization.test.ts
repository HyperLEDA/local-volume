import { describe, expect, test } from "bun:test";
import {
  createCatalogQueryMatcher,
  matchesQuery,
  type CatalogObject,
} from "../src/api/objects.ts";
import { atlasBounds } from "../src/lib/atlasBounds.ts";

function galaxy(
  pgc: number,
  name: string,
  names: string[] = [],
): CatalogObject {
  return {
    pgc,
    name,
    names,
    ra: null,
    dec: null,
    bt: null,
    v_hel: null,
    type_name: null,
  };
}

describe("Atlas query optimization", () => {
  const galaxies = [
    galaxy(123, "NGC 12", ["UGC 7", "PGC 123"]),
    galaxy(400, "IC 10", ["LEDA 400", "Карлик"]),
    galaxy(900, "DDO 7", ["UGC 799"]),
  ];
  const scenarios: [string, number[]][] = [
    ["", [123, 400, 900]],
    ["   ", [123, 400, 900]],
    ["  nGc  ", [123]],
    ["uGc 7", [123, 900]],
    ["123", [123]],
    ["400", [400]],
    ["КарЛИК", [400]],
    ["missing", []],
  ];
  for (const [query, expectedPgcs] of scenarios) {
    test(`search ${JSON.stringify(query)} preserves matching semantics`, () => {
      const predicate = createCatalogQueryMatcher(query);
      expect(galaxies.filter(predicate).map((row) => row.pgc)).toEqual(
        expectedPgcs,
      );
      expect(
        galaxies
          .filter((row) => matchesQuery(row, query))
          .map((row) => row.pgc),
      ).toEqual(expectedPgcs);
    });
  }
});

describe("one-pass scientific bounds", () => {
  test("preserves all global extrema, including zero and negatives", () => {
    const objects: CatalogObject[] = [
      {
        ...galaxy(1, "A"),
        dist: 0,
        lvg_v_lg_kms: -150,
        lvg_v_hel_kms: -80,
        morphology_t: -5,
        b_mag: -2,
        hi21_mag: 12,
        theta1: -1.2,
      },
      {
        ...galaxy(2, "B"),
        dist: 49.45,
        lvg_v_lg_kms: 1300,
        lvg_v_hel_kms: 1230,
        morphology_t: 10,
        b_mag: 24.5,
        hi21_mag: 18,
        hi21_limit: "<",
        theta1: 2.4,
      },
      {
        ...galaxy(3, "C"),
        dist: Number.NaN,
        lvg_v_lg_kms: Number.POSITIVE_INFINITY,
        hi21_mag: 15,
        hi21_limit: "",
        theta1: null,
      },
    ];
    expect(atlasBounds(objects)).toEqual({
      distance: { min: 0, max: 49.45 },
      velocity: { min: -150, max: 1300 },
      heliocentric: { min: -80, max: 1230 },
      morphology: { min: -5, max: 10 },
      magnitude: { min: -2, max: 24.5 },
      hi21: { min: 12, max: 15 },
      tidal: { min: -1.2, max: 2.4 },
    });
  });

  test("ignores unavailable and censored data without changing the sources", () => {
    const objects = [
      {
        ...galaxy(1, "A"),
        dist: Number.POSITIVE_INFINITY,
        hi21_mag: 9,
        hi21_limit: "<",
      },
      {
        ...galaxy(2, "B"),
        dist: Number.NaN,
        hi21_mag: 19,
        hi21_limit: " upper ",
      },
    ];
    const snapshot = objects.map((row) => ({ ...row }));
    expect(atlasBounds(objects)).toEqual({
      distance: null,
      velocity: null,
      heliocentric: null,
      morphology: null,
      magnitude: null,
      hi21: null,
      tidal: null,
    });
    expect(objects).toEqual(snapshot);
  });

  test("does not change signed-zero extrema", () => {
    const bounds = atlasBounds([
      { ...galaxy(1, "A"), dist: +0 },
      { ...galaxy(2, "B"), dist: -0 },
    ]);
    expect(Object.is(bounds.distance?.min, -0)).toBe(true);
    expect(Object.is(bounds.distance?.max, +0)).toBe(true);
  });

  test("empty catalog produces only unavailable bounds", () => {
    expect(atlasBounds([])).toEqual({
      distance: null,
      velocity: null,
      heliocentric: null,
      morphology: null,
      magnitude: null,
      hi21: null,
      tidal: null,
    });
  });
});
