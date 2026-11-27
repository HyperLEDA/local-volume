import { test, expect } from "bun:test";
import { buildAtlasMwGroupBubble, buildAtlasSpatialRows, atlasVisiblePoints, validatePhysicalGroupSnapshot } from "../frontend/src/lib/atlasSpatialScene.ts";
const MW = 5064336;
const version = "fixture-v4";
function galaxy(pgc, d, ra = 0, patch = {}) {
  return { pgc, name: `PGC ${pgc}`, ra, dec: 0, morphology_t: 4,
    spatial_distance: {pgc, dist_mpc: d, distance_origin: "DIRECT_MEASURED",
      distance_lineage_status: "REVIEW_READY", distance_value_review_status: "NOT_REVIEWED",
      distance_formula_version: version, distance_computed_revision: 7, ...patch} };
}
function snapshot(patch = {}) {
  return validatePhysicalGroupSnapshot({ catalogue_pgcs: [MW,1,2,3,4,5,6], groups: [{
    group_id: -MW, root_pgc: MW, name: "Milky Way", definition: "physical", root_ra: 0, root_dec: 0,
    distance_mpc: .008, extent_kpc: null, member_count: 6, member_pgcs: [MW,1,2,3,4,5],
    source_version: version, ...patch}] });
}
function objects() {
  return [galaxy(MW,.008,0,{distance_origin:"UNKNOWN"}), galaxy(1,.05), galaxy(2,.05,180),
    galaxy(3,5,0,{distance_origin:"GROUP_ASSIGNED"}), galaxy(4,5,0,{distance_value_review_status:"HOLD"}),
    galaxy(5,5,0,{distance_computed_revision:6}), galaxy(6,10)];
}
test("MW envelope uses the centre not the Sun and only qualified canonical members", () => {
  for (const frame of ["ICRS","GALACTIC","SUPERGALACTIC"]) {
    const rows = buildAtlasSpatialRows(objects(),frame);
    const bubble = buildAtlasMwGroupBubble(rows,snapshot(),frame,"individual",true);
    expect(bubble.pgc).toBe(MW);
    expect(Math.hypot(...bubble.position)).toBeCloseTo(.008,10);
    expect(bubble.radiusMpc).toBeCloseTo(.058,10);
    expect(bubble.radiusSampleCount).toBe(2);
    expect(bubble.memberCount).toBe(6);
    expect(bubble.verified).toBe(false);
    expect(rows[0].position).toBeNull();
    expect(atlasVisiblePoints(rows,"catalogue").some(p=>p.object.pgc===MW)).toBe(false);
    expect(buildAtlasMwGroupBubble(rows,snapshot(),frame,"catalogue",false)).toEqual(bubble);
    expect(buildAtlasMwGroupBubble(rows,snapshot(),frame,"verified",true)).toBeNull();
  }
});
test("MW envelope fails closed for inconsistent centre, epoch or missing member geometry", () => {
  const rows = buildAtlasSpatialRows(objects(),"ICRS");
  expect(buildAtlasMwGroupBubble(rows,snapshot({distance_mpc:.01}),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble(rows,snapshot({root_ra:1}),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble(rows,snapshot({source_version:"stale"}),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble(rows,snapshot({extent_kpc:10}),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble(rows.slice(3),snapshot(),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble([rows[0],...rows.slice(3)],snapshot(),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble([...rows,rows[0]],snapshot(),"ICRS","individual",true)).toBeNull();
  expect(buildAtlasMwGroupBubble(rows,null,"ICRS","individual",true)).toBeNull();
});
test("duplicate satellites cannot inflate the MW envelope", () => {
  const source=objects();
  const rows=buildAtlasSpatialRows([...source,source[2]],"ICRS");
  const bubble=buildAtlasMwGroupBubble(rows,snapshot(),"ICRS","individual",true);
  expect(bubble.radiusSampleCount).toBe(1);
  expect(bubble.radiusMpc).toBeCloseTo(.042,10);
});
