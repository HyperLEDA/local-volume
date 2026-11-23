import { describe, expect, test } from "bun:test";
import type { GroupDetail, GroupMember } from "../src/api/groups.ts";
import { buildCelestialSubgroups } from "../src/lib/groupCelestialSubgroups.ts";

function member(
  pgc: number,
  ra: number,
  dec: number,
  parent: number | null,
): GroupMember {
  return {
    pgc,
    name: `PGC ${pgc}`,
    ra,
    dec,
    parent_md_pgc: parent,
    group_id: 1,
    hierarchy_depth: parent === null ? 0 : 1,
    membership_status: parent === null ? "root" : "computed",
    source_status: "computed",
    theta1_source: null,
    dist_mpc: null,
    morphology_t: null,
    b_mag: null,
    lvg_v_lg_kms: null,
    theta1_computed: null,
    md_pgc_computed: null,
    environment_coverage: null,
  };
}
function group(members: GroupMember[]): GroupDetail {
  return {
    group_id: 1,
    root_pgc: 10,
    name: "Mock group",
    definition: "physical",
    data_status: "computed",
    source_catalog: "test",
    source_version: "unit",
    source_sha256: null,
    source_description: null,
    root_ra: members[0].ra,
    root_dec: members[0].dec,
    distance_mpc: null,
    extent_kpc: null,
    member_count: members.length,
    subgroup_count: 1,
    unconfirmed_count: null,
    tidal_min: null,
    tidal_max: null,
    members,
  };
}

describe("#64 Stage 03d: stable, celestial-frame contours", () => {
  test("the same group yields byte-for-byte identical sky polygons irrespective of cursor and zoom", () => {
    const g = group([
      member(10, 100, 20, null),
      member(11, 100.8, 20, 10),
      member(12, 101.6, 20, 11),
      member(13, 102.5, 20.6, 10),
    ]);
    const a = buildCelestialSubgroups(g);
    const b = buildCelestialSubgroups(g);
    expect(a).toHaveLength(1);
    expect(a[0].memberPgcs).toEqual([11, 12]);
    expect(a[0].polygons).toEqual(b[0].polygons);
    expect(a[0].containsSky(100.8, 20)).toBe(true);
    expect(a[0].containsSky(101.6, 20)).toBe(true);
    expect(a[0].containsSky(102.5, 20.6)).toBe(false);
  });
  test("RA wraps without creating a second footprint", () => {
    const g = group([
      member(10, 359.2, 6, null),
      member(11, 359.7, 6, 10),
      member(12, 0.2, 6, 11),
      member(13, 2.2, 7, 10),
    ]);
    const a = buildCelestialSubgroups(g);
    expect(a).toHaveLength(1);
    expect(a[0].containsSky(359.7, 6)).toBe(true);
    expect(a[0].containsSky(0.2, 6)).toBe(true);
    expect(a[0].containsSky(2.2, 7)).toBe(false);
  });
  test("a foreground galaxy on the relation is not considered a subgroup member", () => {
    const g = group([
      member(10, 100, 20, null),
      member(11, 100.6, 20, 10),
      member(12, 101.7, 20, 11),
      member(13, 101.15, 20, 10),
      member(14, 103, 20.8, 10),
    ]);
    const a = buildCelestialSubgroups(g);
    expect(a).toHaveLength(1);
    expect(a[0].containsSky(11, 20)).toBe(false);
    expect(a[0].containsSky(101.15, 20)).toBe(false);
    expect(a[0].containsSky(100.6, 20)).toBe(true);
  });
  test("no unsupported parent links are introduced by proximity", () => {
    const g = group([
      member(10, 100, 20, null),
      member(11, 100.8, 20, 10),
      member(12, 101.6, 20, 11),
      member(13, 101.61, 20, 10),
    ]);
    expect(buildCelestialSubgroups(g).length).toBeLessThanOrEqual(1);
  });
});
