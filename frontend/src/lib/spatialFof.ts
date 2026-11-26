import {
  uniqueEnvironmentPoints,
  type EnvironmentPoint,
} from "./spatialEnvironment.ts";

export type ConnectivityMethod = "fof" | "mst" | "mst-cut";
export type FofConfig = {
  enabled: boolean;
  linkingMpc: number;
  method?: Exclude<ConnectivityMethod, "fof">;
};
export const DEFAULT_FOF: FofConfig = { enabled: false, linkingMpc: 0.5 };
export function validLinkingLength(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.01 &&
    value <= 10
  );
}
export function decodeFof(raw: unknown): FofConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_FOF;
  const r = raw as Record<string, unknown>;
  if (typeof r.enabled !== "boolean" || !validLinkingLength(r.linkingMpc))
    return DEFAULT_FOF;
  if (r.method === "mst" || r.method === "mst-cut")
    return { enabled: r.enabled, linkingMpc: r.linkingMpc, method: r.method };
  if (r.method !== undefined && r.method !== "fof") return DEFAULT_FOF;
  return { enabled: r.enabled, linkingMpc: r.linkingMpc };
}
export type FofComponent = { id: number; pgcs: number[] };
export type FofEdge = { a: number; b: number; separationMpc: number };
export type FofNode = { point: EnvironmentPoint; color: string };
export type FofLink = {
  a: EnvironmentPoint;
  b: EnvironmentPoint;
  color: string;
};
export type FofResult = {
  eligibleCount: number;
  isolatedCount: number;
  pairCount: number;
  components: FofComponent[];
  forest: FofEdge[];
  nodes: FofNode[];
  links: FofLink[];
};
const COLORS = [
  "#5ec9c4",
  "#e7a65c",
  "#b19ae1",
  "#82b879",
  "#e38a9c",
  "#78a6ea",
  "#d8ce74",
  "#bd997f",
] as const;

export function connectivityVisuals(
  eligible: readonly EnvironmentPoint[],
  components: FofComponent[],
  forest: FofEdge[],
): Omit<FofResult, "pairCount"> {
  const shades = new Map<number, string>();
  components.forEach((component, i) => {
    for (const pgc of component.pgcs)
      shades.set(pgc, COLORS[i % COLORS.length]);
  });
  const byPgc = new Map(eligible.map((point) => [point.pgc, point]));
  const nodes = eligible.flatMap((point) => {
    const color = shades.get(point.pgc);
    return color ? [{ point, color }] : [];
  });
  const links = forest.flatMap((edge) => {
    const a = byPgc.get(edge.a),
      b = byPgc.get(edge.b),
      color = shades.get(edge.a);
    return a && b && color ? [{ a, b, color }] : [];
  });
  return {
    eligibleCount: eligible.length,
    isolatedCount: eligible.length - nodes.length,
    components,
    forest,
    nodes,
    links,
  };
}

/** Nominal 3D FoF on the explicit sample; no binding inference or catalogue writes. */
export function friendsOfFriends(
  points: readonly EnvironmentPoint[],
  linkingMpc: number,
): FofResult | null {
  if (!validLinkingLength(linkingMpc)) return null;
  const eligible = uniqueEnvironmentPoints(points).sort(
    (a, b) => a.pgc - b.pgc,
  );
  const parent = eligible.map((_, i) => i);
  const ranks = eligible.map(() => 0);
  function root(index: number): number {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  }
  const forest: FofEdge[] = [];
  let pairCount = 0;
  for (let i = 0; i < eligible.length; i++) {
    const a = eligible[i];
    for (let j = i + 1; j < eligible.length; j++) {
      const b = eligible[j];
      const separationMpc = Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2],
      );
      if (separationMpc > linkingMpc) continue;
      pairCount += 1;
      let left = root(i),
        right = root(j);
      if (left === right) continue;
      if (ranks[left] < ranks[right]) [left, right] = [right, left];
      parent[right] = left;
      if (ranks[left] === ranks[right]) ranks[left] += 1;
      forest.push({ a: a.pgc, b: b.pgc, separationMpc });
    }
  }
  const memberships = new Map<number, number[]>();
  eligible.forEach((point, i) => {
    const key = root(i);
    const members = memberships.get(key);
    if (members) members.push(point.pgc);
    else memberships.set(key, [point.pgc]);
  });
  const components = [...memberships.values()]
    .filter((pgcs) => pgcs.length > 1)
    .map((pgcs) => ({ id: pgcs[0], pgcs }))
    .sort((a, b) => b.pgcs.length - a.pgcs.length || a.id - b.id);
  return { ...connectivityVisuals(eligible, components, forest), pairCount };
}
