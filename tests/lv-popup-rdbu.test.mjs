import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatJ2000Coordinate } from "../frontend/src/lib/popupCoordinates.ts";
import {
  morphologyColor,
  UNKNOWN_MORPHOLOGY_COLOR,
} from "../frontend/src/lib/morphologyColors.ts";

test("J2000 popup coordinate retains RA/Dec precision and signs", () => {
  const ra = (11 + 32 / 60 + 56.98 / 3600) * 15;
  const dec = -(31 / 60 + 59 / 3600);
  assert.equal(formatJ2000Coordinate(ra, dec), "J113256.98-003159.0");
  assert.equal(formatJ2000Coordinate(360, 0), "J000000.00+000000.0");
  assert.equal(formatJ2000Coordinate(359.99999999, -0), "J000000.00-000000.0");
  assert.equal(formatJ2000Coordinate(-15, 90), "J230000.00+900000.0");
});

test("missing or invalid popup coordinates are omitted", () => {
  assert.equal(formatJ2000Coordinate(null, 0), null);
  assert.equal(formatJ2000Coordinate(0, null), null);
  assert.equal(formatJ2000Coordinate(Number.NaN, 0), null);
  assert.equal(formatJ2000Coordinate(0, Infinity), null);
  assert.equal(formatJ2000Coordinate(0, 95), null);
});

test("popup keeps four LV measurements but not standalone coordinates or a26", () => {
  const source = readFileSync("frontend/src/components/AladinMap.tsx", "utf8");
  const popup = source.split("function popupDescription(")[1].split("function setCatalogSources(")[0];
  assert.match(source, /formatJ2000Coordinate\(object\.ra, object\.dec\)/);
  assert.match(source, /lv-popup-jcoord/);
  for (const field of ['"B"', '"K<sub>s</sub>"', '"V<sub>hel</sub>"', '"W<sub>50</sub>"']) {
    assert.match(popup, new RegExp(String.raw`popupField\(\s*${field}\s*,`));
  }
  assert.doesNotMatch(popup, /LVGDB|a<sub>26<\/sub>|popupField\("RA"|popupField\("Dec"/);
});

test("morphology palette preserves distinct early, intermediate and late types", () => {
  assert.equal(morphologyColor(-3), "#c96d76");
  assert.equal(morphologyColor(0), "#a995a6");
  assert.equal(morphologyColor(5), "#6489bc");
  assert.equal(morphologyColor(10), "#3f6fab");
  assert.equal(morphologyColor(-10), morphologyColor(-3));
  assert.equal(morphologyColor(12), morphologyColor(10));
  assert.notEqual(morphologyColor(-2), morphologyColor(8));
  for (const missing of [undefined, null, NaN, "3", "G"]) {
    assert.equal(morphologyColor(missing), UNKNOWN_MORPHOLOGY_COLOR);
  }
});
