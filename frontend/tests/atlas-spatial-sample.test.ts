import { describe, expect, test } from "bun:test";
import {
  decodeSpatialSample,
  makeSpatialSample,
  spatialSampleIds,
  spatialSampleUrl,
  spatialSampleLabel,
} from "../src/lib/atlasSpatialSample.ts";
const sphere = {
  kind: "sphere",
  frame: "ICRS",
  centreMpc: [1, 2, 3],
  radiusMpc: 2,
} as const;
describe("Frozen spatial sample", () => {
  test("exact PGC membership is sorted without mutating input", () => {
    const pgcs = [42, 3, 17];
    const sample = makeSpatialSample(pgcs, null, sphere, "individual", true);
    expect(sample?.pgcs).toEqual([3, 17, 42]);
    expect(pgcs).toEqual([42, 3, 17]);
    expect(sample?.region).toEqual(sphere);
    expect(spatialSampleLabel(sample!)).toBe("Sphere · ICRS");
  });
  test("empty and missing snapshots are not equivalent to no filter", () => {
    const sample = makeSpatialSample([], null, sphere, "verified", true);
    expect(sample?.pgcs).toEqual([]);
    expect(spatialSampleIds({ token: "x", sample })?.size).toBe(0);
    expect(spatialSampleIds({ token: "x", sample: null })?.size).toBe(0);
    expect(spatialSampleIds({ token: null, sample: null })).toBeNull();
  });
  test("invalid or duplicate identities fail closed", () => {
    expect(
      makeSpatialSample([1, 1], null, sphere, "individual", true),
    ).toBeNull();
    expect(makeSpatialSample([0], null, sphere, "individual", true)).toBeNull();
    expect(
      makeSpatialSample([NaN], null, sphere, "individual", true),
    ).toBeNull();
    expect(decodeSpatialSample({ version: 2 })).toBeNull();
  });
  test("requires exactly one validated region", () => {
    const slice = {
      frame: "ICRS",
      axis: "2",
      centreMpc: 0,
      thicknessMpc: 2,
    } as const;
    expect(
      makeSpatialSample([1], slice, sphere, "individual", true),
    ).toBeNull();
    expect(makeSpatialSample([1], null, null, "individual", true)).toBeNull();
    expect(
      makeSpatialSample([1], slice, null, "individual", true)?.slice,
    ).toEqual(slice);
  });
  test("intersection cannot add galaxies to a frozen sample", () => {
    const sample = makeSpatialSample([2, 3], null, sphere, "individual", true);
    const ids = spatialSampleIds({ token: "x", sample });
    expect([1, 2, 4].filter((pgc) => ids?.has(pgc))).toEqual([2]);
  });
  test("URL preserves scientific filters and other parameters", () => {
    expect(
      spatialSampleUrl("https://localhost/?atlas=abc&spatial=1#sky", "x"),
    ).toBe("/?atlas=abc&spatial=1&spatialSample=x#sky");
    expect(
      spatialSampleUrl(
        "https://localhost/?atlas=abc&spatialSample=x#sky",
        null,
      ),
    ).toBe("/?atlas=abc#sky");
  });
});
