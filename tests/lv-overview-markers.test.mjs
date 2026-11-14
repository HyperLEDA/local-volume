import test from "node:test";
import assert from "node:assert/strict";
import { markerDiameter, findReticleTarget } from "../frontend/src/lib/reticle.ts";
import {
  drawOverviewMarker,
  drawSelectedObjectMarker,
  OVERVIEW_MARKER_MAX_DIAMETER,
  OVERVIEW_MARKER_STROKE_WIDTH,
} from "../frontend/src/lib/overviewMarkers.ts";

test("overview caps bright sources at 14px without changing faint 7px or local 18px", () => {
  assert.equal(OVERVIEW_MARKER_MAX_DIAMETER, 14);
  assert.equal(markerDiameter(null, 14), 7);
  assert.equal(markerDiameter(25, 14), 7);
  assert.equal(markerDiameter(-100, 14), 14);
  assert.equal(markerDiameter(-100), 18);
});

test("custom map outline draws an unfilled 1.5px circle with its T color", () => {
  const state = { calls: [], strokeStyle: "", lineWidth: 0 };
  const ctx = {
    save() { state.calls.push(["save"]); },
    beginPath() { state.calls.push(["beginPath"]); },
    arc(...args) { state.calls.push(["arc", ...args]); },
    stroke() { state.calls.push(["stroke"]); },
    restore() { state.calls.push(["restore"]); },
    set strokeStyle(value) { state.strokeStyle = value; },
    set lineWidth(value) { state.lineWidth = value; },
  };
  drawOverviewMarker({ x: 24, y: 32, size: 14, data: { morphology_t: 10 } }, ctx);
  assert.equal(OVERVIEW_MARKER_STROKE_WIDTH, 1.5);
  assert.equal(state.strokeStyle, "#3f6fab");
  assert.equal(state.lineWidth, 1.5);
  assert.deepEqual(state.calls[2], ["arc", 24, 32, 6.25, 0, 2 * Math.PI]);
  assert.deepEqual(state.calls.at(-2), ["stroke"]);
  assert.deepEqual(state.calls.at(-1), ["restore"]);
});

test("invalid projected coordinates are not drawn", () => {
  let invoked = false;
  drawOverviewMarker({ data: { morphology_t: -3 } }, {
    save() { invoked = true; },
  });
  assert.equal(invoked, false);
});

test("reticle hit tolerance matches the rendered overview size", () => {
  const object = { pgc: 7, ra: 120, dec: 30, bt: 25, b_mag: -100 };
  const found = findReticleTarget(
    [object],
    [100, 100],
    () => [50 + 9, 50],
  );
  assert.equal(found, object);
  const legacyOnly = { ...object, b_mag: null, bt: -100 };
  assert.equal(findReticleTarget([legacyOnly], [100, 100], () => [59, 50]), null);
});


test("selected object marker draws a plus cross over its morphology-colored circle", () => {
  const paths = [];
  const styles = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {},
    arc(...args) { paths.push(["arc", ...args]); },
    moveTo(...args) { paths.push(["moveTo", ...args]); },
    lineTo(...args) { paths.push(["lineTo", ...args]); },
    stroke() { styles.push(this.strokeStyle); },
    strokeStyle: "", lineWidth: 0,
  };
  drawSelectedObjectMarker(
    { x: 20, y: 30, size: 10, data: { morphology_t: 5 } },
    ctx,
  );
  assert.deepEqual(paths[0], ["arc", 20, 30, 4.25, 0, 2 * Math.PI]);
  assert.deepEqual(paths.slice(1), [
    ["moveTo", 16, 30], ["lineTo", 24, 30],
    ["moveTo", 20, 26], ["lineTo", 20, 34],
  ]);
  assert.deepEqual(styles, ["#6489bc", "#f6e5a8"]);
});
