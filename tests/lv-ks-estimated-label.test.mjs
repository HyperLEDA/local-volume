import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("frontend/src/components/ObservedParameterCards.tsx", "utf8");

test("Ks estimation is marked in the label instead of the measured number", () => {
  assert.match(source, /row\.name === "ks_mag" && ksEstimated/);
  assert.match(source, /`\$\{row\.displayLabel\} \(est\)`/);
  assert.doesNotMatch(source, /\(estimated\)/);
  assert.match(source, /className="parameter-block-reading"/);
});

test("estimated flag is retained as a boolean attribute rather than a data tile", () => {
  assert.match(source, /row\.name === "ks_estimated"/);
  assert.match(source, /\.value\.trim\(\)/);
  assert.match(source, /\.toLowerCase\(\) === "true"/);
  assert.match(source, /row\.name !== "ks_estimated"/);
});
