import { decodeAtlasCamera, type AtlasCameraState } from "./atlasSession.ts";
import type { SceneFrameMode, ViewerScene } from "./groupSceneSupergalactic.ts";
import {
  INITIAL_SCENE_OPTIONS,
  type SceneView,
} from "./groupSceneWebGLPolicy.ts";

export type GroupPreferences = {
  frameMode: SceneFrameMode;
  view: SceneView;
  selected: number | null;
  inspectorOpen: boolean;
  relations: boolean;
  individualOnly: boolean;
  grid: boolean;
  box: boolean;
  sphere: boolean;
};
const memory = new Map<string, string>();
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function read(key: string): unknown {
  try {
    return JSON.parse(
      memory.get(key) ?? sessionStorage.getItem(key) ?? "null",
    ) as unknown;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  const json = JSON.stringify(value);
  memory.set(key, json);
  try {
    sessionStorage.setItem(key, json);
  } catch {
    /* Storage unavailable: retain this tab's memory. */
  }
}
function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
export function groupSessionId(
  definition: string,
  groupId: string | number,
  root: number,
): string {
  return JSON.stringify([definition, groupId, root]);
}
export function decodeGroupPreferences(
  raw: unknown,
  allowed: ReadonlySet<number>,
  root: number,
): GroupPreferences {
  const r = record(raw);
  const selected =
    r.selected === null
      ? null
      : typeof r.selected === "number" &&
          Number.isSafeInteger(r.selected) &&
          allowed.has(r.selected)
        ? r.selected
        : allowed.has(root)
          ? root
          : null;
  const view =
    r.view === "XY" || r.view === "XZ" || r.view === "YZ" ? r.view : "orbit";
  return {
    frameMode: r.frameMode === "SUPERGALACTIC" ? "SUPERGALACTIC" : "LOCAL",
    view,
    selected,
    inspectorOpen: flag(r.inspectorOpen, true),
    relations: flag(r.relations, INITIAL_SCENE_OPTIONS.relations),
    individualOnly: flag(
      r.individualOnly,
      INITIAL_SCENE_OPTIONS.individualOnly,
    ),
    grid: flag(r.grid, INITIAL_SCENE_OPTIONS.grid),
    box: flag(r.box, INITIAL_SCENE_OPTIONS.box),
    sphere: flag(r.sphere, INITIAL_SCENE_OPTIONS.sphere),
  };
}
export function readGroupPreferences(
  id: string,
  allowed: ReadonlySet<number>,
  root: number,
) {
  return decodeGroupPreferences(
    read(`lv-leda:group-preferences:v1:${id}`),
    allowed,
    root,
  );
}
export function saveGroupPreferences(id: string, value: GroupPreferences) {
  write(`lv-leda:group-preferences:v1:${id}`, value);
}
export function groupGeometryKey(
  scene: ViewerScene,
  frame: SceneFrameMode,
): string {
  return JSON.stringify([
    frame,
    scene.status,
    scene.rootPgc,
    scene.displayExtentKpc,
    scene.points.map((point) => [
      point.pgc,
      point.kind,
      point.acceptedMember,
      point.displayPositionKpc,
    ]),
  ]);
}
export function readGroupCamera(
  id: string,
  frame: SceneFrameMode,
  geometry: string,
): AtlasCameraState | null {
  const r = record(read(`lv-leda:group-camera:v1:${id}:${frame}`));
  return r.geometry === geometry
    ? decodeAtlasCamera(r.camera, "orthographic")
    : null;
}
export function saveGroupCamera(
  id: string,
  frame: SceneFrameMode,
  geometry: string,
  camera: AtlasCameraState,
) {
  write(`lv-leda:group-camera:v1:${id}:${frame}`, { geometry, camera });
}
