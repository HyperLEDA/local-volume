import { describe, expect, test } from "bun:test";
import type { CatalogObject, SpatialDistance } from "../src/api/objects.ts";
import type { GroupSummary } from "../src/api/groups.ts";
import {
  atlasFieldPartition,
  validatePhysicalGroupSnapshot,
  isAtlasGroupDoubleTap,
  atlasMarkerHits,
  atlasScopePoints,
  atlasSceneExtent,
  atlasVisiblePoints,
  buildAtlasGroupBubbles,
  buildAtlasSpatialRows,
} from "../src/lib/atlasSpatialScene.ts";

function galaxy(
  pgc: number,
  evidence: Partial<SpatialDistance> | null = {},
  patch: Partial<CatalogObject> = {},
): CatalogObject {
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
    spatial_distance:
      evidence === null
        ? null
        : {
            pgc,
            dist_mpc: 4,
            distance_origin: "DIRECT_MEASURED",
            distance_lineage_status: "REVIEW_READY",
            distance_value_review_status: "NOT_REVIEWED",
            distance_provenance_verified: false,
            distance_3d_eligible: false,
            ...evidence,
          },
    ...patch,
  };
}
describe("Global spatial atlas prototype", () => {
  test("uses only the adopted spatial contract, never legacy dist", () => {
    const row = buildAtlasSpatialRows(
      [galaxy(1), galaxy(2, null), galaxy(3, { pgc: 4 })],
      "ICRS",
    );
    expect(row[0].position).toEqual([4, 0, 0]);
    expect(row[0].verified).toBe(false);
    expect(row[1].position).toBeNull();
    expect(row[2].position).toBeNull();
  });
  test("unknown distances, invalid directions, duplicate PGC and observer host never gain positions", () => {
    const rows = buildAtlasSpatialRows(
      [
        galaxy(1, { dist_mpc: null }),
        galaxy(2, { dist_mpc: -1 }),
        galaxy(3, {}, { dec: 91 }),
        galaxy(4),
        galaxy(4),
        galaxy(5064336),
      ],
      "SUPERGALACTIC",
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.position === null)).toBe(true);
  });
  test("independent, assigned and model positions stay separated; strict review fails closed", () => {
    const approved = {
      distance_3d_eligible: true,
      distance_provenance_verified: true,
      distance_value_review_status: "VERIFIED",
    } as const;
    const rows = buildAtlasSpatialRows(
      [
        galaxy(1),
        galaxy(2, { distance_origin: "GROUP_ASSIGNED", ...approved }),
        galaxy(3, { distance_origin: "MODEL_INFERRED" }),
        galaxy(4, { distance_origin: "UNKNOWN" }),
        galaxy(5, approved),
      ],
      "ICRS",
    );
    expect(
      atlasVisiblePoints(rows, "individual").map((r) => r.object.pgc),
    ).toEqual([1, 5]);
    expect(
      atlasVisiblePoints(rows, "verified").map((r) => r.object.pgc),
    ).toEqual([5]);
    expect(atlasVisiblePoints(rows, "catalogue")).toHaveLength(5);
  });
  test("frame changes retain radius in Mpc and never truncate a distant catalogue value", () => {
    const source = [galaxy(1, { dist_mpc: 19 }, { ra: 359.9, dec: 89.9 })];
    for (const frame of ["ICRS", "GALACTIC", "SUPERGALACTIC"] as const) {
      const rows = buildAtlasSpatialRows(source, frame);
      expect(
        atlasSceneExtent(atlasVisiblePoints(rows, "individual")),
      ).toBeCloseTo(19, 8);
    }
    expect(source[0].dist).toBe(99);
  });
  test("11 Mpc view is explicit, frame-invariant and independent of legacy distance", () => {
    const source = [
      galaxy(1, { dist_mpc: 11 }, { ra: 123, dec: -55 }),
      galaxy(2, { dist_mpc: 11.001 }),
      galaxy(3, { dist_mpc: 2 }, { dist: 99 }),
      galaxy(4, { dist_mpc: 3, distance_origin: "GROUP_ASSIGNED" }),
    ];
    for (const frame of ["ICRS", "GALACTIC", "SUPERGALACTIC"] as const) {
      const rows = buildAtlasSpatialRows(source, frame);
      const mode = atlasVisiblePoints(rows, "individual");
      expect(atlasScopePoints(mode, true).map((r) => r.object.pgc)).toEqual([
        1, 3,
      ]);
      expect(atlasScopePoints(mode, false).map((r) => r.object.pgc)).toEqual([
        1, 2, 3,
      ]);
      expect(
        atlasScopePoints(atlasVisiblePoints(rows, "catalogue"), true).map(
          (r) => r.object.pgc,
        ),
      ).toEqual([1, 3, 4]);
      expect(rows).toHaveLength(4);
    }
    expect(source[2].dist).toBe(99);
  });
  function physical(
    pgc: number,
    patch: Partial<GroupSummary> = {},
  ): GroupSummary {
    return {
      group_id: -pgc,
      root_pgc: pgc,
      name: `Group ${pgc}`,
      definition: "physical",
      data_status: "computed",
      source_catalog: "fixture",
      source_version: "1",
      source_sha256: null,
      root_ra: 0,
      root_dec: 0,
      distance_mpc: 4,
      extent_kpc: 250,
      member_count: 7,
      subgroup_count: 0,
      unconfirmed_count: null,
      ...patch,
    };
  }
  test("physical group bubbles use canonical root and full projected extent, never MD buckets", () => {
    const rows = buildAtlasSpatialRows(
      [
        galaxy(10, {}, { md_pgc: 200 }),
        galaxy(11, {}, { md_pgc: 10 }),
        galaxy(12, {}, { md_pgc: 10 }),
      ],
      "ICRS",
    );
    const points = atlasVisiblePoints(rows, "individual");
    const groups = buildAtlasGroupBubbles(points, [
      physical(10),
      physical(11, { definition: "suite" }),
      physical(200),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].pgc).toBe(10);
    expect(groups[0].position).toEqual([4, 0, 0]);
    expect(groups[0].radiusMpc).toBe(0.25);
    expect(groups[0].memberCount).toBe(7);
    expect(
      buildAtlasGroupBubbles(points.slice(0, 1), [physical(10)])[0].radiusMpc,
    ).toBe(0.25);
    expect(buildAtlasGroupBubbles(points.slice(1), [physical(10)])).toEqual([]);
  });
  test("physical group bubbles reject mismatched identity, duplicate roots, missing radius and incompatible evidence", () => {
    const points = atlasVisiblePoints(
      buildAtlasSpatialRows(
        [galaxy(10), galaxy(11, { distance_origin: "GROUP_ASSIGNED" })],
        "ICRS",
      ),
      "individual",
    );
    expect(
      buildAtlasGroupBubbles(points, [physical(10, { group_id: 10 })]),
    ).toEqual([]);
    expect(
      buildAtlasGroupBubbles(points, [physical(10), physical(10)]),
    ).toEqual([]);
    expect(
      buildAtlasGroupBubbles(points, [physical(10, { extent_kpc: null })]),
    ).toEqual([]);
    expect(
      buildAtlasGroupBubbles(points, [physical(10, { extent_kpc: 0 })]),
    ).toEqual([]);
    expect(
      buildAtlasGroupBubbles(points, [physical(10, { distance_mpc: 5 })]),
    ).toEqual([]);
    expect(
      buildAtlasGroupBubbles(points, [physical(10, { root_dec: 1 })]),
    ).toEqual([]);
    expect(buildAtlasGroupBubbles(points, [physical(11)])).toEqual([]);
    expect(
      buildAtlasGroupBubbles(points, [physical(10, { root_ra: 360 })]),
    ).toHaveLength(1);
  });
  test("field partition follows full canonical membership even when the root is hidden", () => {
    const snapshot = validatePhysicalGroupSnapshot({
      catalogue_pgcs: [10, 11, 12, 13],
      groups: [
        { ...physical(10, { member_count: 3 }), member_pgcs: [10, 11, 12] },
      ],
    });
    const points = atlasVisiblePoints(
      buildAtlasSpatialRows(
        [galaxy(11), galaxy(13, {}, { md_pgc: 10 }), galaxy(14)],
        "ICRS",
      ),
      "individual",
    );
    const result = atlasFieldPartition(points, snapshot);
    expect(result.field.map((p) => p.object.pgc)).toEqual([13]);
    expect(result.grouped).toBe(1);
    expect(result.unavailable).toBe(1);
    expect(atlasFieldPartition(points, null).field).toEqual([]);
  });
  test("membership snapshot rejects partial, duplicate, conflicting and non-physical data", () => {
    const group = {
      ...physical(10, { member_count: 3 }),
      member_pgcs: [10, 11, 12],
    };
    const cataloguePgcs = [10, 11, 12, 13, 14];
    expect(() =>
      validatePhysicalGroupSnapshot({
        catalogue_pgcs: cataloguePgcs,
        groups: [{ ...group, member_pgcs: [10, 11] }],
      }),
    ).toThrow();
    expect(() =>
      validatePhysicalGroupSnapshot({
        catalogue_pgcs: cataloguePgcs,
        groups: [
          group,
          { ...physical(13, { member_count: 3 }), member_pgcs: [13, 14, 12] },
        ],
      }),
    ).toThrow();
    expect(() =>
      validatePhysicalGroupSnapshot({
        catalogue_pgcs: cataloguePgcs,
        groups: [{ ...group, definition: "suite" }],
      }),
    ).toThrow();
    expect(() =>
      validatePhysicalGroupSnapshot({
        catalogue_pgcs: [10, 11, 11, 12],
        groups: [group],
      }),
    ).toThrow();
    expect(() =>
      validatePhysicalGroupSnapshot({
        catalogue_pgcs: [10, 11],
        groups: [group],
      }),
    ).toThrow();
    expect(
      validatePhysicalGroupSnapshot({
        catalogue_pgcs: cataloguePgcs,
        groups: [],
      }).groups,
    ).toEqual([]);
  });
  test("double tap requires identical group and close time and screen position", () => {
    const tap = { pgc: 1, time: 100, x: 40, y: 50 };
    expect(isAtlasGroupDoubleTap(null, tap)).toBe(false);
    expect(isAtlasGroupDoubleTap(tap, { ...tap, time: 250, x: 42 })).toBe(true);
    expect(isAtlasGroupDoubleTap(tap, { ...tap, time: 250, pgc: 2 })).toBe(
      false,
    );
    expect(isAtlasGroupDoubleTap(tap, { ...tap, time: 600 })).toBe(false);
    expect(isAtlasGroupDoubleTap(tap, { ...tap, time: 250, x: 60 })).toBe(
      false,
    );
  });
  test("overlap requires a choice, not an arbitrary single PGC", () => {
    const markers = [
      { pgc: 1, x: 10, y: 10, depth: 0.1, radius: 6 },
      { pgc: 2, x: 10, y: 11, depth: -0.1, radius: 6 },
      { pgc: 3, x: 10, y: 10, depth: 2, radius: 6 },
    ];
    expect(atlasMarkerHits(markers, 10, 10)).toEqual([2, 1]);
    expect(atlasMarkerHits(markers, 50, 50)).toEqual([]);
  });
});
