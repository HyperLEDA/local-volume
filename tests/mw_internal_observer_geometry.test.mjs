import { test, expect } from "bun:test";
import { calculateGroupScience } from "../frontend/src/lib/groupScience.ts";
import { buildGroupFigures, projectedKpc } from "../frontend/src/lib/groupFigureData.ts";

const host = { pgc: 5064336, name: "Milky Way", ra: 266.4168, dec: -29.00781,
  dist_mpc: 0.007943282347242814, lvg_v_lg_kms: -65, distance_method: "geom",
  abs_b_mag: -19.1, log_lks_lsun: 10.992, log_mhi_msun: 9.47 };
const satellites = Array.from({ length: 5 }, (_, i) => ({
  pgc: i + 1, name: `Satellite ${i}`, parent_md_pgc: host.pgc, ra: 20 + i * 40,
  dec: -20, dist_mpc: 0.05 + i * 0.02, lvg_v_lg_kms: i * 15 - 20,
  distance_method: "TRGB", abs_b_mag: -12, log_lks_lsun: 8,
  log_mhi_msun: 7, morphology_t: -3,
}));
const group = { root_pgc: host.pgc, members: [host, ...satellites], member_count: 6 };

test("MW group never receives external-host orbital or projected statistics", () => {
  expect(projectedKpc(host, satellites[0])).toBeNull();
  const s = calculateGroupScience(group);
  for (const key of ["meanProjectedKpc", "medianProjectedKpc", "crossingTimeGyr",
    "logOrbitalMassMsun", "meanVelocity", "velocityDispersion"]) expect(s[key]).toBeNull();
  expect(s.nProjected).toBe(0);
  expect(s.nOrbitalTracers).toBe(0);
  expect(s.nVel).toBe(6);
  expect(s.logSummedKsLsun).toBeGreaterThan(10.992);
  expect(s.nHiDetections).toBe(6);
});

test("MW group retains observer-native and photometric diagnostics plus qualified Galactocentric plots", () => {
  const figs = buildGroupFigures(group);
  expect(figs.map(f => f.key)).toEqual(["velocity-distance", "luminosity-function", "mw-radial-distribution", "mw-morphology-radius", "mw-gas-radius"]);
  expect(figs.slice(2).every(f => f.points.length === 0 && f.unavailable)).toBe(true);
  expect(figs[0].points).toHaveLength(5);
  expect(figs[1].csvRows).toHaveLength(5);
});
