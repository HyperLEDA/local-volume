import { describe, expect, test } from "bun:test";
import { findReticleTarget, markerDiameter } from "../src/lib/reticle.ts";
import type { CatalogObject } from "../src/api/objects.ts";

function object(
  pgc: number,
  ra: number | null,
  bt: number | null = null,
): CatalogObject {
  return {
    pgc,
    name: `PGC ${pgc}`,
    ra,
    dec: 0,
    bt,
    v_hel: null,
    type_name: null,
    names: [],
  };
}

const viewport = [800, 600] as const;
function project(ra: number, dec: number): [number, number] {
  return [ra, 300 + dec];
}

describe("reticle popup matching", () => {
  test("selects a galaxy whose marker is under the center", () => {
    expect(findReticleTarget([object(7, 400)], viewport, project)?.pgc).toBe(7);
  });

  test("does not select a marker outside the hit radius", () => {
    expect(findReticleTarget([object(7, 415)], viewport, project)).toBeNull();
  });

  test("uses the marker diameter when determining the hit radius", () => {
    expect(markerDiameter(10)).toBeGreaterThan(markerDiameter(null));
    expect(
      findReticleTarget([object(7, 410, 10)], viewport, project)?.pgc,
    ).toBe(7);
    expect(
      findReticleTarget([object(7, 410, null)], viewport, project),
    ).toBeNull();
  });

  test("allows a small margin for the active marker to avoid flicker", () => {
    const sample = [object(7, 409)];
    expect(findReticleTarget(sample, viewport, project)).toBeNull();
    expect(findReticleTarget(sample, viewport, project, 7)?.pgc).toBe(7);
  });

  test("picks the closest overlapping source", () => {
    expect(
      findReticleTarget([object(7, 403), object(8, 401)], viewport, project)
        ?.pgc,
    ).toBe(8);
  });

  test("ignores absent coordinates, invalid projections and empty viewport", () => {
    expect(findReticleTarget([object(7, null)], viewport, project)).toBeNull();
    expect(findReticleTarget([object(7, 400)], [0, 600], project)).toBeNull();
    expect(
      findReticleTarget([object(7, 400)], viewport, () => [NaN, 1]),
    ).toBeNull();
    expect(
      findReticleTarget([object(7, 400)], viewport, () => {
        throw new Error("invalid projection");
      }),
    ).toBeNull();
  });

  test("respects filtering by checking only the supplied subset", () => {
    expect(findReticleTarget([object(9, 500)], viewport, project)).toBeNull();
  });
});

describe("reticle popup stability", () => {
  test("retains the active marker during small shifts, even near another marker", () => {
    const sources = [object(7, 413), object(8, 400)];
    expect(findReticleTarget(sources, viewport, project)?.pgc).toBe(8);
    expect(findReticleTarget(sources, viewport, project, 7)?.pgc).toBe(7);
  });

  test("changes to the new target after leaving the active release radius", () => {
    const sources = [object(7, 415), object(8, 400)];
    expect(findReticleTarget(sources, viewport, project, 7)?.pgc).toBe(8);
  });
});
