/* LV LEDA Milestone 02 — Stage 03b */
import { describe, expect, test } from "bun:test";
import { buildSubgroupRegion } from "../src/lib/groupSubgroupRegion.ts";

const members = [
  { pgc: 10, x: 100, y: 100 },
  { pgc: 11, x: 185, y: 100 },
];
const links = [{ fromPgc: 11, toPgc: 10 }];

describe("#64 subgroup selections: source membership instead of bounding ellipses", () => {
  test("follows two members and their explicit edge, not the space beside the edge", () => {
    const region = buildSubgroupRegion(
      members,
      links,
      [{ pgc: 12, x: 143, y: 128 }],
      600,
      600,
    );
    expect(region).not.toBeNull();
    expect(region!.contains(100, 100)).toBe(true);
    expect(region!.contains(185, 100)).toBe(true);
    expect(region!.contains(143, 100)).toBe(true);
    expect(region!.contains(143, 128)).toBe(false);
    expect(region!.contains(143, 150)).toBe(false);
    expect(region!.outline).toMatch(/^M/);
  });
  test("excludes intervening foreign galaxies even when they lie on the hierarchy segment", () => {
    const region = buildSubgroupRegion(
      members,
      links,
      [{ pgc: 12, x: 143, y: 100 }],
      600,
      600,
    );
    expect(region).not.toBeNull();
    expect(region!.contains(143, 100)).toBe(false);
    expect(region!.contains(100, 100)).toBe(true);
  });
  test("refuses indistinguishable group and foreign marker positions", () => {
    expect(
      buildSubgroupRegion(
        members,
        links,
        [{ pgc: 99, x: 105, y: 103 }],
        600,
        600,
      ),
    ).toBeNull();
  });
  test("never infers a corridor without an explicit parent-child relation", () => {
    const region = buildSubgroupRegion(members, [], [], 600, 600);
    expect(region).not.toBeNull();
    expect(region!.contains(143, 100)).toBe(false);
  });
  test("keeps explicit parent connections through zoom and recomputes projection", () => {
    const region = buildSubgroupRegion(
      [
        { pgc: 10, x: 100, y: 100 },
        { pgc: 11, x: 400, y: 100 },
      ],
      links,
      [],
      600,
      600,
    );
    expect(region).not.toBeNull();
    expect(region!.contains(250, 100)).toBe(true);
    const zoomed = buildSubgroupRegion(
      [
        { pgc: 10, x: 100, y: 100 },
        { pgc: 11, x: 185, y: 100 },
      ],
      links,
      [],
      600,
      600,
    );
    expect(zoomed!.contains(143, 100)).toBe(true);
  });
  test("rejects malformed sizes and duplicated membership identifiers", () => {
    expect(buildSubgroupRegion(members, links, [], 0, 600)).toBeNull();
    expect(
      buildSubgroupRegion([members[0], members[0]], [], [], 600, 600),
    ).toBeNull();
  });
});
