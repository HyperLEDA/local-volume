import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { drawOverviewMarker, drawSelectedObjectMarker } from "../frontend/src/lib/overviewMarkers.ts";
import { markerDiameter } from "../frontend/src/lib/reticle.ts";

function radii(draw, source) {
  const result = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, stroke() {}, moveTo() {}, lineTo() {},
    arc(_x, _y, radius) { result.push(radius); },
  };
  draw(source, ctx);
  return result;
}

test("rendered size follows per-galaxy M_B even if Aladin reports a uniform source.size", () => {
  for (const draw of [drawOverviewMarker, drawSelectedObjectMarker]) {
    const faint = { x: 20, y: 20, size: 7, data: { morphology_t: 5, lv_marker_diameter: markerDiameter(-10, 12) } };
    const bright = { ...faint, data: { ...faint.data, lv_marker_diameter: markerDiameter(-22, 12) } };
    assert.deepEqual(radii(draw, faint), [2.25]);
    assert.deepEqual(radii(draw, bright), [5.25]);
    assert.deepEqual(radii(draw, { ...faint, size: 10, data: { morphology_t: 5 } }), [4.25]);
    assert.deepEqual(radii(draw, { ...faint, size: 10, data: { morphology_t: 5, lv_marker_diameter: NaN } }), [4.25]);
  }
});

test("catalogue builder stores the exact same diameter in source data and native marker size", () => {
  const map = readFileSync("frontend/src/components/AladinMap.tsx", "utf8");
  assert.match(map, /markerDiameter\(object\.abs_b_mag \?\? null, maxDiameter\)/);
  assert.match(map, /lv_marker_diameter: diameter/);
  assert.match(map, /marker\.setSize\(diameter\)/);
});
