import assert from "node:assert/strict";
import { test } from "node:test";
import { formatParameterDisplay } from "./precision.ts";
import { groupObservedParameters } from "./observedParameters.ts";

function measurement(value, error, unit = "mag") {
  return formatParameterDisplay("example", value, error, { unit }, { unit });
}

test("does not pad a zero onto 0.1 or 0.01 uncertainties", () => {
  assert.deepEqual(measurement(7.3, 0.1), { value: "7.3", error: "0.1" });
  assert.deepEqual(measurement(14.2, 0.01), { value: "14.20", error: "0.01" });
  assert.deepEqual(measurement(27.93, 0.07), { value: "27.93", error: "0.07" });
});

test("whole-number velocity uncertainties remove artificial decimals", () => {
  assert.deepEqual(measurement(19, 4, "km/s"), { value: "19", error: "4" });
  assert.deepEqual(measurement(70, 4, "km/s"), { value: "70", error: "4" });
});

test("does not display a zero-valued missing uncertainty", () => {
  assert.deepEqual(measurement(14.6, 0), { value: "14.6", error: null });
});

test("retains nonzero second uncertainty digit", () => {
  assert.deepEqual(measurement(14.236, 0.13), {
    value: "14.24",
    error: "0.13",
  });
});

test("Halpha and FUV follow Distance and precede H I", () => {
  function row(name) {
    return {
      name,
      value: "1",
      nice: null,
      description: "",
      unit: null,
      error: null,
      errorUnit: null,
    };
  }
  const groups = groupObservedParameters([
    row("b_mag"),
    row("mu"),
    row("fuv_mag"),
    row("hi21_mag"),
    row("ha_mag"),
  ]);
  assert.deepEqual(
    groups.map((g) => g.title),
    ["Photometry", "Distance", "Star formation", "H I"],
  );
  assert.deepEqual(
    groups[2].rows.map((r) => r.name),
    ["ha_mag", "fuv_mag"],
  );
});
