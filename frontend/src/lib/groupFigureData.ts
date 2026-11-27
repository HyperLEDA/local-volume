import type { GroupDetail, GroupMember } from "../api/groups.ts";
import { buildMwRadialFigures } from "./mwRadialDiagnostics.ts";

export type PlotPoint = {
  x: number;
  y: number;
  pgc?: number;
  name?: string;
  root?: boolean;
  upperLimit?: boolean;
  category?: string;
  xErrorMinus?: number;
  xErrorPlus?: number;
  yErrorMinus?: number;
  yErrorPlus?: number;
};
export type ReferenceLine = {
  axis: "x" | "y";
  at: number;
  style?: "solid" | "dashed";
};
export type GroupFigure = {
  key: string;
  title: string;
  xLabel: string;
  yLabel: string;
  kind: "scatter" | "step" | "histogram";
  points: PlotPoint[];
  csvRows: Record<string, string | number | boolean | null>[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  subtitle: string;
  unavailable?: string;
  binWidth?: number;
  references?: ReferenceLine[];
  /** Optional model/reference lines in the same coordinate system as the observations. */
  lines?: { slope: number; intercept: number; label?: string }[];
  rug?: number[];
};

const DEG = Math.PI / 180;
function finite(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function separationRad(a: GroupMember, b: GroupMember): number | null {
  if (![a.ra, a.dec, b.ra, b.dec].every(finite)) return null;
  const decA = a.dec! * DEG;
  const decB = b.dec! * DEG;
  const dRa = (a.ra! - b.ra!) * DEG;
  const cosPsi =
    Math.sin(decA) * Math.sin(decB) +
    Math.cos(decA) * Math.cos(decB) * Math.cos(dRa);
  return Math.acos(Math.min(1, Math.max(-1, cosPsi)));
}

/** Transverse projected separation at the adopted *host* distance. */
export function projectedKpc(
  host: GroupMember,
  satellite: GroupMember,
): number | null {
  // External-host projected radii are not defined for an internal observer.
  if (host.pgc === 5064336) return null;
  const psi = separationRad(host, satellite);
  if (psi === null || !finite(host.dist_mpc) || host.dist_mpc <= 0) return null;
  return 1000 * host.dist_mpc * Math.sin(psi);
}

/** Excludes velocity-derived and group-assigned distances, which are not independent constraints on depth. */
export function independentDistance(
  method: string | null | undefined,
): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  if (
    /group|member|assum|adopt|host|nam|hubble|kinematic|model|photometric redshift/.test(
      m,
    )
  )
    return false;
  return /trgb|tip of the red giant|cepheid|sbf|surface brightness fluctuation|maser|rr\s*lyrae|tully.fisher|pnlf|eclipsing binary/.test(
    m,
  );
}

function hist(values: readonly number[], width: number): PlotPoint[] {
  if (!values.length || !finite(width) || width <= 0) return [];
  const lo = Math.floor(Math.min(...values) / width) * width;
  const hi = Math.floor(Math.max(...values) / width) * width;
  const n = Math.min(80, Math.max(1, Math.round((hi - lo) / width) + 1));
  const bins = Array.from({ length: n }, (_, k) => ({
    x: lo + (k + 0.5) * width,
    y: 0,
  }));
  for (const value of values)
    bins[Math.max(0, Math.min(n - 1, Math.floor((value - lo) / width)))].y++;
  return bins;
}

function median(sorted: readonly number[]): number | null {
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function count(n: number, total: number): string {
  return `${n} / ${total} satellites with data`;
}
function tablePoint(
  member: GroupMember,
  x: number,
  y: number,
  extra: Record<string, string | number | boolean | null> = {},
): Record<string, string | number | boolean | null> {
  return { pgc: member.pgc, name: member.name, x, y, ...extra };
}
function plotted(member: GroupMember, x: number, y: number): PlotPoint {
  return { pgc: member.pgc, name: member.name, x, y };
}
function distanceErrors(
  member: GroupMember,
): Pick<PlotPoint, "xErrorMinus" | "xErrorPlus"> {
  return finite(member.e_distance_minus_mpc) &&
    finite(member.e_distance_plus_mpc)
    ? {
        xErrorMinus: member.e_distance_minus_mpc,
        xErrorPlus: member.e_distance_plus_mpc,
      }
    : {};
}
function projectedError(
  host: GroupMember,
  rp: number,
): Pick<PlotPoint, "xErrorMinus" | "xErrorPlus"> {
  // Rp = D_MD sin(psi); this error is shared/correlated between satellites.
  if (!(
    finite(host.dist_mpc) &&
    host.dist_mpc > 0 &&
    finite(host.e_distance_minus_mpc) &&
    finite(host.e_distance_plus_mpc)
  ))
    return {};
  return {
    xErrorMinus: (rp * host.e_distance_minus_mpc) / host.dist_mpc,
    xErrorPlus: (rp * host.e_distance_plus_mpc) / host.dist_mpc,
  };
}
function velocityError(
  member: GroupMember,
): Pick<PlotPoint, "yErrorMinus" | "yErrorPlus"> {
  return finite(member.e_v_lg_kms) && member.e_v_lg_kms >= 0
    ? { yErrorMinus: member.e_v_lg_kms, yErrorPlus: member.e_v_lg_kms }
    : {};
}
function differenceError(
  host: GroupMember,
  satellite: GroupMember,
): Pick<PlotPoint, "yErrorMinus" | "yErrorPlus"> {
  if (!(finite(host.e_v_lg_kms) && finite(satellite.e_v_lg_kms))) return {};
  const sigma = Math.hypot(host.e_v_lg_kms, satellite.e_v_lg_kms);
  return { yErrorMinus: sigma, yErrorPlus: sigma };
}
function depthErrors(
  host: GroupMember,
  satellite: GroupMember,
): Pick<PlotPoint, "yErrorMinus" | "yErrorPlus"> {
  if (!(
    finite(host.e_distance_minus_mpc) &&
    finite(host.e_distance_plus_mpc) &&
    finite(satellite.e_distance_minus_mpc) &&
    finite(satellite.e_distance_plus_mpc)
  ))
    return {};
  return {
    yErrorMinus: Math.hypot(
      satellite.e_distance_minus_mpc,
      host.e_distance_plus_mpc,
    ),
    yErrorPlus: Math.hypot(
      satellite.e_distance_plus_mpc,
      host.e_distance_minus_mpc,
    ),
  };
}

export function buildGroupFigures(group: GroupDetail): GroupFigure[] {
  const host = group.members.find((m) => m.pgc === group.root_pgc);
  if (!host) return [];
  const satellites = group.members.filter((m) => m.pgc !== group.root_pgc);
  const total = satellites.length;
  const withRp = satellites.flatMap((member) => {
    const rp = projectedKpc(host, member);
    return rp !== null && finite(rp) && rp >= 0 ? [{ member, rp }] : [];
  });

  const hostVelocity = host.lvg_v_lg_kms;
  const velocities = withRp.flatMap(({ member, rp }) =>
    finite(hostVelocity) && finite(member.lvg_v_lg_kms)
      ? [{ member, rp, dv: member.lvg_v_lg_kms - hostVelocity }]
      : [],
  );

  const velocityDistance = group.members.flatMap((member) =>
    finite(member.dist_mpc) &&
    member.dist_mpc > 0 &&
    finite(member.lvg_v_lg_kms) &&
    independentDistance(member.distance_method)
      ? [{ member, d: member.dist_mpc, v: member.lvg_v_lg_kms }]
      : [],
  );
  const vReference: ReferenceLine[] = [];
  if (finite(host.dist_mpc))
    vReference.push({ axis: "x", at: host.dist_mpc, style: "dashed" });
  if (finite(hostVelocity))
    vReference.push({ axis: "y", at: hostVelocity, style: "dashed" });

  // A non-independent adopted MD distance can be a reference zero-point.
  // Never mislabel the resulting points as independently measured PAIRS.
  const mdDistanceIndependent = independentDistance(host.distance_method);
  const depth = withRp.flatMap(({ member, rp }) =>
    independentDistance(member.distance_method) &&
    finite(host.dist_mpc) &&
    finite(member.dist_mpc)
      ? [{ member, rp, delta: member.dist_mpc - host.dist_mpc }]
      : [],
  );
  const sortedRadii = withRp.map((entry) => entry.rp).sort((a, b) => a - b);
  const radial: PlotPoint[] = [
    { x: 0, y: 0 },
    ...sortedRadii.map((rp, index) => ({ x: rp, y: index + 1 })),
  ];
  const r50 = median(sortedRadii);

  const mags = satellites.flatMap((member) =>
    finite(member.abs_b_mag) ? [{ member, mb: member.abs_b_mag }] : [],
  );
  const magWidth = mags.length < 30 ? 2 : 1;
  const lum = hist(
    mags.map(({ mb }) => mb),
    magWidth,
  );
  const morph = withRp.flatMap(({ member, rp }) =>
    finite(member.morphology_t) ? [{ member, rp, t: member.morphology_t }] : [],
  );

  // M26 is the *dynamical mass inside the corrected Holmberg radius*, not total halo mass or stellar mass.
  const gas = withRp.flatMap(({ member, rp }) =>
    finite(member.log_mhi_msun) && finite(member.log_m26_msun)
      ? [
          {
            member,
            rp,
            logRatio: member.log_mhi_msun - member.log_m26_msun,
            upper: member.hi_mass_is_upper_limit === true,
          },
        ]
      : [],
  );
  const deltaV = velocities.map(({ dv }) => dv);
  const dvWidth =
    deltaV.length < 3
      ? 50
      : Math.max(
          20,
          Math.ceil(
            (Math.max(...deltaV) - Math.min(...deltaV)) /
              Math.min(12, Math.ceil(Math.sqrt(deltaV.length))) /
              10,
          ) * 10,
        );
  const dvBins = hist(deltaV, dvWidth);

  const figures: GroupFigure[] = [
    {
      key: "velocity-distance",
      title: "Velocity–distance diagram",
      xLabel: "D [Mpc]",
      yLabel: "V_LG [km s⁻¹]",
      kind: "scatter",
      references: vReference,
      points: velocityDistance.map(({ member, d, v }) => ({
        ...plotted(member, d, v),
        ...distanceErrors(member),
        ...velocityError(member),
        root: member.pgc === host.pgc,
      })),
      csvRows: velocityDistance.map(({ member, d, v }) =>
        tablePoint(member, d, v, {
          distance_mpc: d,
          v_lg_kms: v,
          distance_method: member.distance_method ?? null,
          is_md: member.pgc === host.pgc,
          e_distance_minus_mpc: member.e_distance_minus_mpc ?? null,
          e_distance_plus_mpc: member.e_distance_plus_mpc ?? null,
          e_v_lg_kms: member.e_v_lg_kms ?? null,
        }),
      ),
      subtitle: `${velocityDistance.length} galaxies with independent distances and V_LG; MD shown by dashed guides`,
    },
    {
      key: "projected-phase-space",
      title: "Projected phase space",
      xLabel: "R_p [kpc]",
      yLabel: "ΔV_LG [km s⁻¹]",
      kind: "scatter",
      references: [{ axis: "y", at: 0 }],
      points: velocities.map(({ member, rp, dv }) => ({
        ...plotted(member, rp, dv),
        ...projectedError(host, rp),
        ...differenceError(host, member),
      })),
      csvRows: velocities.map(({ member, rp, dv }) =>
        tablePoint(member, rp, dv, {
          rp_kpc: rp,
          delta_v_lg_kms: dv,
          e_delta_v_lg_kms: differenceError(host, member).yErrorPlus ?? null,
          e_rp_minus_kpc: projectedError(host, rp).xErrorMinus ?? null,
          e_rp_plus_kpc: projectedError(host, rp).xErrorPlus ?? null,
          velocity_error_basis: member.velocity_error_basis ?? null,
        }),
      ),
      subtitle: count(velocities.length, total),
    },
    {
      key: "group-depth",
      title: "Group depth",
      xLabel: "R_p [kpc]",
      yLabel: "D_sat − D_MD [Mpc]",
      kind: "scatter",
      references: [{ axis: "y", at: 0 }],
      points: depth.map(({ member, rp, delta }) => ({
        ...plotted(member, rp, delta),
        ...projectedError(host, rp),
        ...depthErrors(host, member),
      })),
      csvRows: depth.map(({ member, rp, delta }) =>
        tablePoint(member, rp, delta, {
          rp_kpc: rp,
          delta_d_mpc: delta,
          distance_method: member.distance_method ?? null,
          e_rp_minus_kpc: projectedError(host, rp).xErrorMinus ?? null,
          e_rp_plus_kpc: projectedError(host, rp).xErrorPlus ?? null,
          e_delta_d_minus_mpc: depthErrors(host, member).yErrorMinus ?? null,
          e_delta_d_plus_mpc: depthErrors(host, member).yErrorPlus ?? null,
          e_distance_minus_mpc: member.e_distance_minus_mpc ?? null,
          e_distance_plus_mpc: member.e_distance_plus_mpc ?? null,
        }),
      ),
      subtitle: `${count(depth.length, total)}; independent satellite distances relative to ${mdDistanceIndependent ? "independently measured" : "adopted (not independent)"} MD distance`,
      unavailable: depth.length
        ? undefined
        : "No independently measured satellite distances or adopted MD distance",
    },
    {
      key: "radial-distribution",
      title: "Radial distribution",
      xLabel: "R_p [kpc]",
      yLabel: "N (< R_p)",
      kind: "step",
      references: r50 === null ? [] : [{ axis: "x", at: r50, style: "dashed" }],
      points: radial,
      csvRows: [...withRp]
        .sort((a, b) => a.rp - b.rp)
        .map(({ member, rp }) =>
          tablePoint(member, rp, sortedRadii.filter((r) => r <= rp).length, {
            rp_kpc: rp,
          }),
        ),
      subtitle: `${count(sortedRadii.length, total)}${r50 === null ? "" : `; R50 = ${r50.toFixed(1)} kpc`}`,
      xDomain: [0, Math.max(1, ...sortedRadii) * 1.05],
      yDomain: [0, Math.max(1, sortedRadii.length)],
    },
    {
      key: "luminosity-function",
      title: "Satellite luminosity function",
      xLabel: "M_B [mag]",
      yLabel: `N per ${magWidth} mag`,
      kind: "histogram",
      points: lum,
      binWidth: magWidth,
      csvRows: mags.map(({ member, mb }) =>
        tablePoint(member, mb, 1, {
          abs_b_mag: mb,
          bin_left_mag: Math.floor(mb / magWidth) * magWidth,
          bin_count:
            lum.find(
              (bin) =>
                Math.abs(
                  bin.x - (Math.floor(mb / magWidth) * magWidth + magWidth / 2),
                ) < 1e-8,
            )?.y ?? null,
        }),
      ),
      subtitle: `${count(mags.length, total)}; observed counts, ${magWidth}-mag bins; completeness uncorrected`,
    },
    {
      key: "morphological-segregation",
      title: "Morphological segregation",
      xLabel: "R_p [kpc]",
      yLabel: "Morphological type T",
      kind: "scatter",
      yDomain: [-6, 11],
      points: morph.map(({ member, rp, t }) => ({
        ...plotted(member, rp, t),
        ...projectedError(host, rp),
        category:
          t <= 2
            ? "T ≤ 2"
            : t <= 8
              ? "3 ≤ T ≤ 8"
              : t === 9
                ? "T = 9"
                : "T = 10",
      })),
      csvRows: morph.map(({ member, rp, t }) =>
        tablePoint(member, rp, t, {
          rp_kpc: rp,
          morphological_type: t,
          category:
            t <= 2
              ? "T ≤ 2"
              : t <= 8
                ? "3 ≤ T ≤ 8"
                : t === 9
                  ? "T = 9"
                  : "T = 10",
        }),
      ),
      subtitle: `${count(morph.length, total)}; numeric morphology types (not quenched fractions)`,
    },
    {
      key: "gas-content",
      title: "Gas content (M_HI / M_26)",
      xLabel: "R_p [kpc]",
      yLabel: "log₁₀(M_HI / M_26)",
      kind: "scatter",
      references: [{ axis: "y", at: 0, style: "dashed" }],
      points: gas.map(({ member, rp, logRatio, upper }) => ({
        ...plotted(member, rp, logRatio),
        ...projectedError(host, rp),
        upperLimit: upper,
      })),
      csvRows: gas.map(({ member, rp, logRatio, upper }) =>
        tablePoint(member, rp, logRatio, {
          rp_kpc: rp,
          log_mhi_over_m26: logRatio,
          hi_upper_limit: upper,
          log_mhi_msun: member.log_mhi_msun ?? null,
          log_m26_msun: member.log_m26_msun ?? null,
        }),
      ),
      subtitle: `${count(gas.length, total)}; ${gas.filter(({ upper }) => upper).length} HI upper limits; M26 within Holmberg radius`,
      unavailable: gas.length
        ? undefined
        : "No paired H I and Holmberg-radius dynamical mass measurements",
    },
    {
      key: "velocity-distribution",
      title: "Velocity distribution",
      xLabel: "ΔV_LG [km s⁻¹]",
      yLabel: "N per bin",
      kind: "histogram",
      binWidth: dvWidth,
      references: [{ axis: "x", at: 0, style: "dashed" }],
      points: dvBins,
      rug: deltaV,
      csvRows: velocities.map(({ member, dv }) =>
        tablePoint(member, dv, 1, {
          delta_v_lg_kms: dv,
          bin_left_kms: Math.floor(dv / dvWidth) * dvWidth,
          bin_count:
            dvBins.find(
              (bin) =>
                Math.abs(
                  bin.x - (Math.floor(dv / dvWidth) * dvWidth + dvWidth / 2),
                ) < 1e-8,
            )?.y ?? null,
        }),
      ),
      subtitle: `${count(deltaV.length, total)}; ${dvWidth} km s⁻¹ bins; Poisson count errors`,
    },
  ];
  // MW is an internal-observer system; retain native observational plots and
  // replace external projected diagnostics with actual centre-relative radii.
  return host.pgc === 5064336
    ? [
        ...figures.filter(
          (figure) =>
            figure.key === "velocity-distance" ||
            figure.key === "luminosity-function",
        ),
        ...buildMwRadialFigures(group),
      ]
    : figures;
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const plain = String(value);
  // CSV formula-injection protection for spreadsheet applications.
  const safe =
    /^[\s]*[=+@\-\t\r]/.test(plain) && typeof value === "string"
      ? `'${plain}`
      : plain;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function groupFigureCsv(figure: GroupFigure): string {
  const fields = [
    ...new Set(figure.csvRows.flatMap((row) => Object.keys(row))),
  ];
  if (!fields.length) return "pgc,name,x,y\r\n";
  return (
    [
      fields.join(","),
      ...figure.csvRows.map((row) =>
        fields.map((field) => csvCell(row[field] ?? null)).join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}
