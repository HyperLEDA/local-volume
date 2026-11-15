import { describe, expect, test } from "bun:test";
import { displayedKs, meanBMinusKs } from "./estimatedKs.ts";

describe("estimated Ks preview", () => {
  test("preserves independent photometry", () => {
    expect(
      displayedKs({
        ks_mag: 7.3,
        ks_estimated: false,
        b_mag: 10.6,
        morphology_t: 9,
      }),
    ).toEqual({ value: 7.3, estimated: false });
  });

  test("recomputes a catalog estimate from B and T", () => {
    expect(
      displayedKs({
        ks_mag: 8.8,
        ks_estimated: true,
        b_mag: 16,
        morphology_t: 9,
      }),
    ).toEqual({ value: 13.65, estimated: true });
  });

  test("estimates when Ks is absent", () => {
    expect(displayedKs({ ks_mag: null, b_mag: 15, morphology_t: 5 })).toEqual({
      value: 11.65,
      estimated: true,
    });
  });

  test("retains a previously estimated magnitude when B or T is absent", () => {
    expect(
      displayedKs({
        ks_mag: 12.3,
        ks_estimated: true,
        b_mag: null,
        morphology_t: null,
      }),
    ).toEqual({ value: 12.3, estimated: true });
  });

  test("does not fabricate magnitudes when inputs are missing", () => {
    expect(displayedKs({ ks_mag: null, b_mag: null, morphology_t: 9 })).toEqual(
      { value: null, estimated: false },
    );
  });

  test("follows the three color branches at the boundaries", () => {
    expect(meanBMinusKs(2)).toBe(4.1);
    expect(meanBMinusKs(3)).toBeCloseTo(3.85);
    expect(meanBMinusKs(8)).toBeCloseTo(2.6);
    expect(meanBMinusKs(9)).toBe(2.35);
  });
});
