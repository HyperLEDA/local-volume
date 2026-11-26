import {
  uniqueEnvironmentPoints,
  type EnvironmentPoint,
} from "./spatialEnvironment.ts";
import {
  connectivityVisuals,
  validLinkingLength,
  type FofEdge,
  type FofResult,
} from "./spatialFof.ts";

export type SpatialMst = {
  points: readonly EnvironmentPoint[];
  edges: readonly FofEdge[];
  totalLengthMpc: number;
  longestEdgeMpc: number | null;
};
export type MstResult = Omit<FofResult, "pairCount"> & {
  treeEdgeCount: number;
  treeLengthMpc: number;
  longestEdgeMpc: number | null;
  retainedLengthMpc: number;
};

/** Dense Prim on the complete Euclidean graph: O(N²) time, O(N) storage. */
export function minimumSpanningTree(
  input: readonly EnvironmentPoint[],
): SpatialMst | null {
  const points = uniqueEnvironmentPoints(input).sort((a, b) => a.pgc - b.pgc);
  const n = points.length;
  const visited = new Uint8Array(n);
  const best = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const edges: FofEdge[] = [];
  let totalLengthMpc = 0;
  let longestEdgeMpc: number | null = null;
  best[0] = 0;
  for (let step = 0; step < n; step++) {
    let next = -1;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && (next === -1 || best[i] < best[next])) next = i;
    }
    if (next === -1 || !Number.isFinite(best[next])) return null;
    const p = parent[next];
    if (p >= 0) {
      const separationMpc = best[next];
      const first = points[p].pgc,
        second = points[next].pgc;
      edges.push({
        a: Math.min(first, second),
        b: Math.max(first, second),
        separationMpc,
      });
      totalLengthMpc += separationMpc;
      longestEdgeMpc = Math.max(longestEdgeMpc ?? 0, separationMpc);
    }
    visited[next] = 1;
    const a = points[next].position;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const b = points[i].position;
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (!Number.isFinite(distance)) return null;
      if (distance < best[i] || (distance === best[i] && next < parent[i])) {
        best[i] = distance;
        parent[i] = next;
      }
    }
  }
  if (!Number.isFinite(totalLengthMpc)) return null;
  return { points, edges, totalLengthMpc, longestEdgeMpc };
}

/** Cut inclusive edge threshold; no recomputation of the original MST. */
export function mstForest(
  tree: SpatialMst,
  cutoffMpc: number | null,
): MstResult | null {
  if (cutoffMpc !== null && !validLinkingLength(cutoffMpc)) return null;
  const forest = tree.edges.filter(
    (edge) => cutoffMpc === null || edge.separationMpc <= cutoffMpc,
  );
  const adjacency = new Map(
    tree.points.map((point) => [point.pgc, [] as number[]]),
  );
  for (const edge of forest) {
    adjacency.get(edge.a)?.push(edge.b);
    adjacency.get(edge.b)?.push(edge.a);
  }
  const visited = new Set<number>();
  const components: FofResult["components"] = [];
  for (const point of tree.points) {
    if (visited.has(point.pgc)) continue;
    const pgcs = [point.pgc];
    visited.add(point.pgc);
    for (let i = 0; i < pgcs.length; i++) {
      for (const neighbour of adjacency.get(pgcs[i]) ?? []) {
        if (visited.has(neighbour)) continue;
        visited.add(neighbour);
        pgcs.push(neighbour);
      }
    }
    pgcs.sort((a, b) => a - b);
    if (pgcs.length > 1) components.push({ id: pgcs[0], pgcs });
  }
  components.sort((a, b) => b.pgcs.length - a.pgcs.length || a.id - b.id);
  return {
    ...connectivityVisuals(tree.points, components, forest),
    treeEdgeCount: tree.edges.length,
    treeLengthMpc: tree.totalLengthMpc,
    longestEdgeMpc: tree.longestEdgeMpc,
    retainedLengthMpc: forest.reduce(
      (sum, edge) => sum + edge.separationMpc,
      0,
    ),
  };
}
