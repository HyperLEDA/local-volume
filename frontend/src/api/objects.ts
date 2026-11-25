import { formatParameterDisplay } from "../lib/precision.ts";
import { displayedKs } from "../lib/estimatedKs.ts";
import type { GroupMember } from "./groups.ts";

export type ColumnMeta = {
  description: string;
  unit?: string | null;
  ucd?: string | null;
  nice?: string | null;
};

// Additive global evidence contract; never infer provenance from legacy dist.
export type SpatialDistance = Pick<GroupMember, "pgc"> &
  Partial<
    Pick<
      GroupMember,
      | "dist_mpc"
      | "observed_distance_mpc"
      | "derived_distance_mpc"
      | "observed_mu"
      | "observed_e_mu"
      | "distance_method"
      | "modulus_method"
      | "distance_reference"
      | "distance_source_catalog"
      | "distance_source_name"
      | "derived_distance_method"
      | "distance_computed_revision"
      | "distance_formula_version"
      | "distance_error_basis"
      | "e_distance_minus_mpc"
      | "e_distance_plus_mpc"
      | "distance_origin"
      | "distance_value_source"
      | "distance_adoption_basis"
      | "distance_method_for_value"
      | "distance_reference_for_value"
      | "distance_lineage_status"
      | "distance_lineage_reason"
      | "distance_interval_traceable"
      | "distance_value_fingerprint"
      | "distance_interval_fingerprint"
      | "distance_value_review_status"
      | "distance_interval_review_status"
      | "distance_value_evidence_locator"
      | "distance_interval_evidence_locator"
      | "distance_provenance_verified"
      | "distance_interval_verified"
      | "distance_3d_eligible"
    >
  >;

export const SPATIAL_DISTANCE_CONTRACT = "source_paired_evidence_v3";

export type CatalogObject = {
  spatial_distance?: SpatialDistance | null;
  pgc: number;
  name: string;
  distance_method?: string | null;
  ra: number | null;
  dec: number | null;
  bt: number | null;
  v_hel: number | null;
  b_mag?: number | null;
  abs_b_mag?: number | null;
  hi21_mag?: number | null;
  hi21_limit?: string | null;
  ks_mag?: number | null;
  lvg_v_hel_kms?: number | null;
  lvg_v_lg_kms?: number | null;
  dist?: number | null;
  theta1?: number | null;
  md_pgc?: number | null;
  md_name?: string | null;
  environment_coverage?: string | null;
  a26_arcmin?: number | null;
  morphology_t?: number | null;
  w50_kms?: number | null;
  type_name: string | null;
  d_26?: number | null;
  w_50?: number | null;
  names: string[];
};

export type CatalogObjectDetail = {
  pgc: number;
  name: string;
  ra?: number | null;
  e_ra?: number | null;
  dec?: number | null;
  e_dec?: number | null;
  bt?: number | null;
  e_bt?: number | null;
  kt?: number | null;
  e_kt?: number | null;
  v_hel?: number | null;
  e_v_hel?: number | null;
  v_lg?: number | null;
  e_v_lg?: number | null;
  b_mag?: number | null;
  ks_mag?: number | null;
  lvg_v_hel_kms?: number | null;
  a26_arcmin?: number | null;
  morphology_t?: number | null;
  w50_kms?: number | null;
  a50?: number | null;
  e_a50?: number | null;
  b50?: number | null;
  e_b50?: number | null;
  type_name?: string | null;
  d_26?: number | null;
  w_50?: number | null;
  names: string[];
};

type ObjectsListResponse = {
  distance_contract?: string;
  spatial_distances?: SpatialDistance[];
  data: {
    pgc: number[];
    name: string[];
    distance_method?: (string | null)[];
    ra: (number | null)[];
    dec: (number | null)[];
    bt?: (number | null)[];
    b_mag?: (number | null)[];
    abs_b_mag?: (number | null)[];
    hi21_mag?: (number | null)[];
    hi21_limit?: (string | null)[];
    ks_mag?: (number | null)[];
    lvg_v_hel_kms?: (number | null)[];
    lvg_v_lg_kms?: (number | null)[];
    dist?: (number | null)[];
    theta1?: (number | null)[];
    md_pgc?: (number | null)[];
    md_name?: (string | null)[];
    environment_coverage?: (string | null)[];
    a26_arcmin?: (number | null)[];
    morphology_t?: (number | null)[];
    w50_kms?: (number | null)[];
    v_hel?: (number | null)[];
    type_name?: (string | null)[];
    d_26?: (number | null)[];
    w_50?: (number | null)[];
    names: string[][];
  };
};

export type ObjectGetResponse = {
  data: CatalogObjectDetail;
  schema: Record<string, ColumnMeta>;
};

const TABLE_EXCLUDED = new Set([
  "pgc",
  "name",
  "names",
  "type_name",
  // Legacy LV-0002 measurements are retained in the DB/API,
  // but are not to be presented as adopted source-native LVGDB values.
  "bt",
  "e_bt",
  "kt",
  "e_kt",
  "v_hel",
  "e_v_hel",
  "v_lg",
  "e_v_lg",
  "a50",
  "e_a50",
  "b50",
  "e_b50",
  "lvg_e_v_hel_kms",
]);

// Share only an in-progress network request; completed results are never cached.
let pendingCatalog: Promise<ObjectsListResponse> | null = null;

async function fetchCatalogPayload(): Promise<ObjectsListResponse> {
  if (pendingCatalog !== null) return pendingCatalog;
  const request = (async () => {
    const response = await fetch("/api/v1/objects");
    if (!response.ok) {
      throw new Error(`Failed to load objects (${response.status})`);
    }
    return (await response.json()) as ObjectsListResponse;
  })();
  pendingCatalog = request;
  try {
    return await request;
  } finally {
    if (pendingCatalog === request) pendingCatalog = null;
  }
}

// Old API responses and malformed/misaligned spatial blocks retain the Sky catalogue.
// Do not join by approximate position, silently reorder, or substitute legacy dist.
function validSpatialRecord(
  row: SpatialDistance | undefined,
  id: number,
): boolean {
  if (row?.pgc !== id) return false;
  const d = row.dist_mpc;
  const validD = typeof d === "number" && Number.isFinite(d);
  if (d !== undefined && d !== null && !validD) return false;
  if (
    ![
      "DIRECT_MEASURED",
      "GROUP_ASSIGNED",
      "MODEL_INFERRED",
      "UNKNOWN",
    ].includes(row.distance_origin ?? "") ||
    !["HOLD", "NON_INDEPENDENT", "REVIEW_READY"].includes(
      row.distance_lineage_status ?? "",
    ) ||
    typeof row.distance_lineage_reason !== "string"
  )
    return false;
  const reviews = [
    "NOT_REVIEWED",
    "VERIFIED",
    "HOLD",
    "STALE",
    "BLOCKED",
    "UNAVAILABLE",
  ];
  if (
    !reviews.includes(row.distance_value_review_status ?? "") ||
    !reviews.includes(row.distance_interval_review_status ?? "") ||
    typeof row.distance_provenance_verified !== "boolean" ||
    typeof row.distance_3d_eligible !== "boolean" ||
    typeof row.distance_interval_traceable !== "boolean" ||
    typeof row.distance_interval_verified !== "boolean"
  )
    return false;
  if (
    row.distance_3d_eligible &&
    (typeof d !== "number" ||
      !Number.isFinite(d) ||
      d <= 0 ||
      id === 5064336 ||
      row.distance_origin !== "DIRECT_MEASURED" ||
      !row.distance_provenance_verified ||
      row.distance_value_review_status !== "VERIFIED" ||
      row.distance_lineage_status !== "REVIEW_READY")
  )
    return false;
  if (
    row.distance_interval_verified &&
    (!row.distance_provenance_verified ||
      !row.distance_interval_traceable ||
      row.distance_interval_review_status !== "VERIFIED")
  )
    return false;
  return true;
}

function spatialRecords(body: ObjectsListResponse): SpatialDistance[] | null {
  const rows = body.spatial_distances;
  const ids = body.data.pgc;
  if (
    body.distance_contract !== SPATIAL_DISTANCE_CONTRACT ||
    !Array.isArray(rows) ||
    rows.length !== ids.length ||
    new Set(ids).size !== ids.length ||
    !ids.every(
      (id, index) =>
        Number.isSafeInteger(id) &&
        id > 0 &&
        validSpatialRecord(rows[index], id),
    )
  )
    return null;
  return rows;
}

export async function fetchObjects(): Promise<CatalogObject[]> {
  const body = await fetchCatalogPayload();
  const spatial = spatialRecords(body);
  const {
    pgc,
    name,
    distance_method: distanceMethod,
    ra,
    dec,
    bt,
    b_mag: bMag,
    abs_b_mag: absBMag,
    hi21_mag: hi21Mag,
    hi21_limit: hi21Limit,
    ks_mag: ksMag,
    lvg_v_hel_kms: nativeVHel,
    lvg_v_lg_kms: nativeVLg,
    dist: nativeDistance,
    theta1: nativeTheta,
    md_pgc: nativeMdPgc,
    md_name: nativeMdName,
    environment_coverage: coverage,
    a26_arcmin: nativeA26,
    morphology_t: morphologyT,
    w50_kms: nativeW50,
    v_hel: vHel,
    type_name: typeName,
    d_26: d26,
    w_50: w50,
    names,
  } = body.data;
  return pgc.map((id, index) => ({
    pgc: id,
    spatial_distance: spatial === null ? null : { ...spatial[index] },
    name: name[index] ?? "",
    distance_method: distanceMethod?.[index] ?? null,
    ra: ra[index] ?? null,
    dec: dec[index] ?? null,
    bt: bt?.[index] ?? null,
    b_mag: bMag?.[index] ?? null,
    abs_b_mag: absBMag?.[index] ?? null,
    hi21_mag: hi21Mag?.[index] ?? null,
    hi21_limit: hi21Limit?.[index] ?? null,
    ks_mag: ksMag?.[index] ?? null,
    lvg_v_hel_kms: nativeVHel?.[index] ?? null,
    lvg_v_lg_kms: nativeVLg?.[index] ?? null,
    dist: nativeDistance?.[index] ?? null,
    theta1: nativeTheta?.[index] ?? null,
    md_pgc: nativeMdPgc?.[index] ?? null,
    md_name: nativeMdName?.[index] ?? null,
    environment_coverage: coverage?.[index] ?? null,
    a26_arcmin: nativeA26?.[index] ?? null,
    morphology_t: morphologyT?.[index] ?? null,
    w50_kms: nativeW50?.[index] ?? null,
    v_hel: vHel?.[index] ?? null,
    type_name: typeName?.[index] ?? null,
    d_26: d26?.[index] ?? null,
    w_50: w50?.[index] ?? null,
    names: [...(names[index] ?? [])],
  }));
}

export async function fetchObject(pgc: number): Promise<ObjectGetResponse> {
  const response = await fetch(`/api/v1/object/${pgc}`);
  if (response.status === 404) {
    throw new Error("Object not found");
  }
  if (!response.ok) {
    throw new Error(`Failed to load object (${response.status})`);
  }
  return (await response.json()) as ObjectGetResponse;
}

function matchesNormalizedQuery(
  object: CatalogObject,
  normalized: string,
): boolean {
  if (normalized.length === 0) return true;
  return (
    object.name.toLowerCase().includes(normalized) ||
    String(object.pgc).includes(normalized) ||
    object.names.some((extraName) =>
      extraName.toLowerCase().includes(normalized),
    )
  );
}

/** Normalize the search string once, not once for every galaxy in the Atlas. */
export function createCatalogQueryMatcher(
  query: string,
): (object: CatalogObject) => boolean {
  const normalized = query.trim().toLowerCase();
  return (object) => matchesNormalizedQuery(object, normalized);
}

export function matchesQuery(object: CatalogObject, query: string): boolean {
  return matchesNormalizedQuery(object, query.trim().toLowerCase());
}

export function nameIncludesPgc(name: string, pgc: number): boolean {
  return Array.from(name.matchAll(/\bPGC[\s-]*0*(\d+)\b/gi)).some(
    ([, identifier]) => Number(identifier) === pgc,
  );
}

export type ParameterRow = {
  name: string;
  nice: string | null;
  description: string;
  unit: string | null;
  value: string;
  error: string | null;
  errorUnit: string | null;
};

export function formatUncertainty(error: string | null): string {
  return error === null || error.trim() === "" ? "—" : `± ${error}`;
}

export function parameterRows(
  data: CatalogObjectDetail,
  schema: Record<string, ColumnMeta>,
): ParameterRow[] {
  const record = data as Record<string, unknown>;
  const ks = displayedKs(record);
  const rows: ParameterRow[] = [];

  for (const [key, meta] of Object.entries(schema)) {
    if (TABLE_EXCLUDED.has(key) || !(key in record)) {
      continue;
    }

    const counterpart = key.startsWith("e_") ? key.slice(2) : null;
    if (
      counterpart !== null &&
      counterpart in schema &&
      counterpart in record
    ) {
      continue;
    }

    const errorKey = key === "lvg_v_hel_kms" ? "lvg_e_v_hel_kms" : `e_${key}`;
    const errorMeta = Object.prototype.hasOwnProperty.call(schema, errorKey)
      ? schema[errorKey]
      : null;
    const displayed =
      key === "ks_mag"
        ? ks.value
        : key === "ks_estimated"
          ? ks.estimated
          : record[key];
    // A B/T-derived Ks proxy has no independently measured Ks uncertainty.
    const rawError = key === "ks_mag" && ks.estimated ? null : record[errorKey];
    const hasError =
      errorMeta !== null && rawError !== null && rawError !== undefined;
    const errorUnit = errorMeta?.unit ?? null;
    const formatted = formatParameterDisplay(
      key,
      displayed,
      hasError ? rawError : null,
      meta,
      errorMeta,
    );

    rows.push({
      name: key,
      nice: meta.nice?.trim() || null,
      description: meta.description,
      unit: meta.unit ?? null,
      value: formatted.value,
      error: hasError ? formatted.error : null,
      errorUnit:
        hasError && errorUnit !== (meta.unit ?? null) ? errorUnit : null,
    });
  }
  return rows;
}
