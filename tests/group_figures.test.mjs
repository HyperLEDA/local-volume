import { test, expect } from "bun:test";
import { buildGroupFigures, projectedKpc, independentDistance } from "../frontend/src/lib/groupFigureData.ts";

const root = {
  pgc: 1, name: "Host", ra: 0, dec: 0, dist_mpc: 10, lvg_v_lg_kms: 500,
  morphology_t: 1, abs_b_mag: -20, distance_method: "TRGB", log_mhi_msun: 9,
  parent_md_pgc: null,
};
const child = {
  pgc: 2, name: "Satellite", ra: 1, dec: 0, dist_mpc: 11, lvg_v_lg_kms: 550,
  morphology_t: -3, abs_b_mag: -15, distance_method: "TRGB", log_mhi_msun: 7.5,
  parent_md_pgc: 1,
};
const candidate = {
  pgc: 3, name: "Candidate", ra: 2, dec: 0, dist_mpc: 10, lvg_v_lg_kms: null,
  morphology_t: null, abs_b_mag: null, distance_method: "group", log_mhi_msun: null,
  parent_md_pgc: 1,
};
const group = {
  root_pgc: 1, group_id: -1, definition: "physical", member_count: 3,
  members: [root, child, candidate],
};

test("correct transverse distance and root delta velocity", () => {
  expect(projectedKpc(root, child)).toBeCloseTo(10000 * Math.sin(Math.PI/180), 5);
  const figures = buildGroupFigures(group);
  expect(figures).toHaveLength(8);
  const phase = figures.find((f) => f.key === "projected-phase-space");
  expect(phase.points).toHaveLength(1);
  expect(phase.points[0].y).toBe(50);
});

test("group depth discards group-assigned distances", () => {
  expect(independentDistance("TRGB")).toBe(true);
  expect(independentDistance("adopted group distance")).toBe(false);
  expect(independentDistance("NAM")).toBe(false);
  const depth = buildGroupFigures(group).find((f) => f.key === "group-depth");
  expect(depth.points).toHaveLength(1);
  expect(depth.points[0].y).toBe(1);
});

test("gas panel requires a valid dynamical M26 mass and luminosity function is unchanged", () => {
  const figures = buildGroupFigures(group);
  expect(figures.find((f) => f.key === "gas-content").unavailable).toMatch(/Holmberg-radius dynamical mass/);
  const lum = figures.find((f) => f.key === "luminosity-function");
  expect(lum.points.reduce((sum, p) => sum + p.y, 0)).toBe(1);
});

test("no fictitious points when spectroscopy is missing", () => {
  const empty = { ...group, members: [root, { ...child, lvg_v_lg_kms: null }, candidate] };
  const figures = buildGroupFigures(empty);
  expect(figures.find((f) => f.key === "projected-phase-space").points).toHaveLength(0);
  expect(figures.find((f) => f.key === "velocity-distribution").points).toHaveLength(0);
});
