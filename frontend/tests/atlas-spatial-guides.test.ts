import { describe, expect, test } from "bun:test";
import {
  ATLAS_SHELL_RADII,
  atlasShellSegments,
  atlasSupergalacticNormal,
  DEFAULT_ATLAS_GUIDES,
  toggleAtlasShell,
} from "../src/lib/atlasSpatialGuides.ts";
import {
  rotateFrameToIcrs,
  rotateIcrsVector,
} from "../src/lib/spatialFrames.ts";

describe("atlas reference guides", () => {
  test("absolute supergalactic plane has the expected pole", () => {
    expect(atlasSupergalacticNormal("SUPERGALACTIC")).toEqual([0, 0, 1]);
    const normal = atlasSupergalacticNormal("GALACTIC");
    const lon = (47.37 * Math.PI) / 180;
    const lat = (6.32 * Math.PI) / 180;
    expect(normal[0]).toBeCloseTo(Math.cos(lon) * Math.cos(lat), 10);
    expect(normal[1]).toBeCloseTo(Math.sin(lon) * Math.cos(lat), 10);
    expect(normal[2]).toBeCloseTo(Math.sin(lat), 10);
  });
  test("ICRS pole rotates back to SGZ, and SG plane vectors remain perpendicular", () => {
    for (const frame of ["ICRS", "GALACTIC", "SUPERGALACTIC"] as const) {
      const normal = atlasSupergalacticNormal(frame);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 10);
      const plane = rotateIcrsVector(
        rotateFrameToIcrs([3, 4, 0], "SUPERGALACTIC"),
        frame,
      );
      expect(
        normal[0] * plane[0] + normal[1] * plane[1] + normal[2] * plane[2],
      ).toBeCloseTo(0, 10);
      const roundTrip = rotateIcrsVector(
        rotateFrameToIcrs(normal, frame),
        "SUPERGALACTIC",
      );
      expect(roundTrip[2]).toBeCloseTo(1, 10);
    }
  });
  test("all shell vertices lie on the specified observer-centred sphere", () => {
    for (const radius of ATLAS_SHELL_RADII) {
      const segments = atlasShellSegments(radius);
      expect(segments.length).toBe(3 * 96 * 6);
      for (let i = 0; i < segments.length; i += 3) {
        const vertex = segments.slice(i, i + 3);
        expect(Math.hypot(...vertex)).toBeCloseTo(radius, 10);
        expect(vertex.includes(0)).toBe(true);
      }
    }
  });
  test("each shell circle is closed without cross-circle connectors", () => {
    const segments = atlasShellSegments(5);
    for (let circle = 0; circle < 3; circle++) {
      const start = circle * 96 * 6;
      expect(segments.slice(start, start + 3)).toEqual(
        segments.slice(start + 96 * 6 - 3, start + 96 * 6),
      );
    }
  });
  test("shell toggles are independent, ordered and idempotent", () => {
    const one = toggleAtlasShell(DEFAULT_ATLAS_GUIDES, 11, true);
    const two = toggleAtlasShell({ ...one, plane: true }, 2, true);
    expect(two).toEqual({ plane: true, shells: [2, 11] });
    expect(toggleAtlasShell(two, 11, true)).toEqual(two);
    expect(toggleAtlasShell(two, 11, false)).toEqual({
      plane: true,
      shells: [2],
    });
    expect(DEFAULT_ATLAS_GUIDES).toEqual({ plane: false, shells: [] });
  });
});
