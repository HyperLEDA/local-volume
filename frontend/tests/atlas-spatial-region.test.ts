import { describe, expect, test } from "bun:test";
import {
  decodeAtlasRegion,
  parseAtlasRegion,
  regionPoints,
  regionGuideSegments,
} from "../src/lib/atlasSpatialRegion.ts";
import { rotateIcrsVector } from "../src/lib/spatialFrames.ts";
import { decodeAtlasPreferences } from "../src/lib/atlasSession.ts";
const sphere = {
  kind: "sphere",
  frame: "ICRS",
  centreMpc: [1, 2, 3],
  radiusMpc: 2,
} as const;
const box = {
  kind: "box",
  frame: "ICRS",
  centreMpc: [1, 2, 3],
  sizeMpc: [4, 2, 6],
} as const;
const points = [
  { pgc: 1, kind: "individual", position: [1, 2, 3] as const },
  { pgc: 2, kind: "individual", position: [3, 2, 3] as const },
  { pgc: 3, kind: "individual", position: [3, 3, 6] as const },
  { pgc: 4, kind: "assigned", position: [1, 2, 3] as const },
  { pgc: 5, kind: "model", position: [1, 2, 3] as const },
  { pgc: 6, kind: "individual", position: [3.01, 2, 3] as const },
  { pgc: 7, kind: "individual", position: [NaN, 2, 3] as const },
];
describe("nominal spatial regions", () => {
  test("sphere uses actual displaced centre, inclusive radius and individual positions", () => {
    expect(regionPoints(points, "ICRS", sphere).map((p) => p.pgc)).toEqual([
      1, 2,
    ]);
  });
  test("box uses full axis lengths and inclusive corners", () => {
    expect(regionPoints(points, "ICRS", box).map((p) => p.pgc)).toEqual([
      1, 2, 3,
    ]);
    expect(regionPoints(points, "ICRS", null)).toBe(points);
  });
  test("both shapes preserve exact identities across frames", () => {
    const rotated = points.map((p) => ({
      ...p,
      position: rotateIcrsVector(p.position, "SUPERGALACTIC"),
    }));
    for (const region of [sphere, box])
      expect(
        regionPoints(rotated, "SUPERGALACTIC", region).map((p) => p.pgc),
      ).toEqual(regionPoints(points, "ICRS", region).map((p) => p.pgc));
  });
  test("invalid values fail closed", () => {
    expect(
      parseAtlasRegion("sphere", "ICRS", ["", "2", "3"], "2", []),
    ).toBeNull();
    expect(decodeAtlasRegion({ ...sphere, radiusMpc: 0 })).toBeNull();
    expect(decodeAtlasRegion({ ...box, sizeMpc: [1, -1, 1] })).toBeNull();
    expect(
      decodeAtlasRegion({ ...box, centreMpc: [1, 2, Infinity] }),
    ).toBeNull();
  });
  test("guides follow true boundaries", () => {
    const vertices = regionGuideSegments(sphere, "ICRS");
    expect(vertices.length).toBe(1152);
    for (let i = 0; i < vertices.length; i += 3)
      expect(
        Math.hypot(vertices[i] - 1, vertices[i + 1] - 2, vertices[i + 2] - 3),
      ).toBeCloseTo(2, 10);
    const edges = regionGuideSegments(box, "ICRS");
    expect(edges.length).toBe(72);
    for (let i = 0; i < edges.length; i += 3)
      expect([
        Math.abs(edges[i] - 1),
        Math.abs(edges[i + 1] - 2),
        Math.abs(edges[i + 2] - 3),
      ]).toEqual([2, 1, 3]);
  });
  test("session restores only a single applied region and reset clears it", () => {
    const state = decodeAtlasPreferences(
      {
        displayMode: "galaxies",
        region: sphere,
        slice: { frame: "ICRS", axis: "2", centreMpc: 0, thicknessMpc: 2 },
      },
      new Set<number>(),
      "dark",
    );
    expect(state.region).toEqual(sphere);
    expect(state.slice).toBeNull();
    expect(
      decodeAtlasPreferences(
        { ...state, displayMode: "groups" },
        new Set<number>(),
        "dark",
      ).region,
    ).toBeNull();
    expect(
      decodeAtlasPreferences(null, new Set<number>(), "dark").region,
    ).toBeNull();
  });
});
