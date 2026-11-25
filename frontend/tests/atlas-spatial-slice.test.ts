import { describe, expect, test } from "bun:test";
import {
  decodeAtlasSlice,
  parseAtlasSlice,
  sliceBounds,
  slicePoints,
  sliceGuideSegments,
} from "../src/lib/atlasSpatialSlice.ts";
import { rotateIcrsVector } from "../src/lib/spatialFrames.ts";
import { decodeAtlasPreferences } from "../src/lib/atlasSession.ts";
const slab = {
  frame: "ICRS",
  axis: "2",
  centreMpc: 1,
  thicknessMpc: 2,
} as const;
const rows = [
  { pgc: 1, position: [2, 3, 0] as const, kind: "individual" },
  { pgc: 2, position: [2, 3, 2] as const, kind: "individual" },
  { pgc: 3, position: [2, 3, 2.001] as const, kind: "individual" },
  { pgc: 4, position: [2, 3, 1] as const, kind: "assigned" },
  { pgc: 5, position: [2, 3, 1] as const, kind: "model" },
  { pgc: 6, position: [2, 3, NaN] as const, kind: "individual" },
];
describe("nominal spatial slice", () => {
  test("full thickness, signed centre and closed boundaries", () => {
    expect(sliceBounds(slab)).toEqual([0, 2]);
    expect(slicePoints(rows, "ICRS", slab).map((row) => row.pgc)).toEqual([
      1, 2,
    ]);
    expect(sliceBounds({ ...slab, centreMpc: -2 })).toEqual([-3, -1]);
  });
  test("invalid and empty inputs do not become zero", () => {
    expect(parseAtlasSlice("ICRS", "2", "", "2")).toBeNull();
    expect(parseAtlasSlice("ICRS", "2", "0", "0")).toBeNull();
    expect(decodeAtlasSlice({ ...slab, thicknessMpc: Infinity })).toBeNull();
    expect(decodeAtlasSlice({ ...slab, axis: "3" })).toBeNull();
  });
  test("frame changes preserve membership and order", () => {
    const rotated = rows.map((row) => ({
      ...row,
      position: rotateIcrsVector(row.position, "SUPERGALACTIC"),
    }));
    expect(
      slicePoints(rotated, "SUPERGALACTIC", slab).map((row) => row.pgc),
    ).toEqual([1, 2]);
    expect(slicePoints(rows, "ICRS", null)).toBe(rows);
  });
  test("guide endpoints lie on true boundary and reference radius", () => {
    const vertices = sliceGuideSegments(slab, "ICRS", 5);
    expect(vertices.length).toBe(768);
    for (let i = 0; i < vertices.length; i += 3) {
      expect(
        Math.hypot(vertices[i], vertices[i + 1], vertices[i + 2]),
      ).toBeCloseTo(5, 10);
      expect(vertices[i + 2] === 0 || vertices[i + 2] === 2).toBe(true);
    }
    expect(sliceGuideSegments({ ...slab, centreMpc: 10 }, "ICRS", 5)).toEqual(
      [],
    );
  });
  test("session restores slice only in galaxy mode and reset clears it", () => {
    const allowed = new Set<number>();
    expect(
      decodeAtlasPreferences(
        { displayMode: "galaxies", slice: slab },
        allowed,
        "dark",
      ).slice,
    ).toEqual(slab);
    expect(
      decodeAtlasPreferences(
        { displayMode: "groups", slice: slab },
        allowed,
        "dark",
      ).slice,
    ).toBeNull();
    expect(decodeAtlasPreferences(null, allowed, "dark").slice).toBeNull();
  });
});
