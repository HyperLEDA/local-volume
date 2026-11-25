import {
  decodePopulation,
  populationFlags,
  type AtlasPopulation,
  type PopulationMembership,
  type PopulationObject,
  type PopulationId,
} from "./atlasPopulation.ts";

export type PopulationComparison = { a: AtlasPopulation; b: AtlasPopulation };
export type ComparisonClass =
  "aOnly" | "bOnly" | "both" | "neither" | "unknown";
export const COMPARISON_CLASSES = [
  "aOnly",
  "bOnly",
  "both",
  "neither",
  "unknown",
] as const;
export const COMPARISON_LABELS: Record<ComparisonClass, string> = {
  aOnly: "A only",
  bOnly: "B only",
  both: "A ∩ B",
  neither: "Neither",
  unknown: "Unknown",
};
export const COMPARISON_COLORS: Record<ComparisonClass, string> = {
  aOnly: "#3e8ee0",
  bOnly: "#dc8550",
  both: "#a16bcd",
  neither: "#77838f",
  unknown: "#b8bfc6",
};
export function defaultComparison(): PopulationComparison {
  return {
    a: { ids: ["dwarf"], mode: "any" },
    b: { ids: ["negativeTheta"], mode: "any" },
  };
}
export function decodeComparison(raw: unknown): PopulationComparison | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const a = decodePopulation(value.a),
    b = decodePopulation(value.b);
  return a && b ? { a, b } : null;
}
function knownNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}
/** Unknown input is not evidence of non-membership. Evaluate boolean combinations in three-valued logic. */
export function comparisonMatch(
  object: PopulationObject,
  membership: PopulationMembership,
  selection: AtlasPopulation,
): boolean | null {
  if (!selection.ids.length) return null;
  const flags = populationFlags(object, membership);
  const covered = membership.covered.has(object.pgc);
  const morphologyKnown = knownNumber(object.morphology_t);
  const known: Record<PopulationId, boolean> = {
    dwarf: knownNumber(object.abs_b_mag),
    root: covered,
    member: covered,
    field: covered,
    negativeTheta: knownNumber(object.theta1),
    early: morphologyKnown,
    transition: morphologyKnown,
    late: morphologyKnown,
  };
  const results = selection.ids.map((id) => (known[id] ? flags[id] : null));
  if (selection.mode === "all") {
    if (results.includes(false)) return false;
    return results.includes(null) ? null : true;
  }
  if (results.includes(true)) return true;
  return results.includes(null) ? null : false;
}
export function comparisonClass(
  a: boolean | null,
  b: boolean | null,
): ComparisonClass {
  if (a === null || b === null) return "unknown";
  if (a && b) return "both";
  if (a) return "aOnly";
  return b ? "bOnly" : "neither";
}
export function comparePopulations(
  points: readonly { object: PopulationObject }[],
  membership: PopulationMembership,
  comparison: PopulationComparison,
) {
  const counts: Record<ComparisonClass, number> = {
    aOnly: 0,
    bOnly: 0,
    both: 0,
    neither: 0,
    unknown: 0,
  };
  const classes = new Map<number, ComparisonClass>();
  const colors = new Map<number, string>();
  for (const { object } of points) {
    if (classes.has(object.pgc)) continue;
    const kind = comparisonClass(
      comparisonMatch(object, membership, comparison.a),
      comparisonMatch(object, membership, comparison.b),
    );
    classes.set(object.pgc, kind);
    colors.set(object.pgc, COMPARISON_COLORS[kind]);
    counts[kind] += 1;
  }
  return { counts, classes, colors };
}
