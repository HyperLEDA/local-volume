import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { GroupMember } from "../src/api/groups.ts";
import {
  groupSubgroups,
  subgroupScreenFootprint,
} from "../src/lib/groupSubgroups.ts";
import {
  groupTidalEdges,
  tidalEdgeTooltip,
} from "../src/lib/groupTidalEdges.ts";

function member(
  pgc: number,
  parent: number | null,
  ra = pgc / 10,
): GroupMember {
  return {
    group_id: -1,
    pgc,
    name: `G${pgc}`,
    parent_md_pgc: parent,
    hierarchy_depth: parent === null ? 0 : 1,
    membership_status: parent === null ? "root" : "computed",
    source_status: "computed",
    theta1_source: null,
    ra,
    dec: 10,
    dist_mpc: 4,
    morphology_t: null,
    b_mag: null,
    lvg_v_lg_kms: null,
    md_pgc_computed: parent,
    theta1_computed: parent === null ? null : 0.2,
    environment_coverage: "complete",
  };
}

describe("#64 Stage 03: projected MD substructures and semantic tidal overlays", () => {
  test("subgroups are made from the actual descendant tree, never a nearest-neighbour guess", () => {
    const members = [
      member(100, null),
      member(101, 100),
      member(102, 101),
      member(103, 102),
      member(104, 100),
      member(105, 104),
    ];
    const groups = groupSubgroups(members, 100);
    expect(groups.map((group) => group.mdPgc)).toEqual([101, 102, 104]);
    expect(groups[0].memberPgcs.sort((a, b) => a - b)).toEqual([101, 102, 103]);
    expect(groups[2].memberPgcs).toEqual([104, 105]);
  });
  test("rejects groups with missing positions rather than drawing partial outlines", () => {
    const broken = [member(100, null), member(101, 100), member(102, 101)];
    broken[2].ra = null;
    expect(groupSubgroups(broken, 100)).toEqual([]);
  });
  test("skips cycles or disconnected hierarchies rather than inventing a group footprint", () => {
    const a = member(101, 102),
      b = member(102, 101);
    expect(groupSubgroups([member(100, null), a, b], 100)).toEqual([]);
    expect(
      groupSubgroups(
        [member(100, null), member(101, null), member(102, 101)],
        100,
      ),
    ).toEqual([]);
  });
  test("outline encloses the given projected objects but refuses missing/invisible projections", () => {
    const points = [
      { ra: 1, dec: 1 },
      { ra: 3, dec: 4 },
    ];
    const found = subgroupScreenFootprint(
      points,
      (ra, dec) => [ra * 100, dec * 100],
      800,
      800,
    );
    expect(found).not.toBeNull();
    expect(found!.cx).toBe(200);
    expect(found!.cy).toBe(250);
    expect(found!.rx).toBeGreaterThan(100);
    expect(subgroupScreenFootprint(points, () => null, 800, 800)).toBeNull();
    expect(
      subgroupScreenFootprint(points, () => [9000, 0], 800, 800),
    ).toBeNull();
  });
  test("colours and two-line popover never transfer Theta1 to non-MD parents", () => {
    const source = [member(100, null), member(101, 100), member(102, 101)];
    source[2].md_pgc_computed = 100;
    const edges = groupTidalEdges(source);
    expect(edges).toHaveLength(2);
    expect(edges[0].tone).toBe("positive");
    expect(edges[1].theta1).toBeNull();
    expect(edges[1].tone).toBe("unknown");
    expect(tidalEdgeTooltip(edges[1])).toEqual(["G102 — G101", "Θ = —"]);
  });
  test("real GroupSkyMap uses four Aladin overlays and keeps preview capture path", () => {
    const src = readFileSync(
      new URL("../src/components/GroupSkyMap.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain("groupTidalEdges(members)");
    expect(src).toContain("TIDAL_TONES[tone]");
    expect(src).toContain("<GroupTidalUI");
    expect(src).toContain("onSnapshot");
  });
});
