import type { CatalogObject } from "../api/objects.ts";

const COLUMNS = [
  "pgc",
  "name",
  "ra_deg",
  "dec_deg",
  "distance_mpc",
  "v_lg_kms",
  "morphology_t",
  "b_mag",
  "theta1_lv_candidate",
  "md_pgc_lv_candidate",
  "md_name_lv_candidate",
  "environment_coverage",
] as const;
function safeCsv(value: string | number | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(typeof value === "number" ? value : 0)
  )
    return "";
  let str = String(value);
  // Standard spreadsheet formula-injection protection for free-text columns.
  if (typeof value === "string" && /^[=+@-]/.test(str.trimStart()))
    str = "'" + str;
  return `"${str.replace(/"/g, '""')}"`;
}
export function buildAtlasCsv(objects: readonly CatalogObject[]): string {
  const lines = [COLUMNS.join(",")];
  for (const o of objects) {
    lines.push(
      [
        o.pgc,
        o.name,
        o.ra,
        o.dec,
        o.dist,
        o.lvg_v_lg_kms,
        o.morphology_t,
        o.b_mag,
        o.theta1,
        o.md_pgc,
        o.md_name,
        o.environment_coverage,
      ]
        .map(safeCsv)
        .join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
