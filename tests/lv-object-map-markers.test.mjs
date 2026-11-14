import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("object-page map colors both selected object and neighbors by morphology", () => {
  const source = readFileSync("frontend/src/components/AladinMap.tsx", "utf8");
  assert.match(source, /shape: isOverview \? drawOverviewMarker : drawSelectedObjectMarker/);
  assert.match(source, /name: "Other LV catalog objects"/);
  assert.match(source, /color: \(source: AladinSource\) =>\s*morphologyColor/);
});

test("object detail forwards morphology T to its selected sky marker", () => {
  const api = readFileSync("frontend/src/api/objects.ts", "utf8");
  const page = readFileSync("frontend/src/pages/ObjectPage.tsx", "utf8");
  assert.match(api.split("export type CatalogObjectDetail = {")[1].split("type ObjectsListResponse")[0], /morphology_t\?: number \| null;/);
  assert.match(page, /morphology_t: data\.morphology_t \?\? null/);
});
