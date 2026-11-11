export type ColumnMeta = {
  description: string;
  unit?: string | null;
  ucd?: string | null;
};

export type CatalogObject = {
  pgc: number;
  name: string;
  ra: number | null;
  dec: number | null;
  bt: number | null;
  v_hel: number | null;
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
  data: {
    pgc: number[];
    name: string[];
    ra: (number | null)[];
    dec: (number | null)[];
    bt?: (number | null)[];
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

const TABLE_EXCLUDED = new Set(["pgc", "name", "names", "type_name"]);

export async function fetchObjects(): Promise<CatalogObject[]> {
  const response = await fetch("/api/v1/objects");
  if (!response.ok) {
    throw new Error(`Failed to load objects (${response.status})`);
  }
  const body = (await response.json()) as ObjectsListResponse;
  const {
    pgc,
    name,
    ra,
    dec,
    bt,
    v_hel: vHel,
    type_name: typeName,
    d_26: d26,
    w_50: w50,
    names,
  } = body.data;
  return pgc.map((id, index) => ({
    pgc: id,
    name: name[index] ?? "",
    ra: ra[index] ?? null,
    dec: dec[index] ?? null,
    bt: bt?.[index] ?? null,
    v_hel: vHel?.[index] ?? null,
    type_name: typeName?.[index] ?? null,
    d_26: d26?.[index] ?? null,
    w_50: w50?.[index] ?? null,
    names: names[index] ?? [],
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

export function matchesQuery(object: CatalogObject, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  return (
    object.name.toLowerCase().includes(normalized) ||
    String(object.pgc).includes(normalized) ||
    object.names.some((extraName) =>
      extraName.toLowerCase().includes(normalized),
    )
  );
}

export function nameIncludesPgc(name: string, pgc: number): boolean {
  return Array.from(name.matchAll(/\bPGC[\s-]*0*(\d+)\b/gi)).some(
    ([, identifier]) => Number(identifier) === pgc,
  );
}

export type ParameterRow = {
  name: string;
  description: string;
  unit: string | null;
  value: string;
  error: string | null;
  errorUnit: string | null;
};

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function parameterRows(
  data: CatalogObjectDetail,
  schema: Record<string, ColumnMeta>,
): ParameterRow[] {
  const record = data as Record<string, unknown>;
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

    const errorKey = `e_${key}`;
    const errorMeta = Object.prototype.hasOwnProperty.call(schema, errorKey)
      ? schema[errorKey]
      : null;
    const rawError = record[errorKey];
    const hasError =
      errorMeta !== null && rawError !== null && rawError !== undefined;
    const errorUnit = errorMeta?.unit ?? null;

    rows.push({
      name: key,
      description: meta.description,
      unit: meta.unit ?? null,
      value: formatValue(record[key]),
      error: hasError ? formatValue(rawError) : null,
      errorUnit:
        hasError && errorUnit !== (meta.unit ?? null) ? errorUnit : null,
    });
  }
  return rows;
}
