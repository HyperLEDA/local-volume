/* LV LEDA Milestone 02 — Stage 03c */
/** Smooth screen-space *selection* contours for explicitly resolved subgroup members.
 *
 * Links are drawn exclusively along supplied parent-MD hierarchy edges. Their
 * narrow selection corridors are never dropped merely because the user zooms.
 * Other members of the parent group remain excluded. These are interface
 * footprints, not density contours, virial boundaries or dynamical claims.
 */
export type PixelGalaxy = { pgc: number; x: number; y: number };
export type SubgroupConnection = { fromPgc: number; toPgc: number };
export type SubgroupRegion = {
  outline: string;
  /** Fixed points reusable as native sky polygons. */
  rings: { x: number; y: number }[][];
  areaPx2: number;
  /** Positive tolerance is used only to avoid hover flicker at the boundary. */
  contains: (x: number, y: number, tolerance?: number) => boolean;
};

type Point = { x: number; y: number };
type Segment = { a: Point; b: Point };

function xy(p: Point): string {
  return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
const GRID = 2.5;
const MEMBER_RADIUS = 18;
const CORRIDOR_RADIUS = 9;
const FOREIGN_CLEARANCE = 15;
const MARGIN = MEMBER_RADIUS + 6;
const MAX_GRID_CELLS = 155000;

function finitePoint(point: PixelGalaxy): boolean {
  return (
    Number.isSafeInteger(point.pgc) &&
    point.pgc > 0 &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}
function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function pointSegmentDistance(
  x: number,
  y: number,
  a: Point,
  b: Point,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const norm2 = dx * dx + dy * dy;
  if (norm2 < 1e-9) return Math.hypot(x - a.x, y - a.y);
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / norm2));
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}

/** A small deterministic detour for an unrelated marker on an otherwise valid edge.
 * It preserves a connected outline without covering the foreign galaxy.
 */
function routeConnection(
  a: PixelGalaxy,
  b: PixelGalaxy,
  foreign: readonly PixelGalaxy[],
): Point[] {
  const length = distance(a, b);
  if (length < 0.01) return [a, b];
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const nx = -uy;
  const ny = ux;
  const blockers = foreign
    .flatMap((p) => {
      const axial = (p.x - a.x) * ux + (p.y - a.y) * uy;
      const normal = (p.x - a.x) * nx + (p.y - a.y) * ny;
      return axial > MARGIN &&
        axial < length - MARGIN &&
        Math.abs(normal) < FOREIGN_CLEARANCE + CORRIDOR_RADIUS + 3
        ? [{ axial, normal, p }]
        : [];
    })
    .sort((a, b) => a.axial - b.axial);
  if (!blockers.length) return [a, b];

  // Merge neighbouring obstacles into one diversion, rather than adding a
  // zig-zag around each marker. The same ordering is retained while zooming.
  const clusters: (typeof blockers)[] = [];
  for (const blocker of blockers) {
    const previous = clusters[clusters.length - 1];
    if (
      clusters.length > 0 &&
      blocker.axial - previous[previous.length - 1].axial < 68
    ) {
      previous.push(blocker);
    } else {
      clusters.push([blocker]);
    }
  }
  const routed: Point[] = [a];
  for (const cluster of clusters) {
    const lo = cluster[0].axial;
    const hi = cluster[cluster.length - 1].axial;
    const signed = cluster.reduce((sum, row) => sum + row.normal, 0);
    // Prefer the side opposite the obstacles. Exact alignments use stable PGC.
    const side =
      signed > 0.001
        ? -1
        : signed < -0.001
          ? 1
          : cluster[0].p.pgc % 2 === 0
            ? 1
            : -1;
    const offset = Math.max(
      FOREIGN_CLEARANCE + CORRIDOR_RADIUS + 11,
      ...cluster.map(
        (row) => side * row.normal + FOREIGN_CLEARANCE + CORRIDOR_RADIUS + 8,
      ),
    );
    const start = Math.max(MARGIN, lo - 34);
    const end = Math.min(length - MARGIN, hi + 34);
    if (end <= start) continue;
    routed.push(
      {
        x: a.x + ux * start + nx * side * offset,
        y: a.y + uy * start + ny * side * offset,
      },
      {
        x: a.x + ux * end + nx * side * offset,
        y: a.y + uy * end + ny * side * offset,
      },
    );
  }
  routed.push(b);
  return routed;
}

/** Smooth contours from a continuous signed-distance field (not raster cell borders). */
export function buildSubgroupRegion(
  members: readonly PixelGalaxy[],
  connections: readonly SubgroupConnection[],
  otherGalaxies: readonly PixelGalaxy[],
  width: number,
  height: number,
): SubgroupRegion | null {
  if (
    members.length < 2 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 40 ||
    height < 40 ||
    members.some((p) => !finitePoint(p))
  )
    return null;
  const byPgc = new Map(members.map((p) => [p.pgc, p]));
  if (byPgc.size !== members.length) return null;
  const foreign = otherGalaxies.filter(
    (p) => finitePoint(p) && !byPgc.has(p.pgc),
  );
  // At this zoom a foreign marker overlaps a known member: don't suggest a
  // uniquely selectable boundary when the two positions are indistinguishable.
  if (
    members.some((m) =>
      foreign.some((o) => distance(m, o) < FOREIGN_CLEARANCE + 2),
    )
  )
    return null;

  const segments: Segment[] = [];
  const allPoints: Point[] = [...members];
  const pairs = new Set<string>();
  for (const link of connections) {
    const a = byPgc.get(link.fromPgc);
    const b = byPgc.get(link.toPgc);
    if (!a || !b || a.pgc === b.pgc) continue;
    const key = [a.pgc, b.pgc].sort((x, y) => x - y).join(":");
    if (pairs.has(key)) continue;
    pairs.add(key);
    // No screen-pixel distance cutoff: valid hierarchy does not change with FoV.
    const route = routeConnection(a, b, foreign);
    allPoints.push(...route);
    for (let i = 1; i < route.length; i++) {
      segments.push({ a: route[i - 1], b: route[i] });
    }
  }

  const candidateEdges = segments.map((segment) => ({
    ...segment,
    minX: Math.min(segment.a.x, segment.b.x) - CORRIDOR_RADIUS - GRID * 2,
    maxX: Math.max(segment.a.x, segment.b.x) + CORRIDOR_RADIUS + GRID * 2,
    minY: Math.min(segment.a.y, segment.b.y) - CORRIDOR_RADIUS - GRID * 2,
    maxY: Math.max(segment.a.y, segment.b.y) + CORRIDOR_RADIUS + GRID * 2,
  }));
  function signedDistance(x: number, y: number): number {
    // We only contour the zero isoline. Large positive exterior distances are
    // irrelevant, so cheap bounding checks avoid thousands of square roots.
    let boundary = 1000;
    for (const p of members) {
      if (
        Math.abs(p.x - x) > MEMBER_RADIUS + GRID * 2 ||
        Math.abs(p.y - y) > MEMBER_RADIUS + GRID * 2
      )
        continue;
      boundary = Math.min(
        boundary,
        Math.hypot(p.x - x, p.y - y) - MEMBER_RADIUS,
      );
    }
    for (const segment of candidateEdges) {
      if (
        x < segment.minX ||
        x > segment.maxX ||
        y < segment.minY ||
        y > segment.maxY
      )
        continue;
      boundary = Math.min(
        boundary,
        pointSegmentDistance(x, y, segment.a, segment.b) - CORRIDOR_RADIUS,
      );
    }
    // Difference from foreign markers. This only modifies the shape locally.
    for (const p of foreign) {
      if (
        Math.abs(p.x - x) >= FOREIGN_CLEARANCE + GRID * 3 ||
        Math.abs(p.y - y) >= FOREIGN_CLEARANCE + GRID * 3
      )
        continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < FOREIGN_CLEARANCE + GRID * 3) {
        boundary = Math.max(boundary, FOREIGN_CLEARANCE - d);
      }
    }
    return boundary;
  }
  function contains(x: number, y: number, tolerance = 0): boolean {
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x <= width &&
      y >= 0 &&
      y <= height &&
      // Hover hysteresis may widen the edge, but can never include a foreign marker.
      !foreign.some((p) => Math.hypot(p.x - x, p.y - y) <= FOREIGN_CLEARANCE) &&
      signedDistance(x, y) <= Math.max(0, Math.min(3, tolerance))
    );
  }

  const left =
    Math.floor((Math.min(...allPoints.map((p) => p.x)) - MARGIN) / GRID) * GRID;
  const right =
    Math.ceil((Math.max(...allPoints.map((p) => p.x)) + MARGIN) / GRID) * GRID;
  const top =
    Math.floor((Math.min(...allPoints.map((p) => p.y)) - MARGIN) / GRID) * GRID;
  const bottom =
    Math.ceil((Math.max(...allPoints.map((p) => p.y)) + MARGIN) / GRID) * GRID;
  const cols = Math.ceil((right - left) / GRID);
  const rows = Math.ceil((bottom - top) / GRID);
  if (cols < 2 || rows < 2 || cols * rows > MAX_GRID_CELLS) return null;
  const stride = cols + 1;
  const values = new Float32Array((rows + 1) * stride);
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      values[y * stride + x] = signedDistance(left + x * GRID, top + y * GRID);
    }
  }
  const nodes = new Map<string, Point>();
  const neighbours = new Map<string, string[]>();
  function sample(x: number, y: number): number {
    return values[y * stride + x];
  }
  function crossing(
    key: string,
    a: Point,
    b: Point,
    fa: number,
    fb: number,
  ): string {
    if (!nodes.has(key)) {
      const t = fa === fb ? 0.5 : Math.max(0, Math.min(1, fa / (fa - fb)));
      nodes.set(key, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return key;
  }
  function join(a: string, b: string): void {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  let count = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const x0 = left + x * GRID,
        y0 = top + y * GRID;
      const f = [
        sample(x, y),
        sample(x + 1, y),
        sample(x + 1, y + 1),
        sample(x, y + 1),
      ];
      if (signedDistance(x0 + GRID / 2, y0 + GRID / 2) < 0) count++;
      const corners = [
        { x: x0, y: y0 },
        { x: x0 + GRID, y: y0 },
        { x: x0 + GRID, y: y0 + GRID },
        { x: x0, y: y0 + GRID },
      ];
      const edges: [number, number, string][] = [
        [0, 1, `h:${y}:${x}`],
        [1, 2, `v:${y}:${x + 1}`],
        [2, 3, `h:${y + 1}:${x}`],
        [3, 0, `v:${y}:${x}`],
      ];
      const hits: { edge: number; key: string }[] = [];
      for (let i = 0; i < 4; i++) {
        const [a, b, key] = edges[i];
        if (f[a] < 0 === f[b] < 0) continue;
        hits.push({
          edge: i,
          key: crossing(key, corners[a], corners[b], f[a], f[b]),
        });
      }
      if (hits.length === 2) join(hits[0].key, hits[1].key);
      if (hits.length === 4) {
        const insideTL = f[0] < 0;
        const centerInside = signedDistance(x0 + GRID / 2, y0 + GRID / 2) < 0;
        // Ambiguous diagonal saddle: preserve proper inside connectivity.
        const aroundTopLeft = insideTL !== centerInside;
        const pairs = aroundTopLeft
          ? [
              [0, 3],
              [1, 2],
            ]
          : [
              [0, 1],
              [2, 3],
            ];
        for (const [i, j] of pairs) join(hits[i].key, hits[j].key);
      }
    }
  }
  if (!count || neighbours.size === 0) return null;

  // Trace closed, interpolated isolines. Quadratic midpoint joins suppress
  // grid-orientation artifacts without changing which catalogue members exist.
  const seen = new Set<string>();
  const loops: string[] = [];
  const rings: Point[][] = [];
  for (const start of neighbours.keys()) {
    if (seen.has(start)) continue;
    const vertices: Point[] = [];
    let current = start;
    let previous: string | null = null;
    let closed = false;
    for (let guard = 0; guard <= neighbours.size; guard++) {
      const point = nodes.get(current);
      if (!point) break;
      vertices.push(point);
      seen.add(current);
      let next: string | undefined = undefined;
      for (const candidate of neighbours.get(current) ?? []) {
        if (candidate !== previous) {
          next = candidate;
          break;
        }
      }
      if (!next) break;
      if (next === start) {
        closed = true;
        break;
      }
      if (seen.has(next)) break;
      previous = current;
      current = next;
    }
    if (!closed || vertices.length < 5) continue;
    rings.push(vertices);

    const first = midpoint(vertices[vertices.length - 1], vertices[0]);
    const commands = [`M${xy(first)}`];
    for (let i = 0; i < vertices.length; i++) {
      commands.push(
        `Q${xy(vertices[i])} ${xy(midpoint(vertices[i], vertices[(i + 1) % vertices.length]))}`,
      );
    }
    commands.push("Z");
    loops.push(commands.join(" "));
  }
  return loops.length
    ? {
        outline: loops.join(" "),
        rings,
        areaPx2: count * GRID * GRID,
        contains,
      }
    : null;
}
