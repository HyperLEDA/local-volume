import type { ScenePoint, GroupScene } from "./groupScene3d.ts";
import type { Vec3 } from "./groupGeometry3d.ts";
export type SceneView = "orbit" | "XY" | "XZ" | "YZ";
export const INITIAL_SCENE_OPTIONS = {
  relations: false,
  individualOnly: false,
  grid: false,
  box: false,
  sphere: false,
} as const;
export function viewVectors(view: SceneView): { position: Vec3; up: Vec3 } {
  const views: Record<SceneView, { position: Vec3; up: Vec3 }> = {
    XY: { position: [0, 0, 1], up: [0, 1, 0] },
    XZ: { position: [0, -1, 0], up: [0, 0, 1] },
    YZ: { position: [1, 0, 0], up: [0, 0, 1] },
    orbit: { position: [1.5, 1.15, 1.45], up: [0, 1, 0] },
  };
  return views[view];
}
export function visibleScenePoint(
  point: ScenePoint,
  individualOnly: boolean,
): boolean {
  return (
    point.displayPositionKpc !== null &&
    (!individualOnly || point.kind === "INDIVIDUAL_ADOPTED")
  );
}
export function sceneFrameRadius(
  scene: Pick<GroupScene, "displayExtentKpc">,
): number {
  return Math.max(1, scene.displayExtentKpc ?? 0);
}
export function schematicEdge(a: ScenePoint, b: ScenePoint): boolean {
  return a.kind !== "INDIVIDUAL_ADOPTED" || b.kind !== "INDIVIDUAL_ADOPTED";
}
export function scaleBarKpc(kpcPerPixel: number): number {
  if (!(kpcPerPixel > 0) || !Number.isFinite(kpcPerPixel)) return 0;
  const target = 110 * kpcPerPixel;
  const power = 10 ** Math.floor(Math.log10(target));
  return (target / power >= 5 ? 5 : target / power >= 2 ? 2 : 1) * power;
}
export function formatKpc(value: number): string {
  return Number(value.toPrecision(3)).toLocaleString("en-US", {
    maximumSignificantDigits: 3,
  });
}
export function pickProjectedMarker(
  markers: readonly {
    pgc: number;
    x: number;
    y: number;
    depth: number;
    radius: number;
  }[],
  x: number,
  y: number,
): number | null {
  let best: { pgc: number; distance: number; depth: number } | null = null;
  for (const marker of markers) {
    const distance = Math.hypot(x - marker.x, y - marker.y);
    if (distance > marker.radius || marker.depth < -1 || marker.depth > 1)
      continue;
    if (
      best === null ||
      distance < best.distance - 0.5 ||
      (Math.abs(distance - best.distance) <= 0.5 && marker.depth < best.depth)
    )
      best = { pgc: marker.pgc, distance, depth: marker.depth };
  }
  return best?.pgc ?? null;
}

// Display-only framing: keep equal kpc per pixel on every axis and reserve
// a margin for the labels. Never rescale the coordinates themselves.
export function sceneFitHalfHeight(
  projected: readonly Vec3[],
  aspect: number,
): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  let extent = 1;
  for (const [x, y] of projected) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    extent = Math.max(extent, Math.abs(y), Math.abs(x) / safeAspect);
  }
  return extent * 1.16;
}

export function frameHalfSpans(
  points: readonly Pick<ScenePoint, "displayPositionKpc">[],
  step: number,
): Vec3 {
  const spacing = Number.isFinite(step) && step > 0 ? step : 1;
  let x = spacing,
    y = spacing,
    z = spacing;
  for (const point of points) {
    const pos = point.displayPositionKpc;
    if (!pos) continue;
    x = Math.max(x, Math.abs(pos[0]));
    y = Math.max(y, Math.abs(pos[1]));
    z = Math.max(z, Math.abs(pos[2]));
  }
  return [
    Math.ceil(x / spacing) * spacing,
    Math.ceil(y / spacing) * spacing,
    Math.ceil(z / spacing) * spacing,
  ];
}

// Fit the visible galaxy positions, not the corners of the guide frame.
export function galaxyFitHalfHeight(
  projected: readonly Vec3[],
  aspect: number,
): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  let extent = 1;
  for (const [x, y] of projected) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    extent = Math.max(extent, Math.abs(y), Math.abs(x) / safeAspect);
  }
  return extent * 1.12;
}

// Screen-space resolution only; the true interval is never enlarged.
export function intervalProjectedLength(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Clip a projected positive coordinate axis against an inset viewport.
// The fraction refers to the original physical axis, not a stretched line.
export function axisLabelPlacement(
  origin: { x: number; y: number },
  end: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number; fraction: number } | null {
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  if (
    ![origin.x, origin.y, end.x, end.y, width, height].every(Number.isFinite) ||
    width < 40 ||
    height < 40 ||
    Math.hypot(dx, dy) < 12
  )
    return null;
  const inset = 16;
  let lower = 0;
  let upper = 1;
  for (const [start, delta, maximum] of [
    [origin.x, dx, width],
    [origin.y, dy, height],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < inset || start > maximum - inset) return null;
      continue;
    }
    const a = (inset - start) / delta;
    const b = (maximum - inset - start) / delta;
    lower = Math.max(lower, Math.min(a, b));
    upper = Math.min(upper, Math.max(a, b));
    if (lower > upper) return null;
  }
  if ((upper - lower) * Math.hypot(dx, dy) < 12) return null;
  return {
    x: origin.x + upper * dx,
    y: origin.y + upper * dy,
    fraction: upper,
  };
}

// A display-only sphere enclosing every existing positioned marker. No radius
// is invented for an empty scene or a scene containing only the centre.
export function sphereGuideRadius(
  points: readonly Pick<ScenePoint, "displayPositionKpc">[],
): number {
  let radius = 0;
  for (const point of points) {
    const position = point.displayPositionKpc;
    if (position === null || !position.every(Number.isFinite)) continue;
    radius = Math.max(radius, Math.hypot(...position));
  }
  return radius;
}

// Six smooth rings in one LineSegments geometry: three meridians, equator,
// and two parallels. Coordinates are in the same kpc basis as the markers.
export function sphereGuideVertices(radius: number): Vec3[] {
  if (!Number.isFinite(radius) || radius <= 0) return [];
  const vertices: Vec3[] = [];
  const segments = 64;
  function appendCircle(pointAt: (angle: number) => Vec3): void {
    for (let index = 0; index < segments; index += 1) {
      vertices.push(
        pointAt((2 * Math.PI * index) / segments),
        pointAt((2 * Math.PI * (index + 1)) / segments),
      );
    }
  }
  for (const longitude of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    appendCircle((angle) => [
      radius * Math.cos(angle) * Math.cos(longitude),
      radius * Math.cos(angle) * Math.sin(longitude),
      radius * Math.sin(angle),
    ]);
  }
  for (const latitude of [-Math.PI / 4, 0, Math.PI / 4]) {
    const ring = radius * Math.cos(latitude);
    const z = radius * Math.sin(latitude);
    appendCircle((angle) => [
      ring * Math.cos(angle),
      ring * Math.sin(angle),
      z,
    ]);
  }
  return vertices;
}

export function sphereFitHalfHeight(radius: number, aspect: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return (1.12 * radius) / Math.min(1, safeAspect);
}
