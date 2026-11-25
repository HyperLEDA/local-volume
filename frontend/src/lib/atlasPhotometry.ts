export type AtlasKsStatus = "measured" | "estimated" | "unavailable";
export type AtlasHiStatus = "detection" | "upper_limit" | "unavailable";
export type AtlasPhotometryRow = {
  pgc: number;
  log_lks_lsun: number | null;
  ks_status: AtlasKsStatus;
  ks_method: string | null;
  log_mhi_msun: number | null;
  hi_status: AtlasHiStatus;
};
export type AtlasPhotometry = {
  revision: number;
  formulaVersion: string;
  rows: ReadonlyMap<number, AtlasPhotometryRow>;
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finiteOrNull(value: unknown): value is number | null {
  return (
    value === null || (typeof value === "number" && Number.isFinite(value))
  );
}
function positivePgc(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
export function parseAtlasPhotometry(payload: unknown): AtlasPhotometry {
  if (!record(payload) || !record(payload.data))
    throw new Error("Invalid spatial photometry response");
  const data = payload.data;
  if (
    data.contract !== "spatial_photometry_v1" ||
    typeof data.revision !== "number" ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    typeof data.formula_version !== "string" ||
    !data.formula_version ||
    !Array.isArray(data.rows)
  )
    throw new Error("Unknown spatial photometry contract");
  const rows = new Map<number, AtlasPhotometryRow>();
  const entries: unknown[] = data.rows;
  for (const row of entries) {
    if (
      !record(row) ||
      !positivePgc(row.pgc) ||
      rows.has(row.pgc) ||
      !finiteOrNull(row.log_lks_lsun) ||
      !finiteOrNull(row.log_mhi_msun) ||
      (row.ks_status !== "measured" &&
        row.ks_status !== "estimated" &&
        row.ks_status !== "unavailable") ||
      (row.hi_status !== "detection" &&
        row.hi_status !== "upper_limit" &&
        row.hi_status !== "unavailable") ||
      (row.ks_method !== null && typeof row.ks_method !== "string") ||
      (row.log_lks_lsun === null) !== (row.ks_status === "unavailable") ||
      (row.log_mhi_msun === null) !== (row.hi_status === "unavailable") ||
      (row.log_lks_lsun !== null && !row.ks_method)
    )
      throw new Error("Inconsistent spatial photometry row");
    rows.set(row.pgc, {
      pgc: row.pgc,
      log_lks_lsun: row.log_lks_lsun,
      ks_status: row.ks_status,
      ks_method: row.ks_method,
      log_mhi_msun: row.log_mhi_msun,
      hi_status: row.hi_status,
    });
  }
  if (!rows.size) throw new Error("Empty spatial photometry snapshot");
  return {
    revision: data.revision,
    formulaVersion: data.formula_version,
    rows,
  };
}
export async function fetchAtlasPhotometry(): Promise<AtlasPhotometry> {
  const response = await fetch("/api/v1/spatial/photometry", {
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Spatial photometry unavailable (${response.status})`);
  const payload: unknown = await response.json();
  return parseAtlasPhotometry(payload);
}
