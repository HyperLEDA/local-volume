import {
  fetchGroup,
  fetchGroupMemberships,
  groupMembershipUrl,
  type GroupDetail,
  type GroupMembership,
} from "../api/groups.ts";
import type { CatalogObject } from "../api/objects.ts";
import { groupTidalEdges } from "./groupTidalEdges.ts";
import { greatCircleVertices, hasSkyPosition } from "./mdConnection.ts";

export function atlasMembershipKey(member: GroupMembership): string {
  return JSON.stringify([
    member.definition,
    member.group_id,
    member.root_pgc,
    member.source_catalog,
    member.source_version,
    member.source_sha256,
  ]);
}

export function atlasMembershipChoices(
  rows: readonly GroupMembership[],
  pgc: number,
): GroupMembership[] {
  const unique = new Map<string, GroupMembership>();
  for (const row of rows) {
    if (
      row.member_pgc !== pgc ||
      !["root", "computed", "supported"].includes(row.membership_status)
    )
      continue;
    if (!row.source_catalog.trim() || !row.source_version.trim()) continue;
    try {
      groupMembershipUrl(row);
    } catch {
      continue;
    }
    unique.set(atlasMembershipKey(row), row);
  }
  return [...unique.values()];
}

export function atlasActiveMembership(
  choices: readonly GroupMembership[],
): GroupMembership | null {
  const physical = choices.filter((row) => row.definition === "physical");
  return physical.length === 1 ? physical[0] : null;
}

export function validateAtlasGroup(
  detail: GroupDetail,
  member: GroupMembership,
): GroupDetail {
  if (
    detail.group_id !== member.group_id ||
    detail.root_pgc !== member.root_pgc ||
    detail.definition !== member.definition ||
    detail.source_catalog !== member.source_catalog ||
    detail.source_version !== member.source_version ||
    detail.source_sha256 !== member.source_sha256 ||
    !detail.members.some(
      (row) =>
        row.pgc === member.member_pgc &&
        row.group_id === member.group_id &&
        row.membership_status === member.membership_status &&
        row.parent_md_pgc === member.parent_md_pgc,
    )
  ) {
    throw new Error("Group membership changed; reopen the selection");
  }
  return detail;
}

// A bounded, short-lived cache, including in-flight deduplication. Failed reads
// are evicted. A caller must still guard against stale selection responses.
function createCache<K, V>(load: (key: K) => Promise<V>) {
  const cache = new Map<K, { expires: number; promise: Promise<V> }>();
  return function get(key: K): Promise<V> {
    const current = cache.get(key);
    if (current && current.expires > Date.now()) return current.promise;
    const promise = Promise.resolve().then(() => load(key));
    cache.delete(key);
    cache.set(key, { expires: Date.now() + 60_000, promise });
    if (cache.size > 32) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    void promise.catch(() => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
    });
    return promise;
  };
}

export function createAtlasGroupResolver(
  loadMemberships = fetchGroupMemberships,
  loadGroup = fetchGroup,
) {
  const memberships = createCache(loadMemberships);
  // Include all provenance in the cache key; never merge competing definitions.
  const group = createCache((key: string) => {
    const [definition, groupId, root] = JSON.parse(key) as [
      GroupMembership["definition"],
      number,
      number,
    ];
    return loadGroup(root, definition, groupId);
  });
  return {
    memberships,
    async detail(member: GroupMembership): Promise<GroupDetail> {
      return validateAtlasGroup(
        await group(atlasMembershipKey(member)),
        member,
      );
    },
  };
}

export function buildAtlasGroupGraph(
  detail: GroupDetail,
  reference: readonly CatalogObject[],
) {
  const members = detail.members.filter(
    (member) =>
      member.group_id === detail.group_id &&
      ["root", "computed", "supported"].includes(member.membership_status),
  );
  const mapRows = new Map(reference.map((row) => [row.pgc, row]));
  // Use the same coordinates as the actual Atlas markers. The member and pair
  // identity still come exclusively from the resolved catalogue group.
  const points = members.flatMap((member) => {
    const row = mapRows.get(member.pgc);
    return row && hasSkyPosition(row) ? [row] : [];
  });
  const edges = groupTidalEdges(members);
  const arcs = edges.flatMap((edge) => {
    const member = mapRows.get(edge.memberPgc);
    const parent = mapRows.get(edge.parentPgc);
    if (!hasSkyPosition(member) || !hasSkyPosition(parent)) return [];
    const vertices = greatCircleVertices(member, parent);
    return vertices.length >= 2 ? [{ edge, vertices }] : [];
  });
  return {
    points,
    arcs,
    acceptedCount: members.length,
    candidateCount: detail.members.filter(
      (row) => row.membership_status === "unconfirmed",
    ).length,
    omittedEdges: edges.length - arcs.length,
  };
}
