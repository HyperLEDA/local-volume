import { describe, expect, test } from "bun:test";
import {
  atlasCameraKey,
  atlasSpatialUrl,
  decodeAtlasCamera,
  decodeAtlasPreferences,
} from "../src/lib/atlasSession.ts";

describe("Atlas session", () => {
  test("missing or malformed preferences use safe defaults", () => {
    const p = decodeAtlasPreferences(
      {
        frame: "BAD",
        localOnly: "false",
        guides: { shells: [11, 11, 99, 2] },
        layers: { groups: false },
      },
      new Set(),
      "light",
    );
    expect(p.frame).toBe("SUPERGALACTIC");
    expect(p.localOnly).toBe(true);
    expect(p.theme).toBe("light");
    expect(p.guides.shells).toEqual([2, 11]);
    expect(p.layers.groups).toBe(false);
  });
  test("retains only valid PGCs in current catalogue selection", () => {
    expect(
      decodeAtlasPreferences({ selectedGalaxy: 42 }, new Set([42]), "dark")
        .selectedGalaxy,
    ).toBe(42);
    expect(
      decodeAtlasPreferences({ selectedGalaxy: 42 }, new Set([43]), "dark")
        .selectedGalaxy,
    ).toBeNull();
    expect(
      decodeAtlasPreferences(
        { selectedGalaxy: 42, selectedGroup: 43 },
        new Set([42, 43]),
        "dark",
      ).selectedGalaxy,
    ).toBeNull();
  });
  test("camera rejects invalid or mismatched projection data", () => {
    const c = {
      position: [0, 0, 5],
      target: [0, 0, 0],
      up: [0, 1, 0],
      zoom: 2,
      halfHeight: 4,
    };
    expect(decodeAtlasCamera(c, "orthographic")).toEqual(c);
    expect(decodeAtlasCamera(c, "perspective")).toBeNull();
    expect(
      decodeAtlasCamera({ ...c, position: [0, 0, 0] }, "orthographic"),
    ).toBeNull();
    expect(
      decodeAtlasCamera({ ...c, halfHeight: NaN }, "orthographic"),
    ).toBeNull();
    expect(
      decodeAtlasCamera({ ...c, halfHeight: null }, "perspective"),
    ).not.toBeNull();
  });
  test("camera identity depends on exact displayed geometry and projection", () => {
    const points = [{ object: { pgc: 42 }, position: [1, 2, 3] as const }];
    const a = atlasCameraKey(
      "ICRS",
      "orthographic",
      "individual",
      true,
      "galaxies",
      points,
      [],
    );
    expect(a).not.toBe(
      atlasCameraKey(
        "ICRS",
        "perspective",
        "individual",
        true,
        "galaxies",
        points,
        [],
      ),
    );
    expect(a).not.toBe(
      atlasCameraKey(
        "ICRS",
        "orthographic",
        "individual",
        true,
        "galaxies",
        [{ ...points[0], position: [1, 2, 4] }],
        [],
      ),
    );
  });
  test("URL preserves Atlas filters and other parameters", () => {
    expect(atlasSpatialUrl("https://localhost/?atlas=abc&x=2#sky", true)).toBe(
      "/?atlas=abc&x=2&spatial=1#sky",
    );
    expect(
      atlasSpatialUrl("https://localhost/?atlas=abc&spatial=1#sky", false),
    ).toBe("/?atlas=abc#sky");
  });
});
