import type { ParameterRow } from "../api/objects.ts";

export type ObservedGroup =
  | "Geometry"
  | "Morphology"
  | "Photometry"
  | "Kinematics"
  | "Distance"
  | "H I";

export type ParameterDefinition = {
  group: ObservedGroup;
  label: string;
  description?: string;
};

/** Display-only names: physical values and database metadata are not modified. */
export const PARAMETER_DEFINITIONS: Readonly<Record<string, ParameterDefinition>> = {
  a26_arcmin: { group: "Geometry", label: "Holmberg diameter a<sub>26</sub>" },
  axis_ratio: { group: "Geometry", label: "Axis ratio b/a" },
  morphology_t: { group: "Morphology", label: "Morphological type T" },
  dwarf_morphology: { group: "Morphology", label: "Dwarf morphology" },
  dwarf_sb_class: { group: "Morphology", label: "Surface-brightness class" },
  b_mag: { group: "Photometry", label: "B magnitude" },
  ks_mag: { group: "Photometry", label: "K<sub>s</sub> magnitude" },
  a_b_galactic_mag: { group: "Photometry", label: "Galactic extinction A<sub>B</sub>" },
  ha_mag: { group: "Photometry", label: "Hα magnitude" },
  fuv_mag: { group: "Photometry", label: "FUV magnitude" },
  ks_estimated: { group: "Photometry", label: "K<sub>s</sub> estimated" },
  ha_limit: { group: "Photometry", label: "Hα limit qualifier" },
  fuv_limit: { group: "Photometry", label: "FUV limit qualifier" },
  lvg_v_hel_kms: { group: "Kinematics", label: "Heliocentric velocity V<sub>hel</sub>" },
  lvg_v_lg_kms: { group: "Kinematics", label: "Local Group velocity V<sub>LG</sub>" },
  mu: { group: "Distance", label: "Distance modulus μ" },
  dist: { group: "Distance", label: "Distance D" },
  distance_method: { group: "Distance", label: "Distance method" },
  hi21_mag: { group: "H I", label: "21-cm magnitude m<sub>21</sub>" },
  hi21_limit: { group: "H I", label: "21-cm limit qualifier" },
  w50_kms: { group: "H I", label: "H I linewidth W<sub>50</sub>" },
};

/** Database and API fields remain available, but are not scientific display tiles. */
const NOT_OBSERVED = new Set([
  "pgc", "name", "names", "type_name", "ra", "e_ra", "dec", "e_dec",
  "source_catalog", "source_name", "lvg_source_catalog", "lvg_source_name",
  "distance_reference", "modulus_method",
  "fuv_limit", "ha_limit", "hi21_limit", // Measurement modifiers, never standalone cells.
]);

export const GROUP_ORDER: readonly ObservedGroup[] = [
  "Geometry", "Morphology", "Photometry", "Kinematics", "Distance", "H I",
];

/** Explicit, stable scientific order (independent of API/schema column order). */
export const PARAMETER_ORDER: Readonly<Record<ObservedGroup, readonly string[]>> = {
  Geometry: ["a26_arcmin", "axis_ratio"],
  Morphology: ["morphology_t", "dwarf_morphology", "dwarf_sb_class"],
  Photometry: [
    "b_mag", "ks_mag", "a_b_galactic_mag", "ha_mag", "fuv_mag",
    "ks_estimated", "ha_limit", "fuv_limit",
  ],
  Kinematics: ["lvg_v_hel_kms", "lvg_v_lg_kms"],
  Distance: ["mu", "dist", "distance_method"],
  "H I": ["hi21_mag", "hi21_limit", "w50_kms"],
};

export type DisplayParameter = ParameterRow & { displayLabel: string };
export type DisplayParameterGroup = { title: string; rows: DisplayParameter[] };

const FIELD_POSITION = new Map<string, number>(
  GROUP_ORDER.flatMap((group) => PARAMETER_ORDER[group]).map((key, index) => [key, index]),
);

function humanize(name: string): string {
  return name.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** Source qualifiers belong to the measurement, not to separate table cells. */
function withMagnitudeQualifier(
  name: string,
  value: string,
  limits: Readonly<Record<string, string>>,
): string {
  const qualifier = limits[name] ?? "";
  if (!qualifier || !value.trim()) return value;
  // LVGDB 21-cm source for the Milky Way has "-03.40": the dash is a minus sign.
  if (qualifier === "-") return value.startsWith("-") ? value : `-${value}`;
  return `${qualifier} ${value}`;
}

/** Preserve newly introduced fields in Other instead of silently hiding science data. */
export function groupObservedParameters(rows: ParameterRow[]): DisplayParameterGroup[] {
  const groups = GROUP_ORDER.map((title) => ({ title, rows: [] as DisplayParameter[] }));
  const byTitle = new Map(groups.map((group) => [group.title, group]));
  const other: DisplayParameterGroup = { title: "Other", rows: [] };
  const limits: Readonly<Record<string, string>> = {
    fuv_mag: rows.find((row) => row.name === "fuv_limit")?.value.trim() ?? "",
    ha_mag: rows.find((row) => row.name === "ha_limit")?.value.trim() ?? "",
    hi21_mag: rows.find((row) => row.name === "hi21_limit")?.value.trim() ?? "",
  };

  for (const row of rows) {
    if (NOT_OBSERVED.has(row.name) || !row.value.trim()) continue;
    const definition = PARAMETER_DEFINITIONS[row.name];
    const group = definition ? byTitle.get(definition.group) : other;
    if (!group) continue;
    group.rows.push({
      ...row,
      displayLabel: definition?.label ?? row.nice ?? humanize(row.name),
      value: withMagnitudeQualifier(row.name, row.value, limits),
    });
  }

  for (const group of groups) {
    group.rows.sort((a, b) =>
      (FIELD_POSITION.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
      (FIELD_POSITION.get(b.name) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return [...groups.filter((group) => group.rows.length > 0), ...(other.rows.length ? [other] : [])];
}
