import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSkyCoordinates,
  angularSeparationDeg,
  isWithinSkyRadius,
} from "./skySearch.ts";
import { tidalStrokeWidth } from "./tidalMarker.ts";
import {
  DEFAULT_SCIENTIFIC_FILTERS,
  matchesScientificFilters,
  activeFilterCount,
} from "./scientificFilters.ts";

function approx(a, b, eps = 1e-5) {
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
}

test("sexagesimal ICRS coordinates parse exactly", () => {
  const c = parseSkyCoordinates("10:03:18.84 +68:44:01.6");
  assert.ok(c);
  approx(c.ra, 150.8285);
  approx(c.dec, 68.73377778);
  const d = parseSkyCoordinates("ICRS 150.8285, +68.7338");
  assert.deepEqual(d, { ra: 150.8285, dec: 68.7338 });
});
test("explicit h m s and decimal signed space coordinates", () => {
  const c = parseSkyCoordinates("10h03m18.84s +68d44m01.6s");
  assert.ok(c);
  approx(c.ra, 150.8285);
  assert.deepEqual(parseSkyCoordinates("150.8285 +68.7338"), {
    ra: 150.8285,
    dec: 68.7338,
  });
  assert.deepEqual(parseSkyCoordinates("150.8285, 68.7338"), {
    ra: 150.8285,
    dec: 68.7338,
  });
  assert.deepEqual(parseSkyCoordinates("150.8285 68.7338"), {
    ra: 150.8285,
    dec: 68.7338,
  });
});
test("invalid and incomplete coordinate queries remain names", () => {
  for (const input of [
    "NGC 3077",
    "MESSIER081",
    "PGC 29146",
    "10:80:12 +68:44:01",
    "10:00:00 +91:00:00",
    "361, 40",
    "23:30:00 -90:01:00",
    "",
    "150 91",
  ]) {
    assert.equal(parseSkyCoordinates(input), null, input);
  }
});
test("RA 360 wrap and high-declination cone search", () => {
  approx(angularSeparationDeg(359.9, 0, 0.1, 0), 0.2);
  assert.ok(isWithinSkyRadius({ ra: 359.9, dec: 0 }, { ra: 0.1, dec: 0 }, 15));
  assert.equal(
    isWithinSkyRadius({ ra: 359.9, dec: 0 }, { ra: 0.1, dec: 0 }, 10),
    false,
  );
  assert.equal(
    isWithinSkyRadius({ ra: null, dec: 0 }, { ra: 0, dec: 0 }, 30),
    false,
  );
});
test("Theta1 marker stroke clamps and handles missing values", () => {
  const min = -2;
  const max = 2;
  approx(tidalStrokeWidth(-3, min, max), 1.2);
  approx(tidalStrokeWidth(-2, min, max), 1.2);
  approx(tidalStrokeWidth(0, min, max), 1.7);
  approx(tidalStrokeWidth(2, min, max), 2.2);
  approx(tidalStrokeWidth(3, min, max), 2.2);
  approx(tidalStrokeWidth(null, min, max), 1.5);
  approx(tidalStrokeWidth(undefined, min, max), 1.5);
  approx(tidalStrokeWidth(Number.NaN, min, max), 1.5);
  approx(tidalStrokeWidth(0, 1, 1), 1.5);
});
test("filters do not exclude any galaxies until enabled", () => {
  const obj = {
    dist: 50,
    lvg_v_lg_kms: 2500,
    morphology_t: 11,
    b_mag: 27,
    theta1: 5,
  };
  assert.equal(matchesScientificFilters(obj, DEFAULT_SCIENTIFIC_FILTERS), true);
  assert.equal(activeFilterCount(DEFAULT_SCIENTIFIC_FILTERS), 0);
});
test("activated ranges and missing values obey initial policy", () => {
  const filters = {
    ...DEFAULT_SCIENTIFIC_FILTERS,
    distance: { active: true, min: 0, max: 11 },
    tidal: "isolated",
  };
  const allowed = { dist: 11, theta1: -0.1 };
  const excluded = { dist: 12, theta1: -0.1 };
  const unknown = { dist: null, theta1: null };
  assert.equal(matchesScientificFilters(allowed, filters), true);
  assert.equal(matchesScientificFilters(excluded, filters), false);
  assert.equal(matchesScientificFilters(unknown, filters), false);
  assert.equal(
    matchesScientificFilters(unknown, { ...filters, tidal: "unknown" }),
    true,
  );
  assert.equal(
    matchesScientificFilters(unknown, { ...filters, includeMissing: false }),
    false,
  );
  assert.equal(activeFilterCount(filters), 2);
});
