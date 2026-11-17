/** Display errors adopted by the physical refresh alongside the corresponding
 * observed distance/velocity. Never match uncertainty to a different value. */
export type AdoptedPhysicalErrorSource = {
  physical_status?: string;
  distance_mpc?: number | null;
  e_distance_minus_mpc?: number | null;
  e_distance_plus_mpc?: number | null;
  v_lg_kms?: number | null;
  e_v_lg_kms?: number | null;
  distance_error_basis?: string | null;
  velocity_error_basis?: string | null;
};

export type CompactUncertainty =
  | { kind: "symmetric"; sigma: string }
  | { kind: "asymmetric"; plus: string; minus: string };

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** An observed cell is rounded for display; allow at most half its last unit. */
function agreesWithDisplayedValue(displayed: string, adopted: number | null | undefined): boolean {
  if (typeof adopted !== "number" || !Number.isFinite(adopted)) return false;
  const text = displayed.trim().replace(/\u2212/g, "-");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return false;
  const decimals = text.split(".")[1]?.length ?? 0;
  const tolerance = Math.pow(10, -decimals) / 2 + 1e-7;
  return Math.abs(Number(text) - adopted) <= tolerance;
}

function twoSignificant(value: number): string {
  return value.toPrecision(2);
}

function compactPair(plus: number, minus: number): CompactUncertainty {
  const hi = twoSignificant(plus);
  const lo = twoSignificant(minus);
  return hi === lo
    ? { kind: "symmetric", sigma: hi }
    : { kind: "asymmetric", plus: hi, minus: lo };
}

/** Match by BOTH quantity and adopted value, not merely by PGC.
 * A missing/stale physical generation never supplies an observed error. */
export function observedUncertainty(
  row: { name: string; value: string },
  physical: AdoptedPhysicalErrorSource | null,
): CompactUncertainty | null {
  if (!physical || physical.physical_status !== "ready") return null;
  if (row.name === "dist") {
    if (!agreesWithDisplayedValue(row.value, physical.distance_mpc)) return null;
    const plus = physical.e_distance_plus_mpc;
    const minus = physical.e_distance_minus_mpc;
    return finitePositive(plus) && finitePositive(minus) ? compactPair(plus, minus) : null;
  }
  if (row.name === "lvg_v_lg_kms") {
    if (!agreesWithDisplayedValue(row.value, physical.v_lg_kms)) return null;
    const sigma = physical.e_v_lg_kms;
    return finitePositive(sigma) ? { kind: "symmetric", sigma: twoSignificant(sigma) } : null;
  }
  return null;
}
