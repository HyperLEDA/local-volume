import type { CatalogObject } from "../api/objects.ts";

/** All export formats use one ordered, source-native row model. */
export const ATLAS_EXPORT_COLUMNS = [
  {
    key: "pgc",
    type: "number",
    description: "Canonical PGC identifier",
    unit: null,
  },
  { key: "name", type: "string", description: "Object name", unit: null },
  {
    key: "ra_deg",
    type: "number",
    description: "ICRS right ascension",
    unit: "deg",
  },
  {
    key: "dec_deg",
    type: "number",
    description: "ICRS declination",
    unit: "deg",
  },
  {
    key: "distance_mpc",
    type: "number",
    description: "Adopted distance",
    unit: "Mpc",
  },
  {
    key: "v_lg_kms",
    type: "number",
    description: "Local Group frame radial velocity",
    unit: "km/s",
  },
  {
    key: "morphology_t",
    type: "number",
    description: "Morphological T type",
    unit: null,
  },
  {
    key: "b_mag",
    type: "number",
    description: "B-band magnitude",
    unit: "mag",
  },
  {
    key: "theta1_lv_candidate",
    type: "number",
    description: "Provisional LV tidal index; incomplete donor census",
    unit: null,
  },
  {
    key: "md_pgc_lv_candidate",
    type: "number",
    description: "Provisional main disturber PGC",
    unit: null,
  },
  {
    key: "md_name_lv_candidate",
    type: "string",
    description: "Provisional main disturber name",
    unit: null,
  },
  {
    key: "environment_coverage",
    type: "string",
    description: "Tidal environment coverage qualifier",
    unit: null,
  },
  {
    key: "v_hel_kms",
    type: "number",
    description: "Source-native heliocentric radial velocity",
    unit: "km/s",
  },
  {
    key: "hi21_mag",
    type: "number",
    description: "21 cm H I magnitude; see hi21_limit for censoring",
    unit: "mag",
  },
  {
    key: "hi21_limit",
    type: "string",
    description: "H I censoring/upper-limit qualifier; never a detection flag",
    unit: null,
  },
  {
    key: "distance_method",
    type: "string",
    description: "Source-native adopted distance method",
    unit: null,
  },
] as const;

export type AtlasExportFormat = "csv" | "tsv" | "json";
export type AtlasExportMetadata = Record<string, unknown>;
type AtlasCell = string | number | null;
export type AtlasExportRow = Record<
  (typeof ATLAS_EXPORT_COLUMNS)[number]["key"],
  AtlasCell
>;

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textOrNull(value: string | null | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function atlasExportRows(
  objects: readonly CatalogObject[],
): AtlasExportRow[] {
  return objects.map((object) => ({
    pgc: object.pgc,
    name: object.name,
    ra_deg: finiteNumber(object.ra),
    dec_deg: finiteNumber(object.dec),
    distance_mpc: finiteNumber(object.dist),
    v_lg_kms: finiteNumber(object.lvg_v_lg_kms),
    morphology_t: finiteNumber(object.morphology_t),
    b_mag: finiteNumber(object.b_mag),
    theta1_lv_candidate: finiteNumber(object.theta1),
    md_pgc_lv_candidate: finiteNumber(object.md_pgc),
    md_name_lv_candidate: textOrNull(object.md_name),
    environment_coverage: textOrNull(object.environment_coverage),
    v_hel_kms: finiteNumber(object.lvg_v_hel_kms),
    hi21_mag: finiteNumber(object.hi21_mag),
    hi21_limit: textOrNull(object.hi21_limit),
    distance_method: textOrNull(object.distance_method),
  }));
}

function spreadsheetSafe(value: AtlasCell): string {
  if (value === null) return "";
  const raw = String(value);
  // CSV/TSV must not let an object name become a spreadsheet formula.
  return typeof value === "string" && /^[=+@-]/.test(raw.trimStart())
    ? "'" + raw
    : raw;
}

function delimitedCell(value: AtlasCell, separator: string): string {
  // Preserve legacy CSV/TSV nulls as truly empty cells, not quoted empty strings.
  if (value === null) return "";
  const content = spreadsheetSafe(value);
  if (separator === ",") return `"${content.replace(/"/g, '""')}"`;
  // Preserve text literally via RFC-style quotes when tabs/newlines occur.
  return /[\t\r\n"]/.test(content)
    ? `"${content.replace(/"/g, '""')}"`
    : content;
}

function buildDelimited(
  objects: readonly CatalogObject[],
  separator: string,
): string {
  const rows = [
    ATLAS_EXPORT_COLUMNS.map((column) => column.key).join(separator),
  ];
  for (const record of atlasExportRows(objects)) {
    rows.push(
      ATLAS_EXPORT_COLUMNS.map((column) =>
        delimitedCell(record[column.key], separator),
      ).join(separator),
    );
  }
  // Existing CSV convention: UTF-8 BOM and CRLF for spreadsheet compatibility.
  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}

export function buildAtlasCsv(objects: readonly CatalogObject[]): string {
  return buildDelimited(objects, ",");
}

export function buildAtlasTsv(objects: readonly CatalogObject[]): string {
  return buildDelimited(objects, "\t");
}

export function buildAtlasJson(
  objects: readonly CatalogObject[],
  metadata: AtlasExportMetadata,
): string {
  return `${JSON.stringify(
    {
      schema: "LV-atlas-export-v2",
      metadata,
      columns: ATLAS_EXPORT_COLUMNS,
      rows: atlasExportRows(objects),
    },
    null,
    2,
  )}\n`;
}
