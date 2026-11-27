import type { Vec3 } from "./groupGeometry3d.ts";
import type {
  AtlasGroupBubble,
  AtlasSpatialPoint,
  AtlasSpatialRow,
} from "./atlasSpatialScene.ts";

export type AtlasLayers = { groups: boolean; field: boolean; md: boolean };
export const DEFAULT_ATLAS_LAYERS: AtlasLayers = {
  groups: true,
  field: true,
  md: false,
};

export function atlasLayerVisible(
  group: boolean,
  groupedMode: boolean,
  layers: AtlasLayers,
): boolean {
  return !groupedMode || (group ? layers.groups : layers.field);
}

export type AtlasMdEdge = {
  memberPgc: number;
  mdPgc: number;
  from: Vec3;
  to: Vec3;
};

/** Source-native directed MD identifiers, never substitute the group root or infer proximity. */
export function atlasMdEdges(
  points: readonly AtlasSpatialPoint[],
): AtlasMdEdge[] {
  const counts = new Map<number, number>();
  for (const p of points)
    counts.set(p.object.pgc, (counts.get(p.object.pgc) ?? 0) + 1);
  const byPgc = new Map(
    points
      .filter(
        (p) =>
          p.kind === "individual" &&
          counts.get(p.object.pgc) === 1 &&
          p.position.every(Number.isFinite),
      )
      .map((p) => [p.object.pgc, p]),
  );
  const edges: AtlasMdEdge[] = [];
  for (const [pgc, point] of byPgc) {
    const md = point.object.md_pgc;
    if (
      typeof md !== "number" ||
      !Number.isSafeInteger(md) ||
      md <= 0 ||
      md === pgc
    )
      continue;
    const target = byPgc.get(md);
    if (!target) continue;
    edges.push({
      memberPgc: pgc,
      mdPgc: md,
      from: point.position,
      to: target.position,
    });
  }
  return edges;
}

/** Extra nominal MW centre endpoint for the MD presentation layer only.
 * Do not insert it into the extragalactic sample or use the envelope radius
 * as a distance criterion. Preserve actual directed catalogue MD identifiers.
 */
export function atlasMwMdEdges(
  points: readonly AtlasSpatialPoint[],
  rows: readonly AtlasSpatialRow[],
  bubble: AtlasGroupBubble | null,
): AtlasMdEdge[] {
  const mw = 5064336;
  if (
    !bubble ||
    bubble.pgc !== mw ||
    bubble.radiusSampleCount === undefined ||
    !bubble.position.every(Number.isFinite)
  )
    return [];
  const roots = rows.filter((row) => row.object.pgc === mw);
  if (roots.length !== 1) return [];
  const root = roots[0];
  const evidence = root.evidence;
  if (
    !evidence ||
    evidence.pgc !== mw ||
    ["HOLD", "STALE", "BLOCKED"].includes(
      evidence.distance_value_review_status ?? "",
    ) ||
    typeof evidence.distance_formula_version !== "string" ||
    typeof evidence.distance_computed_revision !== "number"
  )
    return [];
  const counts = new Map<number, number>();
  for (const point of points)
    counts.set(point.object.pgc, (counts.get(point.object.pgc) ?? 0) + 1);
  const edges: AtlasMdEdge[] = [];
  for (const point of points) {
    const pgc = point.object.pgc;
    if (
      pgc === mw ||
      !Number.isSafeInteger(pgc) ||
      pgc <= 0 ||
      counts.get(pgc) !== 1 ||
      point.kind !== "individual" ||
      !point.position.every(Number.isFinite) ||
      point.evidence?.pgc !== pgc ||
      point.evidence.distance_lineage_status !== "REVIEW_READY" ||
      !["VERIFIED", "NOT_REVIEWED"].includes(
        point.evidence.distance_value_review_status ?? "",
      ) ||
      point.evidence.distance_formula_version !==
        evidence.distance_formula_version ||
      point.evidence.distance_computed_revision !==
        evidence.distance_computed_revision
    )
      continue;
    if (point.object.md_pgc === mw)
      edges.push({
        memberPgc: pgc,
        mdPgc: mw,
        from: point.position,
        to: bubble.position,
      });
    if (root.object.md_pgc === pgc)
      edges.push({
        memberPgc: mw,
        mdPgc: pgc,
        from: bubble.position,
        to: point.position,
      });
  }
  return edges;
}
