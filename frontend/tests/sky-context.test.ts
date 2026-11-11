import { describe, expect, test } from "bun:test";
import type { CatalogObject } from "../src/api/objects.ts";
import { otherSkyObjects } from "../src/lib/skyContext.ts";

function galaxy(
  pgc: number,
  ra: number | null,
  dec: number | null,
): CatalogObject {
  return {
    pgc,
    name: `PGC ${pgc}`,
    ra,
    dec,
    bt: null,
    v_hel: null,
    type_name: "G",
    names: [],
  };
}

describe("otherSkyObjects", () => {
  test("excludes the selected galaxy while retaining other objects", () => {
    const result = otherSkyObjects(
      [galaxy(10, 10, 20), galaxy(20, 10.1, 20.2)],
      10,
    );
    expect(result.map((object) => object.pgc)).toEqual([20]);
  });

  test("rejects missing or nonfinite positions and invalid declinations", () => {
    const result = otherSkyObjects(
      [
        galaxy(1, null, 0),
        galaxy(2, 5, null),
        galaxy(3, NaN, 0),
        galaxy(4, 5, Infinity),
        galaxy(5, 5, 90.01),
        galaxy(6, 5, -90.01),
        galaxy(7, 5, 90),
        galaxy(8, 5, -90),
      ],
      99,
    );
    expect(result.map((object) => object.pgc)).toEqual([7, 8]);
  });

  test("deduplicates catalog identifiers", () => {
    const result = otherSkyObjects(
      [galaxy(20, 10, 10), galaxy(20, 20, 20), galaxy(30, 30, 30)],
      10,
    );
    expect(result.map((object) => object.pgc)).toEqual([20, 30]);
  });

  test("does not reject positions around the RA=0 boundary", () => {
    const result = otherSkyObjects(
      [galaxy(1, 359.999, 2), galaxy(2, 0.001, 2), galaxy(3, 360, 2)],
      99,
    );
    expect(result.map((object) => object.pgc)).toEqual([1, 2, 3]);
  });

  test("does not impose an angular cutoff when the user pans or zooms", () => {
    expect(otherSkyObjects([galaxy(20, 190, -25)], 10)).toHaveLength(1);
  });

  test("leaves the API source array unchanged", () => {
    const objects = [galaxy(10, 10, 10), galaxy(20, 20, 20)];
    const snapshot = structuredClone(objects);
    otherSkyObjects(objects, 10);
    expect(objects).toEqual(snapshot);
  });
});
