import { describe, expect, test } from "bun:test";
import {
  angularSeparationDeg,
  distanceOrigin,
  groupCenteredKpc,
  pairSeparationMpc,
  pairSeparationIntervalMpc,
  type MeasuredPosition,
} from "../src/lib/groupGeometry3d.ts";

function direct(
  ra: number,
  dec: number,
  distanceMpc: number,
): MeasuredPosition {
  return { ra, dec, distanceMpc, distanceOrigin: "DIRECT_MEASURED" };
}

describe("#43 / #46 / #67 observational geometry and distance quality", () => {
  test("angular separation handles RA wrap, poles, and missing coordinates", () => {
    expect(
      angularSeparationDeg({ ra: 359, dec: 0 }, { ra: 1, dec: 0 }),
    ).toBeCloseTo(2, 12);
    expect(
      angularSeparationDeg({ ra: 0, dec: 90 }, { ra: 180, dec: 90 }),
    ).toBeCloseTo(0, 12);
    expect(
      angularSeparationDeg({ ra: 0, dec: 91 }, { ra: 10, dec: 0 }),
    ).toBeNull();
  });

  test("east, north and positive outward LOS are explicitly oriented", () => {
    const origin = direct(0, 0, 1);
    const radial = groupCenteredKpc(origin, direct(0, 0, 1.1));
    expect(radial).not.toBeNull();
    expect(radial![0]).toBeCloseTo(0, 8);
    expect(radial![1]).toBeCloseTo(0, 8);
    expect(radial![2]).toBeCloseTo(100, 8);
    expect(groupCenteredKpc(origin, direct(90, 0, 1))![0]).toBeCloseTo(1000, 8);
    expect(groupCenteredKpc(origin, direct(0, 90, 1))![1]).toBeCloseTo(1000, 8);
  });

  test("independent vector separation matches spherical cosine formula", () => {
    const a = direct(0, 0, 3.1),
      b = direct(43, 0, 4.7);
    const ref = Math.sqrt(
      3.1 ** 2 + 4.7 ** 2 - 2 * 3.1 * 4.7 * Math.cos((43 * Math.PI) / 180),
    );
    expect(pairSeparationMpc(a, b)).toBeCloseTo(ref, 12);
  });

  test("group-assigned and unknown distances never create physical coordinates", () => {
    expect(distanceOrigin(4.2, "TRGB")).toBe("DIRECT_MEASURED");
    expect(distanceOrigin(4.2, "group membership")).toBe("GROUP_ASSIGNED");
    expect(distanceOrigin(4.2, "Hubble flow model")).toBe("MODEL_INFERRED");
    expect(distanceOrigin(4.2, "TRGB / group assigned")).toBe("UNKNOWN");
    expect(distanceOrigin(4.2, null)).toBe("UNKNOWN");
    const assigned = {
      ...direct(3, 2, 4),
      distanceOrigin: "GROUP_ASSIGNED" as const,
    };
    expect(pairSeparationMpc(direct(0, 0, 4), assigned)).toBeNull();
    expect(groupCenteredKpc(direct(0, 0, 4), assigned)).toBeNull();
  });

  test("interval extrema respect asymmetric errors and do not claim Gaussian confidence", () => {
    const a = { ...direct(0, 0, 3), minusMpc: 0.2, plusMpc: 0.3 };
    const b = { ...direct(0, 0, 4), minusMpc: 0.1, plusMpc: 0.4 };
    expect(pairSeparationIntervalMpc(a, b)![0]).toBeCloseTo(0.6, 10);
    expect(pairSeparationIntervalMpc(a, b)![1]).toBeCloseTo(1.6, 10);
    expect(pairSeparationIntervalMpc({ ...a, minusMpc: null }, b)).toBeNull();
  });
});
