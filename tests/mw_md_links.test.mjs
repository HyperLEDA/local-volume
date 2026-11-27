import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { atlasMdEdges, atlasMwMdEdges } from "../frontend/src/lib/atlasScientificLayers.ts";
import { greatCircleVertices, visibleGreatCircleSegments } from "../frontend/src/lib/mdConnection.ts";
const MW = 5064336;
const version = "fixture-v4";
function row(pgc, md, pos, patch = {}) {
  return {object: {pgc, md_pgc: md}, position: pos, kind: "individual", verified: false,
    evidence: {pgc, distance_lineage_status: "REVIEW_READY", distance_value_review_status: "NOT_REVIEWED",
      distance_formula_version: version, distance_computed_revision: 7, ...patch}};
}
const root = row(MW, 2, null);
const bubble = {pgc: MW, position: [.008,0,0], radiusSampleCount: 2};
test("MW MD links use the actual centre and both directed identities, without adding a galaxy", () => {
  const points = [row(1, MW, [.05,0,0]), row(2, 1, [0,.06,0]), row(3, 9, [.08,0,0])];
  const original = JSON.stringify(points);
  expect(atlasMdEdges(points).map(e=>[e.memberPgc,e.mdPgc])).toEqual([[2,1]]);
  const edges = atlasMwMdEdges(points,[root,...points],bubble);
  expect(edges).toEqual([
    {memberPgc:1,mdPgc:MW,from:[.05,0,0],to:[.008,0,0]},
    {memberPgc:MW,mdPgc:2,from:[.008,0,0],to:[0,.06,0]},
  ]);
  expect(JSON.stringify(points)).toBe(original);
  expect(atlasMwMdEdges(points.slice(0,1),[root,...points],bubble)).toHaveLength(1);
});
test("MW MD links fail closed for missing centre, invalid evidence, duplicates and assigned distances", () => {
  const points = [row(1,MW,[.05,0,0]), row(2,MW,[.1,0,0],{distance_computed_revision:6}),
    row(3,MW,[.2,0,0],{distance_value_review_status:"HOLD"}),
    {...row(4,MW,[.3,0,0]),kind:"assigned"}, row(5,MW,[.4,0,0]),row(5,MW,[.5,0,0])];
  expect(atlasMwMdEdges(points,[root,...points],bubble).map(e=>e.memberPgc)).toEqual([1]);
  expect(atlasMwMdEdges(points,[root,...points],null)).toEqual([]);
  expect(atlasMwMdEdges(points,[root,root,...points],bubble)).toEqual([]);
  expect(atlasMwMdEdges(points,[row(MW,2,null,{distance_value_review_status:"HOLD"}),...points],bubble)).toEqual([]);
});
test("all-sky seam splits the actual great-circle path instead of joining opposite edges", () => {
  const arc = greatCircleVertices({ra:170,dec:0},{ra:190,dec:0});
  function project(ra,dec) {return [((ra+180)%360)/360*800,400-dec];}
  const segments = visibleGreatCircleSegments(arc,project,800);
  expect(segments).toHaveLength(2);
  for(const segment of segments) for(let i=1;i<segment.length;i++) {
    const a=project(...segment[i-1]); const b=project(...segment[i]);
    expect(Math.hypot(a[0]-b[0],a[1]-b[1])).toBeLessThan(30);
  }
  const sky=readFileSync("frontend/src/components/GroupSkyMap.tsx","utf8");
  const ui=readFileSync("frontend/src/components/GroupTidalUI.tsx","utf8");
  const page=readFileSync("frontend/src/pages/GroupPage.tsx","utf8");
  expect(sky).toContain("const scienceEdges = groupTidalEdges(members)");
  expect(sky).toContain("visibleGreatCircleSegments(");
  expect(sky).toMatch(/!miniature\s*&&\s*\(\s*<GroupTidalUI/);
  expect(ui).toContain("group.root_pgc === 5064336");
  expect(page).not.toContain("External-galaxy projected radii");
  expect(page).not.toContain("sky overlays are disabled");
});
