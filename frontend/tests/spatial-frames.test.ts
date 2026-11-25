import { describe, expect, test } from "bun:test";
import { icrsToGalactic, icrsToSupergalactic } from "../src/lib/coordinates.ts";
import { supergalacticOffset } from "../src/lib/groupSceneSupergalactic.ts";
import {
  galacticVectorToSupergalactic,
  observerAxisLabels,
  observerCartesianMpc,
  rotateFrameToIcrs,
  rotateIcrsVector,
  type ObserverFrame,
} from "../src/lib/spatialFrames.ts";
import { groupCenteredKpc, type Vec3 } from "../src/lib/groupGeometry3d.ts";

const frames: ObserverFrame[] = ["ICRS", "GALACTIC", "SUPERGALACTIC"];

function expectVector(actual: Vec3, expected: Vec3, digits = 10): void {
  for (const index of [0, 1, 2] as const) {
    expect(actual[index]).toBeCloseTo(expected[index], digits);
  }
}

function delta(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function direction(lon: number, lat: number): Vec3 {
  const a = (lon * Math.PI) / 180;
  const d = (lat * Math.PI) / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

describe("Shared observer-centred spatial frames", () => {
  test("conventional Galactic and supergalactic axes", () => {
    expectVector(
      rotateIcrsVector([1, 0, 0], "GALACTIC"),
      [-0.0548755604162154, 0.4941094278755837, -0.8676661490190047],
    );
    expectVector(
      rotateIcrsVector([1, 0, 0], "SUPERGALACTIC"),
      [0.375015477807805, -0.89832045561652, 0.228874966795218],
    );
    expectVector(
      galacticVectorToSupergalactic(direction(137.37, 0)),
      [1, 0, 0],
    );
    expectVector(
      galacticVectorToSupergalactic(direction(47.37, 6.32)),
      [0, 0, 1],
    );
  });
  test("round trips, norms and pairwise separations survive frame changes", () => {
    for (const frame of frames) {
      for (const ra of [0, 1, 73, 180, 359.99]) {
        for (const dec of [-90, -40, 0, 35, 90]) {
          const a = observerCartesianMpc({ ra, dec }, 7.5, "ICRS")!;
          const b = observerCartesianMpc({ ra: 142, dec: -12 }, 3.4, "ICRS")!;
          const p = rotateIcrsVector(a, frame);
          const q = rotateIcrsVector(b, frame);
          expectVector(rotateFrameToIcrs(p, frame), a);
          expect(Math.hypot(...p)).toBeCloseTo(7.5, 10);
          expect(Math.hypot(...delta(p, q))).toBeCloseTo(
            Math.hypot(...delta(a, b)),
            10,
          );
        }
      }
      expectVector(rotateIcrsVector([0, 0, 0], frame), [0, 0, 0]);
    }
  });
  test("global Mpc and relative group kpc share exactly one orientation", () => {
    for (const ra of [0, 57, 359.9]) {
      for (const dec of [-90, -32, 0, 90]) {
        const centre = {
          ra,
          dec,
          distanceMpc: 4,
          distanceOrigin: "DIRECT_MEASURED",
        } as const;
        const member = {
          ra: 33,
          dec: 17,
          distanceMpc: 5.1,
          distanceOrigin: "DIRECT_MEASURED",
        } as const;
        const local = groupCenteredKpc(centre, member)!;
        const offset = supergalacticOffset(local, ra, dec);
        const a = observerCartesianMpc(
          centre,
          centre.distanceMpc,
          "SUPERGALACTIC",
        )!;
        const b = observerCartesianMpc(
          member,
          member.distanceMpc,
          "SUPERGALACTIC",
        )!;
        const [x, y, z] = delta(b, a);
        expectVector(offset, [1000 * x, 1000 * y, 1000 * z], 8);
      }
    }
  });
  test("angular cards and Cartesian positions agree, including poles", () => {
    for (const ra of [0, 120, 359.9]) {
      for (const dec of [-90, -20, 0, 90]) {
        const gal = icrsToGalactic(ra, dec)!;
        const sg = icrsToSupergalactic(ra, dec)!;
        expectVector(
          observerCartesianMpc({ ra, dec }, 1, "GALACTIC")!,
          direction(gal.longitude, gal.latitude),
        );
        expectVector(
          observerCartesianMpc({ ra, dec }, 1, "SUPERGALACTIC")!,
          direction(sg.longitude, sg.latitude),
        );
      }
    }
  });
  test("invalid and missing distances or directions do not create positions", () => {
    for (const frame of frames) {
      for (const d of [null, 0, -1, Infinity, NaN]) {
        expect(observerCartesianMpc({ ra: 0, dec: 0 }, d, frame)).toBeNull();
      }
      for (const sky of [
        { ra: null, dec: 0 },
        { ra: 0, dec: 91 },
        { ra: NaN, dec: 0 },
      ]) {
        expect(observerCartesianMpc(sky, 1, frame)).toBeNull();
      }
    }
    expect(observerAxisLabels("SUPERGALACTIC")).toEqual(["SGX", "SGY", "SGZ"]);
  });
});
