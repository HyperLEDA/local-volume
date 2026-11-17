/** Trim sky-coordinate links at actual rendered marker boundaries. */
export type SkyVertex = [number, number];
type ScreenPoint = readonly [number, number] | null | undefined;
export type SkyProjector = (ra: number, dec: number) => ScreenPoint;
const DEG = Math.PI / 180;

function positionOnArc(a: SkyVertex, b: SkyVertex, t: number): SkyVertex {
  function vector([ra, dec]: SkyVertex): [number, number, number] {
    const longitude = ra * DEG;
    const latitude = dec * DEG;
    return [
      Math.cos(latitude) * Math.cos(longitude),
      Math.cos(latitude) * Math.sin(longitude),
      Math.sin(latitude),
    ];
  }
  const u = vector(a);
  const v = vector(b);
  const dot = Math.max(
    -1,
    Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]),
  );
  const omega = Math.acos(dot);
  if (omega < 1e-9 || Math.PI - omega < 1e-8) return a;
  const sine = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sine;
  const wb = Math.sin(t * omega) / sine;
  const x = wa * u[0] + wb * v[0];
  const y = wa * u[1] + wb * v[1];
  const z = wa * u[2] + wb * v[2];
  return [
    (((Math.atan2(y, x) / DEG) % 360) + 360) % 360,
    Math.atan2(z, Math.hypot(x, y)) / DEG,
  ];
}

function screenDistance(a: ScreenPoint, b: ScreenPoint): number | null {
  if (!a || !b || ![...a, ...b].every(Number.isFinite)) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function endFraction(
  start: SkyVertex,
  finish: SkyVertex,
  pixels: number,
  project: SkyProjector,
): number {
  const startScreen = project(...start);
  if (!startScreen || ![...startScreen].every(Number.isFinite)) return 0;
  if (!Number.isFinite(pixels) || pixels <= 0) return 0;
  let low = 0;
  let high = 1;
  let reached = false;
  for (const fraction of [
    1 / 128,
    1 / 64,
    1 / 32,
    1 / 16,
    1 / 8,
    1 / 4,
    1 / 2,
    1,
  ]) {
    const position = positionOnArc(start, finish, fraction);
    const distance = screenDistance(startScreen, project(...position));
    if (distance === null || distance >= pixels) {
      high = fraction;
      reached = true;
      break;
    }
    low = fraction;
  }
  if (!reached) return 1;
  for (let step = 0; step < 14; step++) {
    const middle = (low + high) / 2;
    const position = positionOnArc(start, finish, middle);
    const distance = screenDistance(startScreen, project(...position));
    if (distance === null || distance >= pixels) high = middle;
    else low = middle;
  }
  return high;
}

/** Off-projection ends remain in the sky path, allowing Aladin to clip at the frame. */
export function trimGroupEdge(
  vertices: readonly SkyVertex[],
  sourceRadiusPx: number,
  targetRadiusPx: number,
  project: SkyProjector,
): SkyVertex[] {
  if (vertices.length < 2) return [];
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const gapPx = 1.5;
  const start = endFraction(first, last, sourceRadiusPx + gapPx, project);
  const end = 1 - endFraction(last, first, targetRadiusPx + gapPx, project);
  if (end <= start + 1e-6) return [];
  const trimmed: SkyVertex[] = [positionOnArc(first, last, start)];
  const denominator = vertices.length - 1;
  for (let i = 1; i < denominator; i++) {
    const portion = i / denominator;
    if (portion > start && portion < end) trimmed.push(vertices[i]);
  }
  trimmed.push(positionOnArc(first, last, end));
  return trimmed;
}
