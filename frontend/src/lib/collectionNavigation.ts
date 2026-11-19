/** Session-scoped, versioned traversal through a displayed catalogue collection.
 * URLs carry a short token, never the whole collection. Untrusted storage is
 * validated before it can create links to another object.
 */
export type CollectionOrigin = "atlas" | "group";
export type CollectionNavigation = {
  v: 1;
  created: number;
  origin: CollectionOrigin;
  label: string;
  returnTo: string;
  pgcs: number[];
  scrollY: number;
  group?: { id: number; rootPgc: number; definition: "physical" | "suite" };
};
const PREFIX = "lv-leda-collection-v1:";
const RETURN_KEY = "lv-leda-collection-scroll-v1";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_OBJECTS = 40000;
const KEY_PATTERN = /^[a-z0-9-]{8,80}$/;

export function validPgc(pgc: unknown): pgc is number {
  return typeof pgc === "number" && Number.isSafeInteger(pgc) && pgc > 0;
}

export function newCollectionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `nav-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function validateCollection(raw: unknown): CollectionNavigation | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<CollectionNavigation>;
  if (c.v !== 1 || (c.origin !== "atlas" && c.origin !== "group")) return null;
  if (
    typeof c.created !== "number" ||
    !Number.isFinite(c.created) ||
    c.created > Date.now() + 60000 ||
    Date.now() - c.created > MAX_AGE_MS
  )
    return null;
  if (typeof c.label !== "string" || !c.label.trim() || c.label.length > 120)
    return null;
  if (typeof c.returnTo !== "string" || c.returnTo.length > 4400) return null;
  const [path] = c.returnTo.split("?");
  if (c.origin === "atlas" ? path !== "/" : !/^\/groups\/[1-9]\d*$/.test(path))
    return null;
  if (
    !Array.isArray(c.pgcs) ||
    c.pgcs.length === 0 ||
    c.pgcs.length > MAX_OBJECTS ||
    c.pgcs.some((id) => !validPgc(id)) ||
    new Set(c.pgcs).size !== c.pgcs.length
  )
    return null;
  if (
    typeof c.scrollY !== "number" ||
    !Number.isFinite(c.scrollY) ||
    c.scrollY < 0
  )
    return null;
  if (c.origin === "group") {
    const g = c.group;
    const groupDefinition: unknown = g?.definition;
    if (
      !g ||
      !validPgc(g.id) ||
      !validPgc(g.rootPgc) ||
      (groupDefinition !== "physical" && groupDefinition !== "suite")
    )
      return null;
    if (
      path !== `/groups/${g.rootPgc}` ||
      new URLSearchParams(c.returnTo.split("?")[1] ?? "").get("definition") !==
        g.definition
    )
      return null;
  } else if (c.group !== undefined) return null;
  return c as CollectionNavigation;
}

export function saveCollection(
  token: string,
  collection: Omit<CollectionNavigation, "v" | "created">,
): boolean {
  if (!KEY_PATTERN.test(token)) return false;
  const checked = validateCollection({
    ...collection,
    v: 1,
    created: Date.now(),
  });
  if (!checked) return false;
  try {
    sessionStorage.setItem(PREFIX + token, JSON.stringify(checked));
    return true;
  } catch {
    return false;
  }
}

export function loadCollection(
  token: string | null,
): CollectionNavigation | null {
  if (!token || !KEY_PATTERN.test(token)) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + token);
    return raw === null ? null : validateCollection(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function collectionNeighbors(
  collection: CollectionNavigation | null,
  pgc: number,
): { index: number; previous: number | null; next: number | null } | null {
  if (!collection) return null;
  const index = collection.pgcs.indexOf(pgc);
  if (index < 0) return null;
  return {
    index,
    previous: index > 0 ? collection.pgcs[index - 1] : null,
    next:
      index + 1 < collection.pgcs.length ? collection.pgcs[index + 1] : null,
  };
}

export function markCollectionReturn(scrollY: number): void {
  try {
    sessionStorage.setItem(RETURN_KEY, String(scrollY));
  } catch {
    /* optional */
  }
}

export function consumeCollectionReturn(): number | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}
