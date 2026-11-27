import type { GroupDetail, GroupMember } from "../api/groups.ts";
import type { GroupFigure, PlotPoint } from "./groupFigureData.ts";

const MW = 5064336;
const RAD = Math.PI / 180;
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function position(
  member: GroupMember,
): readonly [number, number, number] | null {
  const { ra, dec, dist_mpc: d } = member;
  if (
    !finite(ra) ||
    ra < 0 ||
    ra >= 360 ||
    !finite(dec) ||
    Math.abs(dec) > 90 ||
    !finite(d) ||
    d <= 0
  )
    return null;
  const a = ra * RAD,
    b = dec * RAD;
  return [
    d * Math.cos(b) * Math.cos(a),
    d * Math.cos(b) * Math.sin(a),
    d * Math.sin(b),
  ];
}

export type MwRadialEntry = { member: GroupMember; radiusKpc: number };

/** Nominal centre-relative radii from source-paired individual distances.
 * The adopted MW centre need not pass the extragalactic verification gate.
 * No synthetic positions, angular projection or inferred velocities are used.
 */
export function mwRadialSample(group: GroupDetail): MwRadialEntry[] {
  if (
    group.root_pgc !== MW ||
    new Set(group.members.map((m) => m.pgc)).size !== group.members.length
  )
    return [];
  const roots = group.members.filter((m) => m.membership_status === "root");
  const host = roots[0];
  if (
    roots.length !== 1 ||
    host.pgc !== MW ||
    host.group_id !== group.group_id ||
    host.distance_origin === "GROUP_ASSIGNED" ||
    host.distance_origin === "MODEL_INFERRED"
  )
    return [];
  const c = position(host);
  if (!c) return [];
  const result: MwRadialEntry[] = [];
  for (const member of group.members) {
    if (
      member.pgc === MW ||
      !Number.isSafeInteger(member.pgc) ||
      member.pgc <= 0 ||
      member.group_id !== host.group_id ||
      !["computed", "supported"].includes(member.membership_status) ||
      member.distance_origin !== "DIRECT_MEASURED" ||
      member.distance_lineage_status !== "REVIEW_READY" ||
      !["VERIFIED", "NOT_REVIEWED"].includes(
        member.distance_value_review_status ?? "",
      )
    )
      continue;
    const p = position(member);
    if (!p) continue;
    const radiusKpc = 1000 * Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
    if (finite(radiusKpc)) result.push({ member, radiusKpc });
  }
  return result.sort(
    (a, b) => a.radiusKpc - b.radiusKpc || a.member.pgc - b.member.pgc,
  );
}

export function mwRadialSummary(sample: readonly MwRadialEntry[]) {
  const radii = sample.map((p) => p.radiusKpc).sort((a, b) => a - b);
  const n = radii.length;
  const mid = Math.floor(n / 2);
  return {
    n,
    maxKpc: n ? radii[n - 1] : null,
    meanKpc: n ? radii.reduce((a, b) => a + b, 0) / n : null,
    medianKpc: n
      ? n % 2
        ? radii[mid]
        : (radii[mid - 1] + radii[mid]) / 2
      : null,
  };
}

export function buildMwRadialFigures(group: GroupDetail): GroupFigure[] {
  if (group.root_pgc !== MW) return [];
  const sample = mwRadialSample(group);
  const host = group.members.find((m) => m.pgc === MW);
  const summary = mwRadialSummary(sample);
  const total = group.members.filter((m) => m.pgc !== MW).length;
  const provenance = `${summary.n} of ${total} satellites with traceable individual distances; nominal adopted MW centre; no completeness or uncertainty correction`;
  const label = "Galactocentric radius [kpc]";
  function row({ member, radiusKpc }: MwRadialEntry, y: number) {
    return {
      pgc: member.pgc,
      name: member.name,
      x: radiusKpc,
      y,
      galactocentric_radius_kpc: radiusKpc,
      ra_deg: member.ra,
      dec_deg: member.dec,
      distance_mpc: member.dist_mpc,
      distance_method: member.distance_method_for_value ?? null,
      distance_reference: member.distance_reference_for_value ?? null,
      distance_value_review_status: member.distance_value_review_status ?? null,
      mw_ra_deg: host?.ra ?? null,
      mw_dec_deg: host?.dec ?? null,
      mw_distance_mpc: host?.dist_mpc ?? null,
      mw_distance_reference: host?.distance_reference_for_value ?? null,
    };
  }
  const radial: PlotPoint[] = sample.length ? [{ x: 0, y: 0 }] : [];
  const radialRows = sample.map((entry) => {
    const n = sample.filter((p) => p.radiusKpc <= entry.radiusKpc).length;
    if (
      radial[radial.length - 1]?.x !== entry.radiusKpc ||
      radial[radial.length - 1]?.y !== n
    )
      radial.push({ x: entry.radiusKpc, y: n });
    return { ...row(entry, n), cumulative_count: n };
  });
  const morph = sample.flatMap((entry) => {
    const t = entry.member.morphology_t;
    return finite(t) && t >= -6 && t <= 10 ? [{ entry, t }] : [];
  });
  const gas = sample.flatMap((entry) => {
    const hi = entry.member.log_mhi_msun,
      dyn = entry.member.log_m26_msun;
    return finite(hi) && finite(dyn) && finite(hi - dyn)
      ? [
          {
            entry,
            ratio: hi - dyn,
            upper: entry.member.hi_mass_is_upper_limit === true,
          },
        ]
      : [];
  });
  return [
    {
      key: "mw-radial-distribution",
      title: "Galactocentric radial distribution",
      xLabel: label,
      yLabel: "Cumulative satellite count",
      kind: "step",
      points: radial,
      csvRows: radialRows,
      subtitle: provenance,
      references:
        summary.medianKpc === null
          ? []
          : [{ axis: "x", at: summary.medianKpc, style: "dashed" }],
      xDomain: [0, Math.max(1, summary.maxKpc ?? 0) * 1.05],
      yDomain: [0, Math.max(1, summary.n)],
      unavailable: sample.length
        ? undefined
        : "No eligible individual satellite distances",
    },
    {
      key: "mw-morphology-radius",
      title: "Morphology vs Galactocentric radius",
      xLabel: label,
      yLabel: "Morphological type T",
      kind: "scatter",
      yDomain: [-6, 11],
      points: morph.map(({ entry, t }) => ({
        x: entry.radiusKpc,
        y: t,
        pgc: entry.member.pgc,
        name: entry.member.name,
        category:
          t <= 2
            ? "T ≤ 2"
            : t <= 8
              ? "3 ≤ T ≤ 8"
              : t === 9
                ? "T = 9"
                : "T = 10",
      })),
      csvRows: morph.map(({ entry, t }) => ({
        ...row(entry, t),
        morphological_type: t,
      })),
      subtitle: `${morph.length} classified satellites; ${provenance}`,
      unavailable: morph.length
        ? undefined
        : "No eligible satellite morphology and distance pairs",
    },
    {
      key: "mw-gas-radius",
      title: "Gas content (M_HI / M_26) vs Galactocentric radius",
      xLabel: label,
      yLabel: "log₁₀(M_HI / M_26)",
      kind: "scatter",
      references: [{ axis: "y", at: 0, style: "dashed" }],
      points: gas.map(({ entry, ratio, upper }) => ({
        x: entry.radiusKpc,
        y: ratio,
        pgc: entry.member.pgc,
        name: entry.member.name,
        upperLimit: upper,
      })),
      csvRows: gas.map(({ entry, ratio, upper }) => ({
        ...row(entry, ratio),
        log_mhi_over_m26: ratio,
        hi_upper_limit: upper,
        log_mhi_msun: entry.member.log_mhi_msun ?? null,
        log_m26_msun: entry.member.log_m26_msun ?? null,
      })),
      subtitle: `${gas.length} mass pairs; ${gas.filter((p) => p.upper).length} H I upper limits; M26 within Holmberg radius; ${provenance}`,
      unavailable: gas.length
        ? undefined
        : "No eligible satellite H I and M26 mass pairs",
    },
  ];
}
