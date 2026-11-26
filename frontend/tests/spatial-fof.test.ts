import { describe, expect, test } from "bun:test";
import {
  decodeFof,
  DEFAULT_FOF,
  friendsOfFriends,
} from "../src/lib/spatialFof.ts";
import type { EnvironmentPoint } from "../src/lib/spatialEnvironment.ts";

function point(pgc: number, x: number, y = 0, z = 0): EnvironmentPoint {
  return { pgc, position: [x, y, z], verified: true };
}

describe("Nominal spatial friends of friends", () => {
  test("inclusive linking and transitive membership without binding inference", () => {
    const result = friendsOfFriends(
      [point(5, 7), point(3, 2), point(1, 0), point(2, 1)],
      1,
    );
    expect(result?.components).toEqual([{ id: 1, pgcs: [1, 2, 3] }]);
    expect(result?.isolatedCount).toBe(1);
    expect(result?.pairCount).toBe(2);
    expect(result?.forest.map((edge) => [edge.a, edge.b])).toEqual([
      [1, 2],
      [2, 3],
    ]);
  });
  test("cycles count every accepted pair but draw only a connecting forest", () => {
    const result = friendsOfFriends(
      [point(1, 0), point(2, 0.2), point(3, 0.4), point(4, 5), point(5, 5.2)],
      1,
    );
    expect(result?.pairCount).toBe(4);
    expect(result?.forest.length).toBe(3);
    expect(result?.components.map((component) => component.pgcs)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
    expect(result?.nodes.length).toBe(5);
    expect(result?.links.length).toBe(3);
  });
  test("duplicate identities and invalid coordinates are excluded, empty is valid", () => {
    const result = friendsOfFriends(
      [point(1, 0), point(1, 0.1), point(2, NaN), point(3, 1), point(4, 5)],
      1,
    );
    expect(result?.eligibleCount).toBe(2);
    expect(result?.isolatedCount).toBe(2);
    expect(result?.components).toEqual([]);
    expect(friendsOfFriends([], 1)?.eligibleCount).toBe(0);
    expect(friendsOfFriends([], 0)).toBeNull();
  });
  test("rotations and input order preserve component membership and pair counts", () => {
    const points = [
      point(4, 5),
      point(1, 0, 0.1),
      point(3, 0.8, 0.2),
      point(2, 0.4, 0.2),
    ];
    const rotated = points
      .map((p) => point(p.pgc, -p.position[1], p.position[0], p.position[2]))
      .reverse();
    const a = friendsOfFriends(points, 0.5),
      b = friendsOfFriends(rotated, 0.5);
    expect(a?.components).toEqual(b?.components);
    expect(a?.pairCount).toBe(b?.pairCount);
    expect(a?.forest.map((edge) => [edge.a, edge.b])).toEqual(
      b?.forest.map((edge) => [edge.a, edge.b]),
    );
    expect(points.map((p) => p.pgc)).toEqual([4, 1, 3, 2]);
  });
  test("shorter linking length splits components, no hidden bridge", () => {
    const points = [point(1, 0), point(2, 0.5), point(3, 1)];
    expect(friendsOfFriends(points, 0.5)?.components.length).toBe(1);
    expect(friendsOfFriends(points, 0.49)?.components.length).toBe(0);
    expect(
      friendsOfFriends(
        points.filter((p) => p.pgc !== 2),
        0.5,
      )?.components.length,
    ).toBe(0);
  });
  test("preferences default off and reject invalid values", () => {
    for (const raw of [
      null,
      {},
      { enabled: true, linkingMpc: 0 },
      { enabled: true, linkingMpc: 11 },
      { enabled: true, linkingMpc: NaN },
    ])
      expect(decodeFof(raw)).toEqual(DEFAULT_FOF);
    expect(decodeFof({ enabled: true, linkingMpc: 0.8 })).toEqual({
      enabled: true,
      linkingMpc: 0.8,
    });
  });
});
