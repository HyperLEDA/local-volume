import { describe, test, expect } from "bun:test";
import { observedUncertainty } from "../frontend/src/lib/observedUncertainty.ts";

const ready = { physical_status: "ready", distance_mpc: 3.681, e_distance_plus_mpc: 0.051, e_distance_minus_mpc: 0.0509, v_lg_kms: 310, e_v_lg_kms: 10 };

describe("Observed Properties source-paired uncertainties", () => {
  test("near-symmetric distance error gets a compact single ± value", () => {
    expect(observedUncertainty({ name: "dist", value: "3.68" }, ready)).toEqual({kind: "symmetric", sigma: "0.051"});
  });
  test("genuinely asymmetric distance is two rows", () => {
    const source = {...ready, e_distance_plus_mpc: 0.0214, e_distance_minus_mpc: 0.0196};
    expect(observedUncertainty({ name: "dist", value: "3.68" }, source)).toEqual({kind: "asymmetric", plus: "0.021", minus: "0.020"});
  });
  test("Local Group velocity has ± and one unit", () => {
    expect(observedUncertainty({ name: "lvg_v_lg_kms", value: "310" }, ready)).toEqual({kind: "symmetric", sigma: "10"});
  });
  test("do not attach errors to conflicting, stale, or absent measurements", () => {
    expect(observedUncertainty({ name: "dist", value: "5.68" }, ready)).toBeNull();
    expect(observedUncertainty({ name: "lvg_v_lg_kms", value: "312" }, ready)).toBeNull();
    expect(observedUncertainty({ name: "dist", value: "3.68" }, {...ready, physical_status: "pending"})).toBeNull();
    expect(observedUncertainty({ name: "dist", value: "3.68" }, {...ready, e_distance_plus_mpc: null})).toBeNull();
  });
});
