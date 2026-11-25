import type { Vec3 } from "./groupGeometry3d.ts";
import type { AtlasSpatialPoint } from "./atlasSpatialScene.ts";

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
