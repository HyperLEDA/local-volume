import type { GroupDetail } from "../api/groups.ts";
import { independentDistance, projectedKpc } from "./groupFigureData.ts";

export function validNumber(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
export function arithmeticMean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
export function sampleDispersion(values: readonly number[]): number | null {
  if (values.length < 3) return null;
  const m = arithmeticMean(values)!;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}
function logSum(logarithms: readonly number[]): number | null {
  if (!logarithms.length) return null;
  const max = Math.max(...logarithms);
  return max + Math.log10(logarithms.reduce((s, x) => s + 10 ** (x - max), 0));
}
function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export type GroupScience = {
  nVel: number;
  nIndependentD: number;
  nMorph: number;
  nKs: number;
  nHiDetections: number;
  nOrbitalTracers: number;
  nProjected: number;
  meanIndependentD: number | null;
  meanVelocity: number | null;
  velocityDispersion: number | null;
  meanProjectedKpc: number | null;
  medianProjectedKpc: number | null;
  crossingTimeGyr: number | null;
  logOrbitalMassMsun: number | null;
  logSummedKsLsun: number | null;
  logSummedDetectedHiMsun: number | null;
  earlyTypeFraction: number | null;
  kBandGapMag: number | null;
};

/** Summaries from the adopted group membership. No model-dependent estimator
 * is interpreted as a published measurement or as proof of boundness.
 */
export function calculateGroupScience(group: GroupDetail): GroupScience {
  const members = group.members;
  const host = members.find((m) => m.pgc === group.root_pgc);
  const sats = members.filter((m) => m.pgc !== group.root_pgc);
  const speeds = members.map((m) => m.lvg_v_lg_kms).filter(validNumber);
  const independentD = members.filter((m) => validNumber(m.dist_mpc) && m.dist_mpc > 0 && independentDistance(m.distance_method));
  const projected = host ? sats.flatMap((member) => {
    const rp = projectedKpc(host, member);
    return rp !== null && Number.isFinite(rp) && rp >= 0 ? [{member, rp}] : [];
  }) : [];
  const radii = projected.map((point) => point.rp);
  const dispersion = sampleDispersion(speeds);
  const directSatellites = host ? projected.filter(({member}) => member.parent_md_pgc === host.pgc) : [];
  const velocities = host && validNumber(host.lvg_v_lg_kms) ? directSatellites.flatMap(({member, rp}) =>
    validNumber(member.lvg_v_lg_kms) ? [{rp, dv: member.lvg_v_lg_kms - host.lvg_v_lg_kms!}] : []
  ) : [];

  // Orbital estimator for an MD-dominated suite, assuming <e^2> = 1/2:
  // M_orb = 16/(pi*G) * <deltaV_los^2 * Rp>. G in kpc (km/s)^2 Msun^-1.
  // Only direct MD satellites are tracers, excluding embedded subgroups.
  // Minimum five measured satellite velocities is a preliminary quality floor.
  const G = 4.30091e-6;
  const orbital = velocities.length >= 5
    ? (16 / (Math.PI * G)) * arithmeticMean(velocities.map(({dv, rp}) => dv * dv * rp))!
    : null;
  const crossing = dispersion !== null && dispersion > 0 && radii.length >= 3
    ? (arithmeticMean(radii)! / dispersion) * 0.9777922217 : null;
  const morphology = sats.filter((m) => validNumber(m.morphology_t) && m.morphology_t >= -6 && m.morphology_t <= 10);
  const ks = members.map((m) => m.log_lks_lsun).filter(validNumber);
  const hi = members.filter((m) => validNumber(m.log_mhi_msun) && m.hi_mass_is_upper_limit !== true);
  const bright = [...ks].sort((a, b) => b - a);
  return {
    nVel: speeds.length, nIndependentD: independentD.length, nMorph: morphology.length,
    nKs: ks.length, nHiDetections: hi.length, nOrbitalTracers: velocities.length, nProjected: radii.length,
    meanIndependentD: arithmeticMean(independentD.map((m) => m.dist_mpc!)),
    meanVelocity: arithmeticMean(speeds), velocityDispersion: dispersion,
    meanProjectedKpc: arithmeticMean(radii), medianProjectedKpc: median(radii),
    crossingTimeGyr: crossing,
    logOrbitalMassMsun: orbital !== null && orbital > 0 ? Math.log10(orbital) : null,
    logSummedKsLsun: logSum(ks),
    logSummedDetectedHiMsun: logSum(hi.map((m) => m.log_mhi_msun!)),
    earlyTypeFraction: morphology.length ? morphology.filter((m) => m.morphology_t! <= 2).length / morphology.length : null,
    kBandGapMag: bright.length >= 2 ? 2.5 * (bright[0] - bright[1]) : null,
  };
}
