/** Nominal catalogue populations, not independently verified physical classifications. */
export const POPULATION_OPTIONS = [
  {
    id: "dwarf",
    label: "Dwarf (M_B ≥ −17)",
    title:
      "Operational B-band luminosity cut, not a physical dwarf classification",
  },
  {
    id: "root",
    label: "Physical group roots",
    title: "Root PGC in the canonical physical-group catalogue",
  },
  {
    id: "member",
    label: "Physical group members",
    title:
      "Includes roots; membership from the complete physical-group catalogue",
  },
  {
    id: "field",
    label: "Outside physical groups",
    title:
      "Covered catalogue entries outside listed physical groups; not necessarily isolated",
  },
  {
    id: "negativeTheta",
    label: "Θ₁ < 0",
    title: "Negative catalogue tidal index; nominal isolation proxy",
  },
  {
    id: "early",
    label: "T < 0",
    title: "Negative catalogue morphological type",
  },
  {
    id: "transition",
    label: "T = 0",
    title: "Zero catalogue morphological type",
  },
  {
    id: "late",
    label: "T > 0",
    title: "Positive catalogue morphological type",
  },
] as const;
export type PopulationId = (typeof POPULATION_OPTIONS)[number]["id"];
export type PopulationMode = "any" | "all";
export type AtlasPopulation = { ids: PopulationId[]; mode: PopulationMode };
export const DWARF_ABSOLUTE_B_LIMIT = -17;
export const POPULATION_POLICY = "catalogue_population_v1";
export type PopulationObject = {
  pgc: number;
  abs_b_mag?: number | null;
  theta1?: number | null;
  morphology_t?: number | null;
};
type MembershipSnapshot = {
  catalogue_pgcs: readonly number[];
  groups: readonly { root_pgc: number; member_pgcs: readonly number[] }[];
};
export type PopulationMembership = {
  covered: ReadonlySet<number>;
  members: ReadonlySet<number>;
  roots: ReadonlySet<number>;
};
export function populationMembership(
  snapshot: MembershipSnapshot | null,
): PopulationMembership {
  return {
    covered: new Set(snapshot?.catalogue_pgcs ?? []),
    members: new Set(
      snapshot?.groups.flatMap((group) => group.member_pgcs) ?? [],
    ),
    roots: new Set(snapshot?.groups.map((group) => group.root_pgc) ?? []),
  };
}
export function decodePopulation(raw: unknown): AtlasPopulation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if ((r.mode !== "any" && r.mode !== "all") || !Array.isArray(r.ids))
    return null;
  const rawIds: unknown[] = r.ids;
  const ids = POPULATION_OPTIONS.map((option) => option.id).filter((id) =>
    rawIds.includes(id),
  );
  if (ids.length !== r.ids.length) return null;
  return { ids, mode: r.mode };
}
export function defaultPopulation(): AtlasPopulation {
  return { ids: [], mode: "any" };
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function populationFlags(
  object: PopulationObject,
  membership: PopulationMembership,
): Record<PopulationId, boolean> {
  const { pgc, abs_b_mag: absBMag, theta1, morphology_t: morphologyT } = object;
  const covered = membership.covered.has(pgc);
  return {
    dwarf: finite(absBMag) && absBMag >= DWARF_ABSOLUTE_B_LIMIT,
    root: covered && membership.roots.has(pgc),
    member: covered && membership.members.has(pgc),
    field: covered && !membership.members.has(pgc),
    negativeTheta: finite(theta1) && theta1 < 0,
    early: finite(morphologyT) && morphologyT < 0,
    transition: finite(morphologyT) && morphologyT === 0,
    late: finite(morphologyT) && morphologyT > 0,
  };
}
export function matchesPopulation(
  object: PopulationObject,
  membership: PopulationMembership,
  selection: AtlasPopulation,
): boolean {
  if (!selection.ids.length) return true;
  const flags = populationFlags(object, membership);
  return selection.mode === "all"
    ? selection.ids.every((id) => flags[id])
    : selection.ids.some((id) => flags[id]);
}
export function populationPoints<T extends { object: PopulationObject }>(
  points: readonly T[],
  membership: PopulationMembership,
  selection: AtlasPopulation,
): readonly T[] {
  return selection.ids.length
    ? points.filter((point) =>
        matchesPopulation(point.object, membership, selection),
      )
    : points;
}
export function populationCounts(
  points: readonly { object: PopulationObject }[],
  membership: PopulationMembership,
): Record<PopulationId, number> {
  const counts: Record<PopulationId, number> = {
    dwarf: 0,
    root: 0,
    member: 0,
    field: 0,
    negativeTheta: 0,
    early: 0,
    transition: 0,
    late: 0,
  };
  for (const point of points) {
    const flags = populationFlags(point.object, membership);
    for (const option of POPULATION_OPTIONS)
      if (flags[option.id]) counts[option.id] += 1;
  }
  return counts;
}
