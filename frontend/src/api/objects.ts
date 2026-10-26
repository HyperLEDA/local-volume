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
  names: string[];
};

export type CatalogObjectDetail = {
  pgc: number;
  name: string;
  ra?: number | null;
  e_ra?: number | null;
  dec?: number | null;
  e_dec?: number | null;
  cz?: number | null;
  e_cz?: number | null;
  type_name?: string | null;
  names: string[];
};

type ObjectsListResponse = {
  data: {
    pgc: number[];
    name: string[];
    ra: (number | null)[];
    dec: (number | null)[];
    names: string[][];
  };
};

export type ObjectGetResponse = {
  data: CatalogObjectDetail;
  schema: Record<string, ColumnMeta>;
};

const TABLE_EXCLUDED = new Set(["name", "names"]);

export async function fetchObjects(): Promise<CatalogObject[]> {
  const response = await fetch("/api/v1/objects");
  if (!response.ok) {
    throw new Error(`Failed to load objects (${response.status})`);
  }
  const body = (await response.json()) as ObjectsListResponse;
  const { pgc, name, ra, dec, names } = body.data;
  return pgc.map((id, index) => ({
    pgc: id,
    name: name[index] ?? "",
    ra: ra[index] ?? null,
    dec: dec[index] ?? null,
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

export type ParameterRow = {
  name: string;
  description: string;
  unit: string | null;
  value: string;
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
    rows.push({
      name: key,
      description: meta.description,
      unit: meta.unit ?? null,
      value: formatValue(record[key]),
    });
  }
  return rows;
}
