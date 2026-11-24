import { describe, expect, test } from "bun:test";
import type {
  GroupDetail,
  GroupMembership,
  GroupMember,
} from "../src/api/groups.ts";
import type { CatalogObject } from "../src/api/objects.ts";
import {
  atlasActiveMembership,
  atlasMembershipChoices,
  buildAtlasGroupGraph,
  createAtlasGroupResolver,
  validateAtlasGroup,
} from "../src/lib/atlasGroupContext.ts";

const membership: GroupMembership = {
  group_id: -1,
  root_pgc: 1,
  name: "Host",
  definition: "physical",
  data_status: "computed",
  source_catalog: "LV",
  source_version: "1",
  source_sha256: null,
  source_description: null,
  member_pgc: 2,
  parent_md_pgc: 1,
  membership_status: "computed",
  source_status: "computed",
  hierarchy_depth: 1,
};
function member(
  pgc: number,
  parent: number | null,
  status: GroupMember["membership_status"] = "computed",
): GroupMember {
  return {
    group_id: -1,
    pgc,
    name: `PGC ${pgc}`,
    parent_md_pgc: parent,
    hierarchy_depth: parent === null ? 0 : 1,
    membership_status: status,
    source_status: "computed",
    theta1_source: null,
    ra: pgc,
    dec: 0,
    dist_mpc: null,
    morphology_t: null,
    b_mag: null,
    lvg_v_lg_kms: null,
    theta1_computed: 1,
    md_pgc_computed: parent,
    environment_coverage: null,
  };
}
const detail: GroupDetail = {
  group_id: -1,
  root_pgc: 1,
  name: "Host",
  definition: "physical",
  data_status: "computed",
  source_catalog: "LV",
  source_version: "1",
  source_sha256: null,
  root_ra: 1,
  root_dec: 0,
  distance_mpc: null,
  extent_kpc: null,
  member_count: 4,
  subgroup_count: 0,
  unconfirmed_count: 1,
  source_description: null,
  tidal_min: null,
  tidal_max: null,
  members: [
    member(1, null, "root"),
    member(2, 1),
    member(3, 2),
    member(4, 1, "unconfirmed"),
  ],
};
function row(pgc: number): CatalogObject {
  return {
    pgc,
    name: `PGC ${pgc}`,
    ra: pgc,
    dec: 0,
    bt: null,
    v_hel: null,
    type_name: null,
    names: [],
  };
}
describe("#64 Atlas resolved group context", () => {
  test("automatically selects the physical group even when other definitions coexist", () => {
    const suite: GroupMembership = { ...membership, definition: "suite" };
    const published: GroupMembership = {
      ...membership,
      group_id: 17,
      definition: "published",
    };
    const choices = atlasMembershipChoices(
      [suite, membership, membership, published],
      2,
    );
    expect(choices).toHaveLength(3);
    expect(atlasActiveMembership(choices)).toEqual(membership);
    expect(atlasActiveMembership([membership])).toEqual(membership);
    expect(atlasActiveMembership([suite, published])).toBeNull();
    expect(atlasActiveMembership([])).toBeNull();
  });
  test("does not silently resolve competing physical memberships or candidates", () => {
    const conflicting: GroupMembership = {
      ...membership,
      group_id: -8,
      root_pgc: 8,
    };
    expect(
      atlasActiveMembership(
        atlasMembershipChoices([membership, conflicting], 2),
      ),
    ).toBeNull();
    expect(
      atlasActiveMembership(
        atlasMembershipChoices(
          [{ ...membership, membership_status: "unconfirmed" }],
          2,
        ),
      ),
    ).toBeNull();
  });
  test("a root galaxy uses its own resolved physical membership", () => {
    const root: GroupMembership = {
      ...membership,
      member_pgc: 1,
      parent_md_pgc: null,
      membership_status: "root",
      hierarchy_depth: 0,
    };
    expect(atlasActiveMembership(atlasMembershipChoices([root], 1))).toEqual(
      root,
    );
    expect(atlasActiveMembership(atlasMembershipChoices([root], 2))).toBeNull();
  });
  test("does not turn candidates, invalid identities or another galaxy into accepted membership", () => {
    expect(
      atlasMembershipChoices(
        [
          { ...membership, membership_status: "unconfirmed" },
          { ...membership, group_id: 99 },
          { ...membership, member_pgc: 7 },
        ],
        2,
      ),
    ).toEqual([]);
    expect(atlasMembershipChoices([], 2)).toEqual([]);
  });
  test("rejects changed provenance, selected-member status and contradictory group identity", () => {
    expect(validateAtlasGroup(detail, membership)).toBe(detail);
    expect(() =>
      validateAtlasGroup({ ...detail, source_version: "2" }, membership),
    ).toThrow();
    expect(() =>
      validateAtlasGroup({ ...detail, group_id: -8 }, membership),
    ).toThrow();
    expect(() =>
      validateAtlasGroup(
        { ...detail, members: detail.members.filter((m) => m.pgc !== 2) },
        membership,
      ),
    ).toThrow();
  });
  test("uses the exact hierarchy, excludes candidates and never adds nearby nonmembers", () => {
    const graph = buildAtlasGroupGraph(detail, [
      row(1),
      row(2),
      row(3),
      row(4),
      row(5),
    ]);
    expect(graph.points.map((p) => p.pgc)).toEqual([1, 2, 3]);
    expect(
      graph.arcs.map(({ edge }) => [edge.memberPgc, edge.parentPgc]),
    ).toEqual([
      [2, 1],
      [3, 2],
    ]);
    expect(graph.candidateCount).toBe(1);
    expect(buildAtlasGroupGraph(detail, [row(1), row(2)]).omittedEdges).toBe(1);
  });
  test("deduplicates simultaneous loads, isolates definitions and retries failed fetches", async () => {
    let calls = 0;
    const resolver = createAtlasGroupResolver(
      () => {
        calls++;
        if (calls === 1) return Promise.reject(new Error("offline"));
        return Promise.resolve([membership]);
      },
      () => Promise.resolve(detail),
    );
    await expect(resolver.memberships(2)).rejects.toThrow();
    const [a, b] = await Promise.all([
      resolver.memberships(2),
      resolver.memberships(2),
    ]);
    expect(a).toEqual(b);
    expect(calls).toBe(2);
    expect(await resolver.detail(membership)).toBe(detail);
    await expect(
      resolver.detail({ ...membership, definition: "suite" }),
    ).rejects.toThrow();
  });
});
