export type CatalogObject = {
  pgc: number;
  name: string;
  ra: number | null;
  dec: number | null;
};

type ObjectsListResponse = {
  data: {
    pgc: number[];
    name: string[];
    ra: (number | null)[];
    dec: (number | null)[];
  };
};

export async function fetchObjects(): Promise<CatalogObject[]> {
  const response = await fetch("/api/v1/objects");
  if (!response.ok) {
    throw new Error(`Failed to load objects (${response.status})`);
  }
  const body = (await response.json()) as ObjectsListResponse;
  const { pgc, name, ra, dec } = body.data;
  return pgc.map((id, index) => ({
    pgc: id,
    name: name[index] ?? "",
    ra: ra[index] ?? null,
    dec: dec[index] ?? null,
  }));
}

export function matchesQuery(object: CatalogObject, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  return (
    object.name.toLowerCase().includes(normalized) ||
    String(object.pgc).includes(normalized)
  );
}
