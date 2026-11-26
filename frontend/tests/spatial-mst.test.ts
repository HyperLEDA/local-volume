import { describe, expect, test } from "bun:test";
import { minimumSpanningTree, mstForest } from "../src/lib/spatialMst.ts";
import {
  friendsOfFriends,
  decodeFof,
  DEFAULT_FOF,
} from "../src/lib/spatialFof.ts";
import type { EnvironmentPoint } from "../src/lib/spatialEnvironment.ts";

function point(pgc: number, x: number, y = 0, z = 0): EnvironmentPoint {
  return { pgc, position: [x, y, z], verified: true };
}
describe("Euclidean minimum spanning tree", () => {
  test("known triangle and full tree length", () => {
    const tree = minimumSpanningTree([
      point(3, 0, 4),
      point(1, 0),
      point(2, 3),
    ]);
    expect(tree?.edges).toEqual([
      { a: 1, b: 2, separationMpc: 3 },
      { a: 1, b: 3, separationMpc: 4 },
    ]);
    expect(tree?.totalLengthMpc).toBe(7);
    expect(tree?.longestEdgeMpc).toBe(4);
    if (!tree) throw new Error("Missing tree");
    expect(mstForest(tree, null)?.components).toEqual([
      { id: 1, pgcs: [1, 2, 3] },
    ]);
  });
  test("inclusive cut agrees with FoF and retains the original tree", () => {
    const points = [point(1, 0), point(2, 0.5), point(3, 1), point(4, 4)];
    const tree = minimumSpanningTree(points);
    if (!tree) throw new Error("Missing tree");
    for (const threshold of [0.49, 0.5, 1, 3]) {
      const cut = mstForest(tree, threshold),
        fof = friendsOfFriends(points, threshold);
      expect(cut?.components).toEqual(fof?.components);
      expect(cut?.isolatedCount).toBe(fof?.isolatedCount);
    }
    expect(tree.edges.length).toBe(3);
    expect(mstForest(tree, 0)).toBeNull();
  });
  test("duplicates excluded, empty and singleton distinct from failure", () => {
    const tree = minimumSpanningTree([
      point(1, 0),
      point(1, 2),
      point(2, NaN),
      point(3, 1),
    ]);
    expect(tree?.points.map((p) => p.pgc)).toEqual([3]);
    expect(tree?.edges).toEqual([]);
    expect(tree?.longestEdgeMpc).toBeNull();
    expect(minimumSpanningTree([])?.totalLengthMpc).toBe(0);
  });
  test("coincident galaxies are distinct and zero length is valid", () => {
    const tree = minimumSpanningTree([point(1, 0), point(2, 0), point(3, 1)]);
    expect(tree?.edges.map((edge) => edge.separationMpc)).toEqual([0, 1]);
  });
  test("ties are deterministic under input permutation; rotation retains length", () => {
    const points = [point(1, 0), point(2, 1), point(3, 0, 1), point(4, 1, 1)];
    const a = minimumSpanningTree(points);
    const b = minimumSpanningTree([...points].reverse());
    const c = minimumSpanningTree(
      points.map((p) =>
        point(p.pgc, -p.position[1], p.position[0], p.position[2]),
      ),
    );
    expect(a?.edges).toEqual(b?.edges);
    expect(a?.totalLengthMpc).toBe(c?.totalLengthMpc);
    expect(a?.totalLengthMpc).toBe(3);
  });
  test("session legacy FoF unchanged; MST settings explicit", () => {
    expect(decodeFof({ enabled: true, linkingMpc: 1 })).toEqual({
      enabled: true,
      linkingMpc: 1,
    });
    expect(
      decodeFof({ enabled: true, linkingMpc: 1, method: "mst-cut" }),
    ).toEqual({ enabled: true, linkingMpc: 1, method: "mst-cut" });
    expect(
      decodeFof({ enabled: true, linkingMpc: 1, method: "invalid" }),
    ).toEqual(DEFAULT_FOF);
  });
});
