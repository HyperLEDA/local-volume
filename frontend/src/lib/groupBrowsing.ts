/** A bounded session snapshot of the displayed Groups catalogue.
 * A group is identified by its group_id, root PGC, and definition together.
 * The URL stores a token, not a potentially large membership/order list.
 */
import type { GroupDefinition } from "../api/groups.ts";

export type GroupListState = {
  definition: "physical" | "suite";
  sort: "members" | "distance" | "name";
  query: string;
  limit: number;
};
export type GroupBrowseEntry = { rootPgc: number; groupId: number };
export type GroupBrowseContext = {
  v: 1;
  created: number;
  definition: "physical" | "suite";
  returnTo: string;
  scrollY: number;
  entries: GroupBrowseEntry[];
};

const PREFIX = "lv-leda-groups-browse-v1:";
const KEY_PATTERN = /^[a-z0-9-]{8,80}$/;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_GROUPS = 5000;

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function readGroupListState(search: string): GroupListState {
  const params = new URLSearchParams(search);
  const definition = params.get("definition");
  const sort = params.get("sort");
  const limit = Number(params.get("limit"));
  return {
    definition: definition === "suite" ? "suite" : "physical",
    sort: sort === "name" || sort === "distance" ? sort : "members",
    query: (params.get("q") ?? "").slice(0, 200),
    limit:
      Number.isSafeInteger(limit) && limit >= 24 && limit <= 5000 ? limit : 24,
  };
}

export function groupListUrl(state: GroupListState): string {
  const params = new URLSearchParams();
  params.set("definition", state.definition);
  if (state.sort !== "members") params.set("sort", state.sort);
  if (state.query.trim()) params.set("q", state.query.slice(0, 200));
  if (state.limit > 24) params.set("limit", String(state.limit));
  return `/groups?${params}`;
}

export function validateGroupBrowse(raw: unknown): GroupBrowseContext | null {
  if (typeof raw !== "object" || raw === null) return null;
  const context = raw as Partial<GroupBrowseContext>;
  if (
    context.v !== 1 ||
    (context.definition !== "physical" && context.definition !== "suite") ||
    typeof context.created !== "number" ||
    !Number.isFinite(context.created) ||
    context.created > Date.now() + 60000 ||
    Date.now() - context.created > MAX_AGE_MS ||
    typeof context.scrollY !== "number" ||
    !Number.isFinite(context.scrollY) ||
    context.scrollY < 0 ||
    typeof context.returnTo !== "string" ||
    context.returnTo.length > 4500 ||
    !context.returnTo.startsWith("/groups?")
  )
    return null;
  const parsed = new URL(context.returnTo, "https://example.invalid");
  if (
    parsed.pathname !== "/groups" ||
    parsed.searchParams.get("definition") !== context.definition ||
    parsed.origin !== "https://example.invalid"
  )
    return null;
  if (
    !Array.isArray(context.entries) ||
    context.entries.length === 0 ||
    context.entries.length > MAX_GROUPS
  )
    return null;
  const roots = new Set<number>();
  for (const entry of context.entries as unknown[]) {
    const row =
      entry !== null && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : null;
    if (
      row === null ||
      !validId(row.rootPgc) ||
      !validId(row.groupId) ||
      roots.has(row.rootPgc)
    )
      return null;
    roots.add(row.rootPgc);
  }
  return context as GroupBrowseContext;
}

export function saveGroupBrowse(
  token: string,
  context: Omit<GroupBrowseContext, "v" | "created">,
): boolean {
  if (!KEY_PATTERN.test(token)) return false;
  const valid = validateGroupBrowse({ ...context, v: 1, created: Date.now() });
  if (!valid) return false;
  try {
    sessionStorage.setItem(PREFIX + token, JSON.stringify(valid));
    return true;
  } catch {
    return false;
  }
}

export function loadGroupBrowse(
  token: string | null,
): GroupBrowseContext | null {
  if (!token || !KEY_PATTERN.test(token)) return null;
  try {
    const value = sessionStorage.getItem(PREFIX + token);
    return value === null ? null : validateGroupBrowse(JSON.parse(value));
  } catch {
    return null;
  }
}

/** Keep a group-member context when opening an Aladin popup link.
 * Unrelated sky objects retain their ordinary individual-object routes.
 */
export function groupPopupRoute(
  route: string,
  members: readonly { pgc: number }[],
  onMemberNavigate?: (pgc: number) => string | null,
): string {
  const match = /^\/object\/([1-9]\d*)$/.exec(route);
  if (!match) return route;
  const pgc = Number(match[1]);
  if (
    !Number.isSafeInteger(pgc) ||
    !members.some((member) => member.pgc === pgc)
  )
    return route;
  return onMemberNavigate?.(pgc) ?? route;
}

export function groupBrowseNeighbors(
  context: GroupBrowseContext | null,
  rootPgc: number,
  definition: GroupDefinition,
): { index: number; previous: number | null; next: number | null } | null {
  if (!context || context.definition !== definition) return null;
  const index = context.entries.findIndex((entry) => entry.rootPgc === rootPgc);
  if (index < 0) return null;
  return {
    index,
    previous: index > 0 ? context.entries[index - 1].rootPgc : null,
    next:
      index + 1 < context.entries.length
        ? context.entries[index + 1].rootPgc
        : null,
  };
}
