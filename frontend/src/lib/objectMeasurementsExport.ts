import type {
  CatalogObjectDetail,
  ParameterRow,
} from "../api/objects.ts";
import { observedUncertainty } from "./observedUncertainty.ts";
import type { AdoptedPhysicalErrorSource } from "./observedUncertainty.ts";

/** Values are taken from the already loaded object API, not reconstituted
 * from typography. No measurement-level provenance is asserted here. */
export type ExportedMeasurement = {
  pgc: number;
  object_name: string;
  section: "observed" | "physical";
  field: string;
  label: string;
  raw_value: number | string | boolean | null;
  display_value: string | null;
  unit: string | null;
  raw_uncertainty: number | string | null;
  raw_uncertainty_minus: number | null;
  raw_uncertainty_plus: number | null;
  display_uncertainty: string | null;
  uncertainty_basis: string | null;
  uncertainty_unit: string | null;
  qualifier: string | null;
  raw_missing: boolean;
  status: "adopted_observed" | "estimated" | "derived";
  measurement_source: null;
};

type PhysicalValue = string | number | boolean | null | undefined;
type PhysicalData = Record<string, PhysicalValue>;

type Field = {
  key: string;
  label: string;
  unit: string | null;
  decimals?: number;
  limitFlag?: string;
  limitValue?: string | boolean;
};

// These are precisely the fields rendered by PhysicalParametersTable.
// Keep this list synchronized when adding/removing displayed physical cells.
const PHYSICAL_FIELDS: readonly Field[] = [
  { key: "a26_kpc", label: "a26", unit: "kpc", decimals: 2 },
  { key: "inclination_deg", label: "i", unit: "deg", decimals: 1 },
  { key: "vrot_kms", label: "V_m", unit: "km/s", decimals: 1 },
  { key: "abs_b_mag", label: "M_B", unit: "mag", decimals: 2 },
  { key: "abs_ks_mag", label: "M_K", unit: "mag", decimals: 2 },
  { key: "log_lks_lsun", label: "log(L_K/L_Ksun)", unit: null, decimals: 2 },
  { key: "mean_sb_b_mag_arcsec2", label: "<mu_B>", unit: "mag/arcsec2", decimals: 2 },
  { key: "log_m26_msun", label: "log(M_dyn/Msun)", unit: null, decimals: 2 },
  { key: "log_mhi_msun", label: "log(M_HI/Msun)", unit: null, decimals: 2, limitFlag: "log_mhi_limit_flag", limitValue: "<" },
  { key: "log_sfr_halpha_msun_yr", label: "log(SFR_Halpha/Msun/yr)", unit: null, decimals: 2, limitFlag: "log_sfr_halpha_upper_limit", limitValue: true },
  { key: "log_sfr_fuv_msun_yr", label: "log(SFR_FUV/Msun/yr)", unit: null, decimals: 2, limitFlag: "log_sfr_fuv_upper_limit", limitValue: true },
  { key: "md_name", label: "MD", unit: null },
  { key: "theta1", label: "Theta_1", unit: null, decimals: 2 },
  { key: "theta5", label: "Theta_5", unit: null, decimals: 2 },
  { key: "thetaj", label: "Theta_j", unit: null, decimals: 2 },
];

const OBSERVED_LIMIT_FLAG: Readonly<Record<string, string>> = {
  fuv_mag: "fuv_limit",
  ha_mag: "ha_limit",
  hi21_mag: "hi21_limit",
};

function rawValue(value: unknown): number | string | boolean | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" || typeof value === "boolean"
      ? value
      : null;
}

function physicalDisplay(value: number | string | boolean | null, decimals?: number): string | null {
  if (value === null) return null;
  if (decimals === undefined) return String(value);
  const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return String(value);
  const rounded = Number(numeric.toFixed(decimals));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function hasValue(value: number | string | boolean | null): boolean {
  return value !== null && (typeof value !== "string" || value.trim() !== "");
}

export type GalaxyExportDocument = {
  format: "LVLEDA.object-measurements.v1";
  pgc: number;
  object_name: string;
  physical_status: string;
  measurement_provenance_note: string;
  measurements: ExportedMeasurement[];
};

export function buildGalaxyExport(
  galaxy: CatalogObjectDetail,
  observed: readonly ParameterRow[],
  physical: PhysicalData | null,
): GalaxyExportDocument {
  const record = galaxy as unknown as Record<string, unknown>;
  const estimatedKs = record.ks_estimated === true || record.ks_estimated === "true";
  const physicalErrors = physical as unknown as AdoptedPhysicalErrorSource | null;
  const measurements: ExportedMeasurement[] = observed
    .filter((row) => row.name !== "ks_estimated" && row.name !== "fuv_limit" && row.name !== "ha_limit" && row.name !== "hi21_limit")
    .map((row) => {
      const value = rawValue(record[row.name]);
      const errKey = row.name === "lvg_v_hel_kms" ? "lvg_e_v_hel_kms" : `e_${row.name}`;
      const err = rawValue(record[errKey]);
      const qualifierName = OBSERVED_LIMIT_FLAG[row.name];
      const flag = qualifierName ? rawValue(record[qualifierName]) : null;
      const estimated = row.name === "ks_mag" && estimatedKs;
      // The UI may display distance / V_LG uncertainties adopted by the
      // physical refresh. Reuse its strict value-matching guard; never attach
      // an error from a different measurement or a pending generation.
      const adoptedError = observedUncertainty(row, physicalErrors);
      const physicallyMatched = adoptedError !== null && physical?.physical_status === "ready";
      const plus = physicallyMatched && row.name === "dist" ? rawValue(physical.e_distance_plus_mpc) : null;
      const minus = physicallyMatched && row.name === "dist" ? rawValue(physical.e_distance_minus_mpc) : null;
      const physicalSymmetric = physicallyMatched && row.name === "lvg_v_lg_kms"
        ? rawValue(physical.e_v_lg_kms) : null;
      const extraUncertainty = adoptedError === null ? null : adoptedError.kind === "symmetric"
        ? `± ${adoptedError.sigma}` : `+${adoptedError.plus} / −${adoptedError.minus}`;
      const uncertaintyBasis = physicallyMatched && row.name === "dist"
        ? rawValue(physical.distance_error_basis)
        : physicallyMatched && row.name === "lvg_v_lg_kms"
          ? rawValue(physical.velocity_error_basis)
          : null;
      return {
        pgc: galaxy.pgc,
        object_name: galaxy.name,
        section: "observed" as const,
        field: row.name,
        label: row.nice ?? row.name,
        raw_value: value,
        display_value: row.value.trim() || null,
        unit: row.unit,
        raw_uncertainty: estimated ? null : (typeof err === "boolean" ? null : (err ?? (typeof physicalSymmetric === "number" ? physicalSymmetric : null))),
        raw_uncertainty_minus: typeof minus === "number" ? minus : null,
        raw_uncertainty_plus: typeof plus === "number" ? plus : null,
        display_uncertainty: estimated ? null : (extraUncertainty ?? row.error ?? null),
        uncertainty_basis: typeof uncertaintyBasis === "string" ? uncertaintyBasis : null,
        uncertainty_unit: row.errorUnit ?? row.unit,
        qualifier: flag === null ? null : String(flag),
        raw_missing: !hasValue(value),
        status: estimated ? "estimated" as const : "adopted_observed" as const,
        measurement_source: null,
      };
    });

  const ready = physical?.physical_status === "ready";
  for (const field of PHYSICAL_FIELDS) {
    const value = ready ? rawValue(physical[field.key]) : null;
    const flag = ready && field.limitFlag ? physical[field.limitFlag] : null;
    const qualifier = flag === field.limitValue ? "<" : null;
    measurements.push({
      pgc: galaxy.pgc,
      object_name: galaxy.name,
      section: "physical",
      field: field.key,
      label: field.label,
      raw_value: value,
      display_value: value === null ? null : (qualifier ? `${qualifier} ${physicalDisplay(value, field.decimals)}` : physicalDisplay(value, field.decimals)),
      unit: field.unit,
      raw_uncertainty: null,
      raw_uncertainty_minus: null,
      raw_uncertainty_plus: null,
      display_uncertainty: null,
      uncertainty_basis: null,
      uncertainty_unit: null,
      qualifier,
      raw_missing: !hasValue(value),
      status: "derived",
      measurement_source: null,
    });
  }
  return {
    format: "LVLEDA.object-measurements.v1",
    pgc: galaxy.pgc,
    object_name: galaxy.name,
    physical_status: String(physical?.physical_status ?? "unavailable"),
    measurement_provenance_note: "Measurement-level source references are not exposed by this API; null means unavailable, not that a value is source-free.",
    measurements,
  };
}

const CSV_COLUMNS: readonly (keyof ExportedMeasurement)[] = [
  "pgc", "object_name", "section", "field", "label", "raw_value",
  "display_value", "unit", "raw_uncertainty", "raw_uncertainty_minus", "raw_uncertainty_plus",
  "display_uncertainty", "uncertainty_basis", "uncertainty_unit", "qualifier", "raw_missing", "status", "measurement_source",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function galaxyExportCsv(doc: GalaxyExportDocument): string {
  const header = CSV_COLUMNS.join(",");
  const lines = doc.measurements.map((measurement) =>
    CSV_COLUMNS.map((field) => csvCell(measurement[field])).join(","),
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

export function galaxyExportJson(doc: GalaxyExportDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}
