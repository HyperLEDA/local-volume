export type TidalTone = "positive" | "negative" | "zero" | "unknown";
export const TIDAL_TONES: Readonly<Record<TidalTone, string>> = {
  positive: "#69C8B8",
  negative: "#B6A0D9",
  zero: "#D5DCE0",
  unknown: "#A9B9C4",
};

export type TidalMember = {
  pgc: number;
  name: string;
  parent_md_pgc: number | null;
  md_pgc_computed: number | null;
  theta1_computed: number | null;
};

export type TidalEdge = {
  memberPgc: number;
  parentPgc: number;
  memberName: string;
  parentName: string;
  relation: "individual_md" | "hierarchy_only";
  theta1: number | null;
  provenance: "lv.physical:current_pair" | "membership_hierarchy_only";
  tone: TidalTone;
};

export function tidalTone(theta: number | null): TidalTone {
  if (theta === null || !Number.isFinite(theta)) return "unknown";
  if (theta > 0) return "positive";
  if (theta < 0) return "negative";
  return "zero";
}

// The only numeric edge is an exact member -> computed individual MD pair.
// Parent links alone do not transfer a galaxy's Theta1 to an unrelated pair.
export function groupTidalEdges(members: readonly TidalMember[]): TidalEdge[] {
  const byPgc = new Map(members.map((member) => [member.pgc, member]));
  const edges: TidalEdge[] = [];
  for (const member of members) {
    const parentPgc = member.parent_md_pgc;
    if (parentPgc === null || parentPgc === member.pgc) continue;
    const parent = byPgc.get(parentPgc);
    if (!parent) continue;
    const samePair = member.md_pgc_computed === parentPgc;
    const theta1 =
      samePair &&
      typeof member.theta1_computed === "number" &&
      Number.isFinite(member.theta1_computed)
        ? member.theta1_computed
        : null;
    edges.push({
      memberPgc: member.pgc,
      parentPgc,
      memberName: member.name,
      parentName: parent.name,
      relation: samePair ? "individual_md" : "hierarchy_only",
      theta1,
      provenance: samePair
        ? "lv.physical:current_pair"
        : "membership_hierarchy_only",
      tone: tidalTone(theta1),
    });
  }
  return edges;
}

// Exactly two lines in the edge popover; all other provenance is displayed in
// a separate explanation/legend, not presented as an additional measured field.
export function tidalEdgeTooltip(edge: TidalEdge): readonly [string, string] {
  const theta =
    edge.theta1 === null
      ? "—"
      : `${edge.theta1 > 0 ? "+" : ""}${edge.theta1.toFixed(2)}`.replace(
          "-",
          "−",
        );
  return [`${edge.memberName} — ${edge.parentName}`, `Θ = ${theta}`];
}
