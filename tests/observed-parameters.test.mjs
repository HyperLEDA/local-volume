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
  PARAMETER_ORDER,
  GROUP_ORDER,
} from "../frontend/src/lib/observedParameters.ts";

function near(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

function row(name, value) {
  return {
    name, value, nice: null, description: "", unit: null,
    error: null, errorUnit: null,
  };
}

function keysInGroup(rows, title) {
  return groupObservedParameters(rows).find((group) => group.title === title)?.rows.map((r) => r.name) ?? [];
}

test("ICRS Galactic center approaches l=0, b=0", () => {
  const gal = icrsToGalactic(266.4051, -28.936175);
  assert.ok(gal);
  near(Math.min(gal.longitude, 360 - gal.longitude), 0, 0.003);
  near(gal.latitude, 0, 0.003);
});

test("supergalactic pole and SGL zero conventional axes", () => {
  const pole = galacticToSupergalactic({ longitude: 47.37, latitude: 6.32 });
  assert.ok(pole);
  near(pole.latitude, 90, 1e-9);
  const zero = galacticToSupergalactic({ longitude: 137.37, latitude: 0 });
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

test("known science fields all have an explicit group and display label", () => {
  assert.equal(Object.keys(PARAMETER_DEFINITIONS).length, 21);
  assert.deepEqual(GROUP_ORDER, ["Geometry", "Morphology", "Photometry", "Kinematics", "Distance", "H I"]);
  const orderKeys = GROUP_ORDER.flatMap((group) => PARAMETER_ORDER[group]);
  assert.equal(new Set(orderKeys).size, orderKeys.length);
  assert.deepEqual(orderKeys.sort(), Object.keys(PARAMETER_DEFINITIONS).sort());
});

test("grouping excludes astrometry, provenance, modulus method and blank fields but keeps false", () => {
  const grouped = groupObservedParameters([
    row("ra", "3.854"),
    row("lvg_source_catalog", "nearby_galaxy_catalog"),
    row("distance_reference", "2016EDD"),
    row("modulus_method", "TRGB"),
    row("dist", "4.9"),
    row("ks_estimated", "false"),
    row("fuv_mag", ""),
    row("w50_kms", "50.0"),
  ]);
  assert.deepEqual(grouped.map((g) => g.title), ["Photometry", "Distance", "H I"]);
  assert.deepEqual(grouped.flatMap((g) => g.rows.map((r) => r.name)), ["ks_estimated", "dist", "w50_kms"]);
});

test("Distance display order is μ, D, distance method regardless of API order", () => {
  const input = [row("distance_method", "TRGB"), row("dist", "4.9"), row("mu", "28.45")];
  assert.deepEqual(keysInGroup(input, "Distance"), ["mu", "dist", "distance_method"]);
});

test("Photometry display order follows B, Ks, AB, Hα, FUV", () => {
  const input = [
    row("fuv_mag", "16.3"), row("ks_mag", "10.1"),
    row("a_b_galactic_mag", "0.09"), row("ha_mag", "17.3"), row("b_mag", "13.0"),
  ];
  assert.deepEqual(keysInGroup(input, "Photometry"), [
    "b_mag", "ks_mag", "a_b_galactic_mag", "ha_mag", "fuv_mag",
  ]);
});

test("new unmapped science fields remain visible in Other", () => {
  const grouped = groupObservedParameters([row("future_measurement", "42")]);
  assert.equal(grouped[0].title, "Other");
  assert.equal(grouped[0].rows[0].displayLabel, "Future measurement");
});

test("FUV limit qualifier prefixes the magnitude instead of becoming a separate tile", () => {
  const grouped = groupObservedParameters([
    row("fuv_limit", ">"),
    row("fuv_mag", "23"),
    row("b_mag", "12.8"),
  ]);
  const photometry = grouped.find((group) => group.title === "Photometry");
  assert.ok(photometry);
  assert.deepEqual(photometry.rows.map((measurement) => measurement.name), ["b_mag", "fuv_mag"]);
  assert.equal(photometry.rows.find((measurement) => measurement.name === "fuv_mag")?.value, "> 23");
});

test("FUV magnitude is unchanged without a limit and isolated qualifier is hidden", () => {
  assert.equal(groupObservedParameters([row("fuv_mag", "21.3")])[0].rows[0].value, "21.3");
  assert.deepEqual(groupObservedParameters([row("fuv_limit", ">")]), []);
});

test("H-alpha limit qualifiers attach to the magnitude and disappear as tiles", () => {
  for (const sign of [">", "<"]) {
    const groups = groupObservedParameters([
      row("ha_limit", sign), row("ha_mag", "22.1"), row("b_mag", "13"),
    ]);
    const photometry = groups.find((group) => group.title === "Photometry");
    assert.ok(photometry);
    assert.deepEqual(photometry.rows.map((measurement) => measurement.name), ["b_mag", "ha_mag"]);
    assert.equal(photometry.rows[1].value, `${sign} 22.1`);
  }
});

test("H I qualifier prefixes 21-cm magnitude, with no extra measurement", () => {
  const groups = groupObservedParameters([
    row("hi21_limit", ">"), row("w50_kms", "60"), row("hi21_mag", "19.7"),
  ]);
  const hi = groups.find((group) => group.title === "H I");
  assert.ok(hi);
  assert.deepEqual(hi.rows.map((measurement) => measurement.name), ["hi21_mag", "w50_kms"]);
  assert.equal(hi.rows[0].value, "> 19.7");
});

test("Milky Way H I '-' source qualifier is a true minus sign", () => {
  const hi = groupObservedParameters([row("hi21_limit", "-"), row("hi21_mag", "3.4")])[0];
  assert.equal(hi.rows[0].value, "-3.4");
});

test("isolated qualifiers are hidden, unqualified measurements are unchanged", () => {
  assert.deepEqual(groupObservedParameters([
    row("ha_limit", "<"), row("hi21_limit", ">"), row("fuv_limit", ">"),
  ]), []);
  const groups = groupObservedParameters([
    row("ha_mag", "19.2"), row("hi21_mag", "18.5"), row("fuv_mag", "20"),
  ]);
  assert.deepEqual(groups.flatMap((group) => group.rows.map((r) => r.value)), ["19.2", "20", "18.5"]);
});
