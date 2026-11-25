import { describe, expect, test } from "bun:test";
import type { CatalogObject, SpatialDistance } from "../src/api/objects.ts";
import { buildAtlasSpatialRows } from "../src/lib/atlasSpatialScene.ts";
import {
  ATLAS_MISSING_COLOR,
  atlasColorForPgc,
  atlasNumericColor,
  buildAtlasColorEncoding,
} from "../src/lib/atlasColorEncoding.ts";

function galaxy(
  pgc: number,
  distance: number | null,
  patch: Partial<CatalogObject> = {},
): CatalogObject {
  const spatial: SpatialDistance = {
    pgc,
    dist_mpc: distance,
    distance_origin: "DIRECT_MEASURED",
    distance_lineage_status: "REVIEW_READY",
    distance_value_review_status: "NOT_REVIEWED",
    distance_provenance_verified: false,
    distance_3d_eligible: false,
  };
  return {
    pgc,
    name: `PGC ${pgc}`,
    ra: 0,
    dec: 0,
    bt: null,
    v_hel: null,
    type_name: "G",
    names: [],
    dist: 99,
    spatial_distance: spatial,
    ...patch,
  };
}
describe("Spatial Atlas colour encoding", () => {
  test("adopted distance domain ignores legacy dist and unpositioned objects", () => {
    const rows = buildAtlasSpatialRows(
      [galaxy(1, 2), galaxy(2, 8), galaxy(3, null), galaxy(4, 50, { dec: 95 })],
      "ICRS",
    );
    const encoding = buildAtlasColorEncoding(rows, "distance");
    expect(encoding.scale?.min).toBe(2);
    expect(encoding.scale?.max).toBe(8);
    expect(atlasColorForPgc(encoding, 1)).toBe(encoding.scale?.stops[0]);
    expect(atlasColorForPgc(encoding, 2)).toBe(encoding.scale?.stops[2]);
    expect(atlasColorForPgc(encoding, 3)).toBe(ATLAS_MISSING_COLOR);
    expect(atlasColorForPgc(encoding, 4)).toBe(ATLAS_MISSING_COLOR);
  });
  test("velocity uses VLG, zero remains data, missing is distinct", () => {
    const rows = buildAtlasSpatialRows(
      [
        galaxy(1, 4, { lvg_v_lg_kms: -100 }),
        galaxy(2, 4, { lvg_v_lg_kms: 0 }),
        galaxy(3, 4, { lvg_v_lg_kms: 300 }),
        galaxy(4, 4, { v_hel: 900 }),
      ],
      "ICRS",
    );
    const encoding = buildAtlasColorEncoding(rows, "velocity");
    expect(encoding.scale?.min).toBe(-300);
    expect(encoding.scale?.max).toBe(300);
    expect(atlasColorForPgc(encoding, 2)).toBe(encoding.scale?.stops[1]);
    expect(atlasColorForPgc(encoding, 4)).toBe(ATLAS_MISSING_COLOR);
    expect(encoding.values.size).toBe(3);
  });
  test("absolute magnitude never falls back to apparent magnitude", () => {
    const rows = buildAtlasSpatialRows(
      [
        galaxy(1, 4, { abs_b_mag: -20 }),
        galaxy(2, 4, { abs_b_mag: -9 }),
        galaxy(3, 4, { b_mag: 15 }),
      ],
      "ICRS",
    );
    const encoding = buildAtlasColorEncoding(rows, "absoluteB");
    expect(encoding.scale?.min).toBe(-20);
    expect(encoding.scale?.max).toBe(-9);
    expect(atlasColorForPgc(encoding, 3)).toBe(ATLAS_MISSING_COLOR);
  });
  test("signed tidal index uses a zero-centred range even for one-sided data", () => {
    const encoding = buildAtlasColorEncoding(
      buildAtlasSpatialRows(
        [galaxy(1, 4, { theta1: 2 }), galaxy(2, 4, { theta1: 4 })],
        "ICRS",
      ),
      "theta",
    );
    expect(encoding.scale?.min).toBe(-4);
    expect(encoding.scale?.max).toBe(4);
    expect(atlasNumericColor(encoding.scale, 0)).toBe(encoding.scale?.stops[1]);
  });
  test("constant and missing domains do not invent a range", () => {
    const rows = buildAtlasSpatialRows(
      [galaxy(1, 4), galaxy(2, 4, { theta1: Number.NaN })],
      "ICRS",
    );
    const constant = buildAtlasColorEncoding(rows, "distance");
    expect(constant.scale?.min).toBe(4);
    expect(constant.scale?.max).toBe(4);
    expect(atlasColorForPgc(constant, 1)).toBe(constant.scale?.stops[1]);
    expect(buildAtlasColorEncoding(rows, "theta").scale).toBeNull();
    expect(atlasColorForPgc(buildAtlasColorEncoding(rows, "theta"), 2)).toBe(
      ATLAS_MISSING_COLOR,
    );
  });
  test("domain and PGC colours do not change between coordinate frames", () => {
    const sample = [galaxy(1, 4), galaxy(2, 10), galaxy(3, 20)];
    const a = buildAtlasColorEncoding(
      buildAtlasSpatialRows(sample, "ICRS"),
      "distance",
    );
    const b = buildAtlasColorEncoding(
      buildAtlasSpatialRows(sample, "SUPERGALACTIC"),
      "distance",
    );
    expect(a.scale).toEqual(b.scale);
    expect(atlasColorForPgc(a, 2)).toBe(atlasColorForPgc(b, 2));
    expect(
      buildAtlasColorEncoding(
        buildAtlasSpatialRows(sample, "ICRS"),
        "morphology",
      ).scale,
    ).toBeNull();
  });
});
