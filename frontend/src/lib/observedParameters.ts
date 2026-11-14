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

/** Display names are frontend fallbacks; catalog values and schema remain untouched. */
export const PARAMETER_DEFINITIONS: Readonly<Record<string, ParameterDefinition>> = {
  a26_arcmin: {
    group: "Geometry",
    label: "Holmberg diameter a<sub>26</sub>",
  },
  axis_ratio: { group: "Geometry", label: "Axis ratio b/a" },
  morphology_t: { group: "Morphology", label: "Morphological type T" },
  dwarf_morphology: { group: "Morphology", label: "Dwarf morphology" },
  dwarf_sb_class: {
    group: "Morphology",
    label: "Surface-brightness class",
  },
  a_b_galactic_mag: {
    group: "Photometry",
    label: "Galactic extinction A<sub>B</sub>",
  },
  fuv_mag: { group: "Photometry", label: "FUV magnitude" },
  fuv_limit: { group: "Photometry", label: "FUV limit qualifier" },
  b_mag: { group: "Photometry", label: "B magnitude" },
  ha_mag: { group: "Photometry", label: "Hα magnitude" },
  ha_limit: { group: "Photometry", label: "Hα limit qualifier" },
  ks_mag: { group: "Photometry", label: "K<sub>s</sub> magnitude" },
  ks_estimated: { group: "Photometry", label: "K<sub>s</sub> estimated" },
  lvg_v_hel_kms: {
    group: "Kinematics",
    label: "Heliocentric velocity V<sub>hel</sub>",
  },
  lvg_v_lg_kms: {
    group: "Kinematics",
    label: "Local Group velocity V<sub>LG</sub>",
  },
  dist: { group: "Distance", label: "Distance D" },
  mu: { group: "Distance", label: "Distance modulus μ" },
  distance_method: { group: "Distance", label: "Distance method" },
  modulus_method: { group: "Distance", label: "Modulus method" },
  hi21_mag: { group: "H I", label: "21-cm magnitude m<sub>21</sub>" },
  hi21_limit: { group: "H I", label: "21-cm limit qualifier" },
  w50_kms: { group: "H I", label: "H I linewidth W<sub>50</sub>" },
};

/** Identity, astrometry and provenance belong outside Observed Parameters. */
const NOT_OBSERVED = new Set([
  "pgc", "name", "names", "type_name",
  "ra", "e_ra", "dec", "e_dec",
  "source_catalog", "source_name", "lvg_source_catalog", "lvg_source_name",
  "distance_reference",
]);

export const GROUP_ORDER: readonly ObservedGroup[] = [
  "Geometry", "Morphology", "Photometry", "Kinematics", "Distance", "H I",
];

export type DisplayParameter = ParameterRow & { displayLabel: string };
export type DisplayParameterGroup = { title: string; rows: DisplayParameter[] };

function humanize(name: string): string {
  return name.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/**
 * Only populated science fields are rendered. New, unmapped science fields
 * appear in a temporary Other group rather than silently disappearing.
 */
export function groupObservedParameters(rows: ParameterRow[]): DisplayParameterGroup[] {
  const groups = GROUP_ORDER.map((title) => ({
    title,
    rows: [] as DisplayParameter[],
  }));
  const byTitle = new Map(groups.map((group) => [group.title, group]));
  const other: DisplayParameterGroup = { title: "Other", rows: [] };

  for (const row of rows) {
    if (NOT_OBSERVED.has(row.name) || !row.value.trim()) continue;
    const definition = PARAMETER_DEFINITIONS[row.name];
    const group = definition ? byTitle.get(definition.group) : other;
    if (!group) continue;
    group.rows.push({
      ...row,
      displayLabel: definition?.label ?? row.nice ?? humanize(row.name),
    });
  }
  return [...groups.filter((group) => group.rows.length > 0), ...(other.rows.length ? [other] : [])];
}
