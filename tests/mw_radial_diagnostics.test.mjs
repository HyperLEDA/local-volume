import { expect, test } from "bun:test";
import { mwRadialSample, mwRadialSummary, buildMwRadialFigures } from "../frontend/src/lib/mwRadialDiagnostics.ts";
const mw = 5064336;
const root = {pgc: mw, group_id: -mw, name: "Milky Way", membership_status: "root", ra: 0, dec: 0, dist_mpc: .008, distance_origin: "UNKNOWN"};
function sat(pgc, changes = {}) {
  return {pgc, group_id: -mw, membership_status: "computed", name: `sat${pgc}`, ra: 0, dec: 0, dist_mpc: .05,
    distance_origin: "DIRECT_MEASURED", distance_lineage_status: "REVIEW_READY", distance_value_review_status: "NOT_REVIEWED",
    morphology_t: -3, log_mhi_msun: 6, log_m26_msun: 8, ...changes};
}
function group(...members) {return {group_id: -mw, root_pgc: mw, members: [root, ...members]};}
test("MW radii use full three-dimensional distances and exclude root", () => {
  const s = mwRadialSample(group(sat(1),sat(2,{ra:180}),sat(3,{ra:90})));
  expect(s.map(p=>p.member.pgc)).toEqual([1,3,2]);
  expect(s[0].radiusKpc).toBeCloseTo(42,10);
  expect(s[1].radiusKpc).toBeCloseTo(Math.hypot(50,8),10);
  expect(s[2].radiusKpc).toBeCloseTo(58,10);
  expect(mwRadialSummary(s).medianKpc).toBe(s[1].radiusKpc);
});
test("unconfirmed, assigned, untraceable and blocked satellites do not gain radii",()=>{
  const s = mwRadialSample(group(sat(1),sat(2,{membership_status:"unconfirmed"}),sat(3,{distance_origin:"GROUP_ASSIGNED"}),sat(4,{distance_lineage_status:"HOLD"}),sat(5,{distance_value_review_status:"HOLD"}),sat(6,{dist_mpc:null}),sat(7,{group_id:-123}),sat(8,{distance_value_review_status:undefined}),sat(9,{ra:360})));
  expect(s.map(p=>p.member.pgc)).toEqual([1]);
  expect(mwRadialSample(group(sat(1),sat(1)))).toEqual([]);
  expect(mwRadialSample({...group(sat(1)),root_pgc:1})).toEqual([]);
  expect(mwRadialSample({...group(sat(1)),members:[{...root,distance_origin:"GROUP_ASSIGNED"},sat(1)]})).toEqual([]);
});
test("MW figures carry actual radii, cumulative tie counts and gas limits",()=>{
  const figs = buildMwRadialFigures(group(sat(1),sat(2,{hi_mass_is_upper_limit:true}),sat(3,{ra:180,log_m26_msun:null,morphology_t:null})));
  expect(figs.map(f=>f.key)).toEqual(["mw-radial-distribution","mw-morphology-radius","mw-gas-radius"]);
  expect(figs[0].points.map(p=>p.y)).toEqual([0,2,3]);
  expect(figs[0].csvRows.map(p=>p.cumulative_count)).toEqual([2,2,3]);
  expect(figs[0].csvRows[0].galactocentric_radius_kpc).toBeCloseTo(42,10);
  expect(figs[1].points).toHaveLength(2);
  expect(figs[2].points[1].upperLimit).toBe(true);
  expect(figs[2].csvRows[1].hi_upper_limit).toBe(true);
  expect(figs[2].csvRows[1].log_mhi_over_m26).toBe(-2);
  expect(buildMwRadialFigures(group()).every(f=>f.points.length===0 && f.unavailable)).toBe(true);
});
