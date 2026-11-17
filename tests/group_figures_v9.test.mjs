import { test, expect } from "bun:test";
import { buildGroupFigures, groupFigureCsv, projectedKpc } from "../frontend/src/lib/groupFigureData.ts";

const host = { pgc: 10, name: "Host", ra: 0, dec: 0, dist_mpc: 10,
  distance_method: "TRGB", lvg_v_lg_kms: 500, morphology_t: -2 };
const sat = { pgc: 20, name: "Satellite", ra: 1, dec: 0, dist_mpc: 11,
  distance_method: "TRGB", lvg_v_lg_kms: 550, morphology_t: 9,
  abs_b_mag: -15, log_mhi_msun: 7.5, log_m26_msun: 8.0,
  hi_mass_is_upper_limit: true };
const other = { pgc: 30, name: "=Formula", ra: 2, dec: 0, dist_mpc: 10,
  distance_method: "group", lvg_v_lg_kms: null, morphology_t: null };
const group = { root_pgc: 10, definition: "physical", members: [host, sat, other] };

test("projected distance uses host distance", () => {
  expect(projectedKpc(host, sat)).toBeCloseTo(10000 * Math.sin(Math.PI / 180), 6);
});
test("v9 has 8 diagnostics, with proper sample selection", () => {
  const figures = buildGroupFigures(group);
  expect(figures).toHaveLength(8);
  expect(figures.find(f => f.key === "projected-phase-space").points[0].y).toBe(50);
  expect(figures.find(f => f.key === "group-depth").points).toHaveLength(1);
  expect(figures.find(f => f.key === "radial-distribution").points.at(-1).y).toBe(2);
  expect(figures.find(f => f.key === "velocity-distribution").csvRows).toHaveLength(1);
});
test("gas mass ratio is labeled M26 and retains upper limits", () => {
  const gas = buildGroupFigures(group).find(f => f.key === "gas-content");
  expect(gas.title).toContain("M_26");
  expect(gas.points[0].y).toBe(-0.5);
  expect(gas.points[0].upperLimit).toBe(true);
  const csv = groupFigureCsv(gas);
  expect(csv).toContain("hi_upper_limit");
  expect(csv).toContain("true");
});
test("CSV contains source identities and scientific units", () => {
  const figure = buildGroupFigures(group).find(f => f.key === "projected-phase-space");
  const csv = groupFigureCsv(figure);
  expect(csv).toContain("pgc,name,x,y,rp_kpc,delta_v_lg_kms");
  expect(csv).toContain("20,Satellite");
});
test("velocity-distance excludes distance inferred from group assignment", () => {
  const d = buildGroupFigures(group).find(f => f.key === "velocity-distance");
  expect(d.points).toHaveLength(2);
});
