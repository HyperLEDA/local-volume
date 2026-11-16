import test from "node:test";
import assert from "node:assert/strict";
import { medianHeliocentricVelocity } from "./atlasVelocitySummary.ts";

test("V_h median excludes null, NaN and Infinity and uses only native heliocentric values", () => {
  assert.deepEqual(
    medianHeliocentricVelocity([
      { lvg_v_hel_kms: -100, v_hel: 9999 },
      { lvg_v_hel_kms: 300 },
      { lvg_v_hel_kms: null, v_hel: 8888 },
      { lvg_v_hel_kms: Number.NaN },
      { lvg_v_hel_kms: 50 },
      { lvg_v_hel_kms: Infinity },
    ]),
    { median: 50, measured: 3 },
  );
  assert.deepEqual(
    medianHeliocentricVelocity([
      { lvg_v_hel_kms: -80 },
      { lvg_v_hel_kms: 100 },
    ]),
    { median: 10, measured: 2 },
  );
  assert.deepEqual(medianHeliocentricVelocity([{ lvg_v_hel_kms: null }]), {
    median: null,
    measured: 0,
  });
});
