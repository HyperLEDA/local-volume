import type { CatalogObject, SpatialDistance } from "../api/objects.ts";
import type { GroupSummary } from "../api/groups.ts";
import { validDistance, type Vec3 } from "./groupGeometry3d.ts";
import { observerCartesianMpc, type ObserverFrame } from "./spatialFrames.ts";

export type AtlasDistanceMode = "individual" | "catalogue" | "verified";
export type AtlasKind = "individual" | "assigned" | "model" | "unknown";
export type AtlasSpatialRow = {
  object: CatalogObject;
  evidence: SpatialDistance | null;
  position: Vec3 | null;
  kind: AtlasKind | null;
  verified: boolean;
  reason: string;
};
export type AtlasGroupBubble = {
  pgc: number;
  name: string;
  position: Vec3;
  radiusMpc: number;
  memberCount: number;
  groupId: number;
  distanceMpc: number;
  verified: boolean;
  kind: AtlasKind;
  morphologyT: number | null;
  /** Present only for the MW envelope: number of qualified satellites. */
  radiusSampleCount?: number;
};

/** Display positions are not an input to physical separation or depth estimates. */
export function buildAtlasSpatialRows(
  objects: readonly CatalogObject[],
  frame: ObserverFrame,
): AtlasSpatialRow[] {
  const counts = new Map<number, number>();
  for (const object of objects)
    counts.set(object.pgc, (counts.get(object.pgc) ?? 0) + 1);
  return objects.map((object) => {
    const evidence = object.spatial_distance ?? null;
    const base = {
      object,
      evidence,
      position: null,
      kind: null,
      verified: false,
    };
    if (
      !Number.isSafeInteger(object.pgc) ||
      object.pgc <= 0 ||
      counts.get(object.pgc) !== 1
    )
      return { ...base, reason: "Invalid or duplicate PGC" };
    if (object.pgc === 5064336)
      return { ...base, reason: "Observer host; not an extragalactic point" };
    if (!evidence || evidence.pgc !== object.pgc)
      return { ...base, reason: "Spatial contract unavailable" };
    const distance = evidence.dist_mpc;
    if (!validDistance(distance))
      return { ...base, reason: "No valid adopted distance" };
    const position = observerCartesianMpc(object, distance, frame);
    if (!position) return { ...base, reason: "Invalid sky position" };
    const kind: AtlasKind =
      evidence.distance_origin === "DIRECT_MEASURED"
        ? "individual"
        : evidence.distance_origin === "GROUP_ASSIGNED"
          ? "assigned"
          : evidence.distance_origin === "MODEL_INFERRED"
            ? "model"
            : "unknown";
    const verified =
      kind === "individual" &&
      evidence.distance_3d_eligible === true &&
      evidence.distance_provenance_verified === true &&
      evidence.distance_value_review_status === "VERIFIED" &&
      evidence.distance_lineage_status === "REVIEW_READY";
    return {
      object,
      evidence,
      position,
      kind,
      verified,
      reason: evidence.distance_lineage_reason ?? "Unclassified",
    };
  });
}
export type AtlasSpatialPoint = AtlasSpatialRow & {
  position: Vec3;
  kind: AtlasKind;
};
export function atlasVisiblePoints(
  rows: readonly AtlasSpatialRow[],
  mode: AtlasDistanceMode,
): AtlasSpatialPoint[] {
  return rows.filter(
    (row): row is AtlasSpatialPoint =>
      row.position !== null &&
      row.kind !== null &&
      (mode === "catalogue" ||
        (mode === "individual" && row.kind === "individual") ||
        (mode === "verified" && row.verified)),
  );
}

export const LOCAL_VIEW_RADIUS_MPC = 11;

/** A display subset only: the original catalogue and distance mode remain intact. */
export function atlasScopePoints(
  points: readonly AtlasSpatialPoint[],
  localOnly: boolean,
): AtlasSpatialPoint[] {
  if (!localOnly) return [...points];
  return points.filter((point) => {
    const distance = point.evidence?.dist_mpc;
    return validDistance(distance) && distance <= LOCAL_VIEW_RADIUS_MPC;
  });
}

/** Canonical physical groups only. The root must be in the active display
 *  sample. The full-catalogue projected extent is not recomputed from that
 *  sample and is not a physical halo radius or line-of-sight depth. */
export function buildAtlasGroupBubbles(
  points: readonly AtlasSpatialPoint[],
  catalogue: readonly GroupSummary[],
): AtlasGroupBubble[] {
  const byPgc = new Map(points.map((point) => [point.object.pgc, point]));
  const counts = new Map<number, number>();
  for (const group of catalogue)
    counts.set(group.root_pgc, (counts.get(group.root_pgc) ?? 0) + 1);
  const bubbles: AtlasGroupBubble[] = [];
  for (const group of catalogue) {
    const pgc = group.root_pgc;
    if (
      group.definition !== "physical" ||
      !Number.isSafeInteger(pgc) ||
      pgc <= 0 ||
      group.group_id !== -pgc ||
      counts.get(pgc) !== 1 ||
      !Number.isSafeInteger(group.member_count) ||
      group.member_count < 2 ||
      !validDistance(group.distance_mpc) ||
      !validDistance(group.extent_kpc)
    )
      continue;
    const root = byPgc.get(pgc);
    if (!root || !root.evidence || !validDistance(root.evidence.dist_mpc))
      continue;
    const d = root.evidence.dist_mpc;
    // Fail closed if group summary and global source disagree. The projected
    // extent is calculated using this same adopted root distance.
    if (Math.abs(group.distance_mpc - d) > 1e-7 * Math.max(1, d)) continue;
    if (
      group.root_ra === null ||
      group.root_dec === null ||
      root.object.ra === null ||
      root.object.dec === null ||
      !Number.isFinite(group.root_ra) ||
      !Number.isFinite(group.root_dec) ||
      Math.abs(
        ((((group.root_ra - root.object.ra + 540) % 360) + 360) % 360) - 180,
      ) > 1e-6 ||
      Math.abs(group.root_dec - root.object.dec) > 1e-6
    )
      continue;
    bubbles.push({
      pgc,
      groupId: group.group_id,
      name: group.name,
      position: root.position,
      radiusMpc: group.extent_kpc / 1000,
      memberCount: group.member_count,
      distanceMpc: d,
      verified: root.verified,
      kind: root.kind,
      morphologyT: root.object.morphology_t ?? null,
    });
  }
  return bubbles.sort((a, b) => b.memberCount - a.memberCount || a.pgc - b.pgc);
}

export type PhysicalGroupSnapshot = {
  catalogue_pgcs: number[];
  groups: (GroupSummary & { member_pgcs: number[] })[];
};

/** MW's centre is a nominal catalogue centre, not an extragalactic point.
 * This envelope describes the full qualified member sample, not a halo or
 * projected extent. Never add the centre to the scientific galaxy sample.
 */
export function buildAtlasMwGroupBubble(
  rows: readonly AtlasSpatialRow[],
  snapshot: PhysicalGroupSnapshot | null,
  frame: ObserverFrame,
  mode: AtlasDistanceMode,
  localOnly: boolean,
): AtlasGroupBubble | null {
  const pgc = 5064336;
  if (!snapshot || mode === "verified") return null;
  const groups = snapshot.groups.filter((group) => group.root_pgc === pgc);
  if (groups.length !== 1) return null;
  const group = groups[0];
  const roots = rows.filter((row) => row.object.pgc === pgc);
  if (roots.length !== 1) return null;
  const root = roots[0];
  const evidence = root.evidence;
  if (
    group.definition !== "physical" ||
    group.group_id !== -pgc ||
    group.extent_kpc !== null ||
    group.member_pgcs.length !== group.member_count ||
    group.member_count < 3 ||
    new Set(group.member_pgcs).size !== group.member_count ||
    !group.member_pgcs.includes(pgc) ||
    !evidence ||
    evidence.pgc !== pgc ||
    evidence.distance_origin === "GROUP_ASSIGNED" ||
    evidence.distance_origin === "MODEL_INFERRED" ||
    !validDistance(evidence.dist_mpc) ||
    !validDistance(group.distance_mpc) ||
    evidence.distance_formula_version !== group.source_version ||
    typeof evidence.distance_computed_revision !== "number" ||
    !Number.isSafeInteger(evidence.distance_computed_revision) ||
    evidence.distance_computed_revision < 1
  )
    return null;
  const d = evidence.dist_mpc;
  if (localOnly && d > LOCAL_VIEW_RADIUS_MPC) return null;
  if (Math.abs(group.distance_mpc - d) > 1e-7 * Math.max(1, d)) return null;
  const { ra, dec } = root.object;
  if (
    ra === null ||
    dec === null ||
    group.root_ra === null ||
    group.root_dec === null ||
    !Number.isFinite(group.root_ra) ||
    !Number.isFinite(group.root_dec) ||
    Math.abs(((((group.root_ra - ra + 540) % 360) + 360) % 360) - 180) > 1e-6 ||
    Math.abs(group.root_dec - dec) > 1e-6
  )
    return null;
  const centre = observerCartesianMpc(root.object, d, frame);
  if (!centre) return null;
  const members = new Set(group.member_pgcs);
  const covered = new Set(snapshot.catalogue_pgcs);
  if (group.member_pgcs.some((id) => !covered.has(id))) return null;
  let radius = 0;
  let count = 0;
  const identityCounts = new Map<number, number>();
  for (const row of rows) {
    const id = row.object.pgc;
    identityCounts.set(id, (identityCounts.get(id) ?? 0) + 1);
  }
  for (const row of rows) {
    const id = row.object.pgc;
    if (
      id === pgc ||
      !members.has(id) ||
      identityCounts.get(id) !== 1 ||
      row.position === null ||
      row.kind !== "individual" ||
      row.evidence?.distance_lineage_status !== "REVIEW_READY" ||
      !["VERIFIED", "NOT_REVIEWED"].includes(
        row.evidence.distance_value_review_status ?? "",
      ) ||
      row.evidence.distance_formula_version !== group.source_version ||
      row.evidence.distance_computed_revision !==
        evidence.distance_computed_revision
    )
      continue;
    const p = row.position;
    const r = Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]);
    if (!Number.isFinite(r)) continue;
    radius = Math.max(radius, r);
    count += 1;
  }
  if (count === 0 || !validDistance(radius)) return null;
  return {
    pgc,
    groupId: group.group_id,
    name: group.name,
    position: centre,
    radiusMpc: radius,
    memberCount: group.member_count,
    distanceMpc: d,
    verified: false,
    kind: "unknown",
    morphologyT: root.object.morphology_t ?? null,
    radiusSampleCount: count,
  };
}

/** A complete, disjoint physical catalogue snapshot; invalid data fails closed. */
export function validatePhysicalGroupSnapshot(
  value: unknown,
): PhysicalGroupSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("Invalid physical group snapshot");
  const snapshot = value as PhysicalGroupSnapshot;
  if (
    !Array.isArray(snapshot.catalogue_pgcs) ||
    !Array.isArray(snapshot.groups)
  )
    throw new Error("Incomplete physical group snapshot");
  const covered = new Set<number>();
  for (const pgc of snapshot.catalogue_pgcs) {
    if (!Number.isSafeInteger(pgc) || pgc <= 0 || covered.has(pgc))
      throw new Error("Invalid catalogue PGC");
    covered.add(pgc);
  }
  const members = new Set<number>();
  for (const raw of snapshot.groups as unknown[]) {
    if (!raw || typeof raw !== "object") throw new Error("Invalid group entry");
    const group = raw as PhysicalGroupSnapshot["groups"][number];
    if (
      typeof group.name !== "string" ||
      group.definition !== "physical" ||
      !Number.isSafeInteger(group.root_pgc) ||
      group.root_pgc <= 0 ||
      group.group_id !== -group.root_pgc ||
      !Array.isArray(group.member_pgcs) ||
      group.member_pgcs.length < 3 ||
      group.member_pgcs.length !== group.member_count ||
      !group.member_pgcs.includes(group.root_pgc)
    )
      throw new Error("Invalid physical group membership");
    for (const pgc of group.member_pgcs) {
      if (!covered.has(pgc) || members.has(pgc))
        throw new Error("Unknown or overlapping group member");
      members.add(pgc);
    }
  }
  return snapshot;
}

/** Membership is independent of the current volume, depth and root visibility. */
export function atlasFieldPartition(
  points: readonly AtlasSpatialPoint[],
  snapshot: PhysicalGroupSnapshot | null,
) {
  const field: AtlasSpatialPoint[] = [];
  let grouped = 0;
  let unavailable = 0;
  if (!snapshot) return { field, grouped, unavailable: points.length };
  const covered = new Set(snapshot.catalogue_pgcs);
  const members = new Set(
    snapshot.groups.flatMap((group) => group.member_pgcs),
  );
  for (const point of points) {
    const pgc = point.object.pgc;
    if (!covered.has(pgc)) unavailable += 1;
    else if (members.has(pgc)) grouped += 1;
    else field.push(point);
  }
  return { field, grouped, unavailable };
}

export async function fetchPhysicalGroupSnapshot(): Promise<PhysicalGroupSnapshot> {
  const response = await fetch("/api/v1/spatial/physical-groups", {
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `Physical group membership unavailable (${response.status})`,
    );
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload))
    throw new Error("Invalid group response");
  return validatePhysicalGroupSnapshot(payload.data);
}

export type GroupTap = { pgc: number; time: number; x: number; y: number };
export function isAtlasGroupDoubleTap(
  previous: GroupTap | null,
  next: GroupTap,
): boolean {
  return (
    previous !== null &&
    previous.pgc === next.pgc &&
    next.time >= previous.time &&
    next.time - previous.time <= 420 &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= 8
  );
}

export function atlasSceneExtent(points: readonly AtlasSpatialPoint[]): number {
  return points.reduce(
    (radius, point) => Math.max(radius, Math.hypot(...point.position)),
    0,
  );
}

/** Return every plausible overlapping PGC; never silently choose an ambiguous one. */
export function atlasMarkerHits(
  markers: readonly {
    pgc: number;
    x: number;
    y: number;
    depth: number;
    radius: number;
  }[],
  x: number,
  y: number,
): number[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  return markers
    .filter(
      (m) =>
        [m.x, m.y, m.depth, m.radius].every(Number.isFinite) &&
        m.radius >= 0 &&
        m.depth >= -1 &&
        m.depth <= 1 &&
        Math.hypot(x - m.x, y - m.y) <= m.radius,
    )
    .sort((a, b) => a.depth - b.depth || a.pgc - b.pgc)
    .map((m) => m.pgc);
}
