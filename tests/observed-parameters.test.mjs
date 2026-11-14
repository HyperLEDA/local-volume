import { test } from "node:test";
import assert from "node:assert/strict";
import {
  icrsToGalactic,
  galacticToSupergalactic,
  formatRaHms,
  formatDecDms,
} from "../frontend/src/lib/coordinates.ts";
import {
  groupObservedParameters,
  PARAMETER_DEFINITIONS,
  GROUP_ORDER,
} from "../frontend/src/lib/observedParameters.ts";

function near(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

function row(name, value) {
  return {
    name,
    value,
    nice: null,
    description: "",
    unit: null,
    error: null,
    errorUnit: null,
  };
}

test("ICRS Galactic center approaches l=0, b=0", () => {
  const gal = icrsToGalactic(266.4051, -28.936175);
  assert.ok(gal);
  near(Math.min(gal.longitude, 360 - gal.longitude), 0, 0.003);
  near(gal.latitude, 0, 0.003);
});

test("supergalactic pole and SGL zero conventional axes", () => {
  const pole = galacticToSupergalactic({longitude: 47.37, latitude: 6.32});
  assert.ok(pole);
  near(pole.latitude, 90, 1e-9);
  const zero = galacticToSupergalactic({longitude: 137.37, latitude: 0});
  assert.ok(zero);
  near(zero.longitude, 0, 1e-9);
  near(zero.latitude, 0, 1e-9);
});

test("coordinate formatting covers wrap and negative zero", () => {
  assert.equal(formatRaHms(360), "00h 00m 00.00s");
  assert.equal(formatRaHms(3.854166667), "00h 15m 25.00s");
  assert.equal(formatDecDms(-0), "−00° 00′ 00.0″");
  assert.equal(formatDecDms(-21.444555), "−21° 26′ 40.4″");
});

test("known science fields all have group and label", () => {
  assert.equal(Object.keys(PARAMETER_DEFINITIONS).length, 22);
  assert.deepEqual(GROUP_ORDER, ["Geometry", "Morphology", "Photometry", "Kinematics", "Distance", "H I"]);
});

test("grouping excludes coordinates, provenance and blank fields but retains false", () => {
  const grouped = groupObservedParameters([
    row("ra", "3.854"),
    row("lvg_source_catalog", "nearby_galaxy_catalog"),
    row("distance_reference", "2016EDD"),
    row("dist", "4.9"),
    row("ks_estimated", "false"),
    row("fuv_mag", ""),
    row("w50_kms", "50.0"),
  ]);
  assert.deepEqual(grouped.map((g) => g.title), ["Photometry", "Distance", "H I"]);
  assert.deepEqual(grouped.flatMap((g) => g.rows.map((r) => r.name)), ["ks_estimated", "dist", "w50_kms"]);
});

test("unmapped science field is not silently dropped", () => {
  const grouped = groupObservedParameters([row("future_measurement", "42")]);
  assert.equal(grouped[0].title, "Other");
  assert.equal(grouped[0].rows[0].displayLabel, "Future measurement");
});
