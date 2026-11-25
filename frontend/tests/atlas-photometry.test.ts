import { describe, expect, test } from "bun:test";
import type { CatalogObject, SpatialDistance } from "../src/api/objects.ts";
import { buildAtlasSpatialRows } from "../src/lib/atlasSpatialScene.ts";
import {
  ATLAS_MISSING_COLOR,
  ATLAS_UPPER_LIMIT_COLOR,
  atlasColorForPgc,
  buildAtlasColorEncoding,
} from "../src/lib/atlasColorEncoding.ts";
import {
  parseAtlasPhotometry,
  type AtlasPhotometryRow,
} from "../src/lib/atlasPhotometry.ts";

function row(
  pgc: number,
  patch: Partial<AtlasPhotometryRow> = {},
): AtlasPhotometryRow {
  return {
    pgc,
    log_lks_lsun: 9,
    ks_status: "measured",
    ks_method: "measured",
    log_mhi_msun: 8,
    hi_status: "detection",
    ...patch,
  };
}
function snapshot(rows: AtlasPhotometryRow[], revision = 7) {
  return parseAtlasPhotometry({
    data: {
      contract: "spatial_photometry_v1",
      revision,
      formula_version: "fixture",
      rows,
    },
  });
}
function galaxy(pgc: number, revision = 7): CatalogObject {
  const spatial: SpatialDistance = {
    pgc,
    dist_mpc: 4,
    distance_origin: "DIRECT_MEASURED",
    distance_lineage_status: "REVIEW_READY",
    distance_value_review_status: "NOT_REVIEWED",
    distance_provenance_verified: false,
    distance_3d_eligible: false,
    distance_computed_revision: revision,
    distance_formula_version: "fixture",
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
    spatial_distance: spatial,
  };
}
describe("Spatial photometry colour encoding", () => {
  test("H I limits are not detections or scale endpoints", () => {
    const rows = buildAtlasSpatialRows(
      [galaxy(1), galaxy(2), galaxy(3)],
      "ICRS",
    );
    const encoding = buildAtlasColorEncoding(
      rows,
      "massHi",
      snapshot([
        row(1),
        row(2, { log_mhi_msun: 12, hi_status: "upper_limit" }),
        row(3, { log_mhi_msun: null, hi_status: "unavailable" }),
      ]),
    );
    expect(encoding.scale?.min).toBe(8);
    expect(encoding.scale?.max).toBe(8);
    expect(encoding.limits.get(2)).toBe(12);
    expect(atlasColorForPgc(encoding, 2)).toBe(ATLAS_UPPER_LIMIT_COLOR);
    expect(atlasColorForPgc(encoding, 3)).toBe(ATLAS_MISSING_COLOR);
  });
  test("ratio is logarithmic and preserves upper limit and estimated K", () => {
    const rows = buildAtlasSpatialRows(
      [galaxy(1), galaxy(2), galaxy(3)],
      "ICRS",
    );
    const encoding = buildAtlasColorEncoding(
      rows,
      "hiToK",
      snapshot([
        row(1),
        row(2, { ks_status: "estimated", hi_status: "upper_limit" }),
        row(3, { log_lks_lsun: null, ks_status: "unavailable" }),
      ]),
    );
    expect(encoding.values.get(1)).toBe(-1);
    expect(encoding.limits.get(2)).toBe(-1);
    expect(encoding.estimated.has(2)).toBe(true);
    expect(encoding.values.has(3)).toBe(false);
  });
  test("K luminosity does not depend on H I availability", () => {
    const encoding = buildAtlasColorEncoding(
      buildAtlasSpatialRows([galaxy(1)], "ICRS"),
      "luminosityK",
      snapshot([
        row(1, {
          ks_status: "estimated",
          log_mhi_msun: null,
          hi_status: "unavailable",
        }),
      ]),
    );
    expect(encoding.values.get(1)).toBe(9);
    expect(encoding.estimated.has(1)).toBe(true);
  });
  test("stale snapshot cannot colour newer distance evidence", () => {
    const encoding = buildAtlasColorEncoding(
      buildAtlasSpatialRows([galaxy(1, 8)], "ICRS"),
      "massHi",
      snapshot([row(1)]),
    );
    expect(encoding.scale).toBeNull();
    expect(atlasColorForPgc(encoding, 1)).toBe(ATLAS_MISSING_COLOR);
  });
  test("invalid payload or duplicate identities fail closed", () => {
    expect(() => snapshot([row(1), row(1)])).toThrow();
    expect(() => snapshot([row(1, { log_mhi_msun: null })])).toThrow();
    expect(() => snapshot([row(1, { log_lks_lsun: Number.NaN })])).toThrow();
    expect(() => snapshot([])).toThrow();
  });
});
