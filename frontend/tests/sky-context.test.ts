import { describe, expect, test } from "bun:test";
import type { CatalogObject } from "../src/api/objects.ts";
import { otherSkyObjects } from "../src/lib/skyContext.ts";

function galaxy(pgc: number, ra: number | null, dec: number | null): CatalogObject {
  return { pgc, name: `PGC ${pgc}`, ra, dec, bt: null, v_hel: null, type_name: "G", names: [] };
}

describe("otherSkyObjects", () => {
  test("excludes the selected galaxy while retaining close neighbors", () => {
    const found = otherSkyObjects(
      [galaxy(10, 10, 20), galaxy(20, 10.1, 20.2)], 10, { ra: 10, dec: 20 },
    );
    expect(found.map((object) => object.pgc)).toEqual([20]);
  });

  test("rejects missing or nonfinite coordinates and invalid declinations", () => {
    const objects = [
      galaxy(1, null, 0), galaxy(2, 5, null), galaxy(3, NaN, 0),
      galaxy(4, 5, Infinity), galaxy(5, 5, 90.01), galaxy(6, 5, -90.01),
      galaxy(7, 5, 90), galaxy(8, 5, -90),
    ];
    const found = otherSkyObjects(objects, 99, { ra: 5, dec: 0 }, 180);
    expect(found.map((object) => object.pgc)).toEqual([7, 8]);
  });

  test("deduplicates PGC identifiers", () => {
    const objects = [galaxy(20, 10, 10), galaxy(20, 20, 20), galaxy(30, 30, 30)];
    const found = otherSkyObjects(objects, 10, { ra: 20, dec: 20 }, 180);
    expect(found.map((object) => object.pgc)).toEqual([20, 30]);
  });

  test("keeps valid coordinates across RA=0/360", () => {
    const objects = [galaxy(1, 359.999, 2), galaxy(2, 0.001, 2), galaxy(3, 360, 2)];
    const found = otherSkyObjects(objects, 99, { ra: 0, dec: 2 }, 2);
    expect(found.map((object) => object.pgc)).toEqual([1, 2, 3]);
  });

  test("enforces the current sky-selection radius", () => {
    const objects = [galaxy(20, 190, -25)];
    expect(otherSkyObjects(objects, 10, { ra: 0, dec: 0 })).toHaveLength(0);
    expect(otherSkyObjects(objects, 10, { ra: 190, dec: -25 })).toHaveLength(1);
  });

  test("leaves its source array unchanged", () => {
    const objects = [galaxy(10, 10, 10), galaxy(20, 20, 20)];
    const before = structuredClone(objects);
    otherSkyObjects(objects, 10, { ra: 10, dec: 10 }, 180);
    expect(objects).toEqual(before);
  });
});
