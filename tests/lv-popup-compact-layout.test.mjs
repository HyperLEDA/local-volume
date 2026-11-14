import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const map = readFileSync("frontend/src/components/AladinMap.tsx", "utf8");
const css = readFileSync("frontend/src/index.css", "utf8");

function block(selector, occurrence = "last") {
  const start = occurrence === "first"
    ? css.indexOf(selector + " {")
    : css.lastIndexOf(selector + " {");
  assert.notEqual(start, -1, `Missing selector ${selector}`);
  const stop = css.indexOf("}", start);
  return css.slice(start, stop + 1);
}

test("popup retains four measurements with inline colon between label and value", () => {
  const field = map.split("function popupField(")[1].split("function popupTitle(")[0];
  const description = map.split("function popupDescription(")[1].split("function setCatalogSources(")[0];
  assert.match(field, /\$\{label\}:/);
  assert.match(field, /\$\{escapeHtml\(value\)\}/);
  for (const key of ["B", "K<sub>s</sub>", "V<sub>hel</sub>", "W<sub>50</sub>"]) {
    assert.ok(description.includes(JSON.stringify(key)), `Missing ${key}`);
  }
  assert.doesNotMatch(description, /popupField\("RA"|popupField\("Dec"/);
});

test("popup J2000 coordinate is at same font size as the object name", () => {
  assert.match(map, /formatJ2000Coordinate\(object\.ra, object\.dec\)/);
  assert.match(map, /lv-popup-jcoord/);
  assert.match(block(".lv-popup-name"), /font-size:\s*0\.95rem;/);
  assert.match(block(".lv-popup-jcoord"), /font-size:\s*0\.95rem;/);
  assert.match(block(".lv-popup-heading"), /column-gap:\s*12px;/);
});

test("popup narrows to 296 px and draws each field on a horizontal line", () => {
  assert.match(block(".aladin-frame .aladin-popup-container"), /width:\s*296px;/);
  assert.match(block(".lv-popup-field"), /flex-direction:\s*row;/);
  assert.match(block(".lv-popup-label"), /font-size:\s*0\.78rem;/);
  assert.match(block(".lv-popup-field"), /white-space:\s*nowrap;/);
});

test("coordinate and observed-parameter cards have content-based widths", () => {
  assert.match(css, /\.object-details\s*>\s*\.object-coordinates,\s*\.object-details\s*>\s*\.object-params\s*\{[^}]*width:\s*fit-content;/s);
  assert.match(block(".object-details > .object-params .parameter-matrix", "first"), /width:\s*max-content;/);
  assert.match(block(".object-details > .object-params .parameter-matrix", "first"), /table-layout:\s*auto;/);
  assert.match(css, /@media \(max-width:\s*580px\)[\s\S]*\.object-details > \.object-params \.parameter-matrix[\s\S]*width:\s*100%/);
});
