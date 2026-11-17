import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { calculateGroupScience } from '../frontend/src/lib/groupScience.ts';
import { buildGroupFigures } from '../frontend/src/lib/groupFigureData.ts';

const host = {
 pgc:1,name:'Host',ra:1,dec:0,dist_mpc:4,distance_method:'group adopted',
 lvg_v_lg_kms:200,e_v_lg_kms:3,e_distance_minus_mpc:null,e_distance_plus_mpc:null,
 morphology_t:-3,log_lks_lsun:10,log_mhi_msun:null,log_m26_msun:11,
};
const satellites = [1,2,3,4,5].map((i)=>({
  pgc:i+1,parent_md_pgc:1,name:`S${i}`,ra:1+i*0.1,dec:0,dist_mpc:4+i*0.1,
  distance_method:'TRGB',lvg_v_lg_kms:200+i*12,e_v_lg_kms:4,
  e_distance_minus_mpc:.04,e_distance_plus_mpc:.05,
  morphology_t:i%2?10:-2,log_lks_lsun:8+i*.1,log_mhi_msun:7+i*.1,
  hi_mass_is_upper_limit: i===1,log_m26_msun:9+i*.1,
}));
const group = {
 root_pgc:1, name:'Host', definition:'physical', member_count:6, subgroup_count:0,
 distance_mpc:4, extent_kpc:40,members:[host,...satellites]
};

test('three-column summary computes separately labelled orbital, K and HI statistics', () => {
 const s=calculateGroupScience(group);
 assert.equal(s.nVel,6);assert.equal(s.nIndependentD,5);
 assert.equal(s.nOrbitalTracers,5);assert.equal(s.nHiDetections,4);
 assert.ok(s.logOrbitalMassMsun>8);assert.ok(s.logSummedKsLsun>10);
 assert.ok(s.kBandGapMag>0);assert.ok(s.crossingTimeGyr>0);
});
test('depth uses satellite independent distances relative to adopted MD, without inventing an MD error', () => {
 const fig=buildGroupFigures(group).find(f=>f.key==='group-depth');
 assert.equal(fig.points.length,5);
 assert.match(fig.subtitle,/adopted \(not independent\)/);
 assert.equal(fig.points[0].yErrorPlus,undefined);
});
test('velocity differences propagate both paired velocity errors, no fabricated D errors',()=>{
 const fig=buildGroupFigures(group).find(f=>f.key==='projected-phase-space');
 assert.equal(fig.points.length,5);
 assert.equal(fig.points[0].yErrorPlus,5);
 assert.equal(fig.points[0].yErrorMinus,5);
 const distance=buildGroupFigures(group).find(f=>f.key==='velocity-distance');
 assert.equal(distance.points.length,5);
 assert.equal(distance.points[0].xErrorMinus,.04);
 assert.equal(distance.points[0].xErrorPlus,.05);
 assert.equal(distance.csvRows[0].e_v_lg_kms,4);
});
test('missing measurement errors remain absent rather than zero',()=>{
 const without={...group,members:[{...host},...satellites.map(s=>({...s,e_v_lg_kms:null}))]};
 const fig=buildGroupFigures(without).find(f=>f.key==='projected-phase-space');
 assert.ok(fig.points.every(p=>p.yErrorPlus===undefined));
});
