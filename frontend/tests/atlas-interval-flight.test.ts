import { describe, expect, test } from "bun:test";
import type { SpatialDistance } from "../src/api/objects.ts";
import type { AtlasSpatialPoint } from "../src/lib/atlasSpatialScene.ts";
import {
  atlasDistanceInterval,
  atlasDisplayedIntervals,
} from "../src/lib/atlasDistanceIntervals.ts";
import {
  ATLAS_FOCUS_DURATION_MS,
  atlasFlightProgress,
  atlasFlightScale,
} from "../src/lib/atlasCameraFlight.ts";

function point(
  pgc = 1,
  patch: Partial<SpatialDistance> = {},
  verified = false,
): AtlasSpatialPoint {
  return {
    object: {
      pgc,
      name: `PGC ${pgc}`,
      ra: 0,
      dec: 0,
      bt: null,
      v_hel: null,
      type_name: "G",
      names: [],
      dist: 99,
    },
    evidence: {
      pgc,
      dist_mpc: 5,
      distance_origin: "DIRECT_MEASURED",
      distance_lineage_status: "REVIEW_READY",
      distance_value_review_status: "NOT_REVIEWED",
      distance_interval_review_status: "NOT_REVIEWED",
      distance_interval_traceable: true,
      e_distance_minus_mpc: 1,
      e_distance_plus_mpc: 2,
      ...patch,
    },
    position: [3, 4, 0],
    kind: "individual",
    verified,
    reason: "test",
  };
}

describe("Global observer-centred distance intervals", () => {
  test("asymmetric interval follows observer sightline in Mpc", () => {
    const interval = atlasDistanceInterval(point());
    expect(interval?.quality).toBe("catalogue");
    expect(interval?.lower[0]).toBeCloseTo(2.4);
    expect(interval?.lower[1]).toBeCloseTo(3.2);
    expect(interval?.upper[0]).toBeCloseTo(4.2);
    expect(interval?.upper[1]).toBeCloseTo(5.6);
    expect(interval?.minusMpc).toBe(1);
    expect(interval?.plusMpc).toBe(2);
  });
  test("nonindividual, unavailable, conflicting and untraceable evidence fails closed", () => {
    expect(atlasDistanceInterval({ ...point(), kind: "assigned" })).toBeNull();
    expect(atlasDistanceInterval({ ...point(), evidence: null })).toBeNull();
    expect(atlasDistanceInterval(point(1, { pgc: 2 }))).toBeNull();
    expect(
      atlasDistanceInterval(point(1, { distance_interval_traceable: false })),
    ).toBeNull();
    expect(
      atlasDistanceInterval(
        point(1, { distance_interval_review_status: "HOLD" }),
      ),
    ).toBeNull();
    expect(
      atlasDistanceInterval(point(1, { distance_value_review_status: "HOLD" })),
    ).toBeNull();
    expect(
      atlasDistanceInterval(point(1, { distance_origin: "GROUP_ASSIGNED" })),
    ).toBeNull();
  });
  test("invalid bounds and missing uncertainties never acquire an interval", () => {
    expect(
      atlasDistanceInterval(point(1, { e_distance_minus_mpc: null })),
    ).toBeNull();
    expect(
      atlasDistanceInterval(point(1, { e_distance_plus_mpc: Infinity })),
    ).toBeNull();
    expect(
      atlasDistanceInterval(point(1, { e_distance_minus_mpc: 5 })),
    ).toBeNull();
    expect(
      atlasDistanceInterval(point(1, { e_distance_plus_mpc: -1 })),
    ).toBeNull();
    expect(
      atlasDistanceInterval(
        point(1, { e_distance_minus_mpc: 0, e_distance_plus_mpc: 0 }),
      ),
    ).toBeNull();
    expect(
      atlasDistanceInterval({ ...point(), position: [0, 0, 0] }),
    ).toBeNull();
  });
  test("verified interval requires independently eligible value and interval evidence", () => {
    const patch = {
      distance_interval_review_status: "VERIFIED",
      distance_value_review_status: "VERIFIED",
      distance_interval_verified: true,
    } as const;
    expect(atlasDistanceInterval(point(1, patch))).toBeNull();
    expect(
      atlasDistanceInterval(
        point(1, { ...patch, distance_interval_verified: false }, true),
      ),
    ).toBeNull();
    expect(atlasDistanceInterval(point(1, patch, true))?.quality).toBe(
      "verified",
    );
  });
  test("only visible glyph identities receive intervals", () => {
    expect(
      atlasDisplayedIntervals(
        [point(1), point(2), point(3, { distance_interval_traceable: false })],
        new Set([2, 3]),
      ).map((interval) => interval.pgc),
    ).toEqual([2]);
  });
});
describe("Atlas focus flight", () => {
  test("progress is bounded, eased and monotonic", () => {
    expect(atlasFlightProgress(-1)).toBe(0);
    expect(atlasFlightProgress(ATLAS_FOCUS_DURATION_MS / 2)).toBeCloseTo(0.5);
    expect(atlasFlightProgress(ATLAS_FOCUS_DURATION_MS / 4)).toBeLessThan(0.25);
    expect(atlasFlightProgress(ATLAS_FOCUS_DURATION_MS * 0.75)).toBeGreaterThan(
      0.75,
    );
    expect(atlasFlightProgress(ATLAS_FOCUS_DURATION_MS + 1)).toBe(1);
  });
  test("scale changes multiplicatively with exact endpoints", () => {
    expect(atlasFlightScale(16, 1, 0)).toBe(16);
    expect(atlasFlightScale(16, 1, 0.5)).toBeCloseTo(4);
    expect(atlasFlightScale(16, 1, 1)).toBe(1);
    expect(atlasFlightScale(1, 16, 0.5)).toBeCloseTo(4);
  });
});
