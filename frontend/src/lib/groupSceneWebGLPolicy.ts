import type { ScenePoint, GroupScene } from "./groupScene3d.ts";
import type { Vec3 } from "./groupGeometry3d.ts";
export {
  viewVectors,
  scaleBarUnits as scaleBarKpc,
  formatSpatialUnits as formatKpc,
  pickProjectedMarker,
  sceneFitHalfHeight,
  galaxyFitHalfHeight,
  intervalProjectedLength,
  axisLabelPlacement,
  sphereGuideVertices,
  sphereFitHalfHeight,
  type SceneView,
} from "./spatialRenderPolicy.ts";
export const INITIAL_SCENE_OPTIONS = {
  relations: false,
  individualOnly: false,
  grid: false,
  box: false,
  sphere: false,
} as const;
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
