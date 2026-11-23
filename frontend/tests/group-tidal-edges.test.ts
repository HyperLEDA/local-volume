import { describe, expect, test } from "bun:test";
import {
  groupTidalEdges,
  tidalEdgeTooltip,
  TIDAL_TONES,
  type TidalMember,
} from "../src/lib/groupTidalEdges.ts";

const root: TidalMember = { pgc: 10, name: "Root", parent_md_pgc: null, md_pgc_computed: null, theta1_computed: null };

describe("#64 individual MD edges, provenance and sign semantics", () => {
  test("uses current Theta1 only for the exact individual-MD pair", () => {
    const members: TidalMember[] = [
      root,
      { pgc: 11, name: "Satellite", parent_md_pgc: 10, md_pgc_computed: 10, theta1_computed: 1.24 },
      { pgc: 12, name: "Nested", parent_md_pgc: 10, md_pgc_computed: 11, theta1_computed: -2 },
    ];
    const edges = groupTidalEdges(members);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ relation: "individual_md", theta1: 1.24, tone: "positive" });
    expect(edges[1]).toMatchObject({ relation: "hierarchy_only", theta1: null, tone: "unknown" });
    expect(tidalEdgeTooltip(edges[0])).toEqual(["Satellite — Root", "Θ = +1.24"]);
    expect(tidalEdgeTooltip(edges[1])).toEqual(["Nested — Root", "Θ = —"]);
  });

  test("zero and negative indices have distinct visual states", () => {
    const edges = groupTidalEdges([
      root,
      { pgc: 11, name: "Zero", parent_md_pgc: 10, md_pgc_computed: 10, theta1_computed: 0 },
      { pgc: 12, name: "Negative", parent_md_pgc: 10, md_pgc_computed: 10, theta1_computed: -0.4 },
    ]);
    expect(edges.map(e => e.tone)).toEqual(["zero", "negative"]);
    expect(TIDAL_TONES.unknown).not.toBe(TIDAL_TONES.zero);
    expect(tidalEdgeTooltip(edges[1])[1]).toBe("Θ = −0.40");
  });

  test("does not draw missing parents or infer edges from sky proximity", () => {
    const edges = groupTidalEdges([
      root,
      { pgc: 11, name: "Orphan", parent_md_pgc: 999, md_pgc_computed: 999, theta1_computed: 1 },
      { pgc: 12, name: "Independent", parent_md_pgc: null, md_pgc_computed: 10, theta1_computed: 3 },
    ]);
    expect(edges).toEqual([]);
  });
});
