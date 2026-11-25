import * as THREE from "three";
import {
  composeSpatialImage,
  spatialExportRatio,
  withSpatialExportRatio,
  type SpatialExportLine,
} from "./spatialImageExport.ts";
import {
  ATLAS_SHELL_RADII,
  atlasShellSegments,
  atlasSupergalacticNormal,
  type AtlasGuides,
} from "./atlasSpatialGuides.ts";
import { sliceGuideSegments, type AtlasSlice } from "./atlasSpatialSlice.ts";
import { regionGuideSegments, type AtlasRegion } from "./atlasSpatialRegion.ts";
import type { ObserverFrame } from "./spatialFrames.ts";
import type { AtlasCameraState } from "./atlasSession.ts";
import {
  atlasLayerVisible,
  type AtlasLayers,
  type AtlasMdEdge,
} from "./atlasScientificLayers.ts";
import {
  bindSpatialKeyboard,
  panSpatialCamera,
  spatialPointerMoved,
} from "./spatialKeyboard.ts";
import type {
  AtlasGroupBubble,
  AtlasKind,
  AtlasSpatialPoint,
  GroupTap,
} from "./atlasSpatialScene.ts";
import {
  atlasMarkerHits,
  atlasSceneExtent,
  isAtlasGroupDoubleTap,
} from "./atlasSpatialScene.ts";
import {
  atlasColorForPgc,
  type AtlasColorEncoding,
} from "./atlasColorEncoding.ts";
import {
  atlasMarkerDiameter,
  atlasMarkerHitRadius,
  atlasMarkerHaloDiameter,
  type AtlasSizeMode,
  type AtlasMarkerDensity,
} from "./atlasMarkerSize.ts";
import type {
  AtlasDistanceInterval,
  AtlasIntervalMode,
} from "./atlasDistanceIntervals.ts";
import { atlasFlightProgress, atlasFlightScale } from "./atlasCameraFlight.ts";
import { morphologyColor } from "./morphologyColors.ts";
import {
  createFrameScheduler,
  formatSpatialUnits,
  scaleBarUnits,
  viewVectors,
  type SceneView,
} from "./spatialRenderPolicy.ts";
import {
  createMarkerTexture,
  createSpatialOrbitControls,
  createSpatialRenderer,
  orthographicPixelsPerUnit,
  projectSpatialPoint,
  setOrthographicFrame,
  type SpatialMarkerKind,
} from "./spatialThreePrimitives.ts";

export type AtlasRenderColor = AtlasColorEncoding & {
  comparisonColors?: ReadonlyMap<number, string>;
};
export type AtlasProjection = "orthographic" | "perspective";
export type AtlasTheme = "dark" | "light";
export type AtlasDisplayMode = "galaxies" | "groups";
export type AtlasRenderOptions = {
  projection: AtlasProjection;
  slice?: AtlasSlice | null;
  region?: AtlasRegion | null;
  referenceExtent?: number;
  cameraState?: AtlasCameraState | null;
  theme: AtlasTheme;
  color: AtlasRenderColor;
  sizeMode: AtlasSizeMode;
  markerDensity: AtlasMarkerDensity;
  grid: boolean;
  frame: ObserverFrame;
  guides: AtlasGuides;
  intervalMode: AtlasIntervalMode;
  intervals: readonly AtlasDistanceInterval[];
  axes: readonly [string, string, string];
  displayMode: AtlasDisplayMode;
  layers: AtlasLayers;
  mdEdges: readonly AtlasMdEdge[];
};
const KINDS: Record<AtlasKind, SpatialMarkerKind> = {
  individual: "INDIVIDUAL_ADOPTED",
  assigned: "ASSIGNED_PROJECTION",
  model: "MODEL_ESTIMATE",
  unknown: "UNCLASSIFIED_ESTIMATE",
};
const AXIS_COLORS = ["#c17d72", "#519b80", "#658ac4"];

type GroupNode = {
  bubble: AtlasGroupBubble;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
  material: THREE.MeshPhongMaterial;
};

type TargetDatum = { position: THREE.Vector3; radius: number };

function bubbleNeutralColor(theme: AtlasTheme) {
  return theme === "dark" ? "#76a4de" : "#517eb8";
}

function groupColor(
  theme: AtlasTheme,
  color: AtlasColorEncoding,
  bubble: AtlasGroupBubble,
) {
  return new THREE.Color(
    color.mode === "morphology"
      ? morphologyColor(bubble.morphologyT)
      : color.mode === "neutral"
        ? bubbleNeutralColor(theme)
        : atlasColorForPgc(color, bubble.pgc),
  );
}

export function createAtlasRenderer(
  host: HTMLDivElement,
  overlay: HTMLDivElement,
  scale: HTMLDivElement,
  points: readonly AtlasSpatialPoint[],
  groups: readonly AtlasGroupBubble[],
  initial: AtlasRenderOptions,
  onHits: (ids: number[]) => void,
  onFailure: () => void,
) {
  const renderer = createSpatialRenderer(
    initial.theme === "dark" ? 0x101820 : 0xf3f5f7,
  );
  const canvas = renderer.domElement;
  const resources: { dispose: () => void }[] = [];
  const world = new THREE.Scene();
  const displayedGroups = initial.displayMode === "groups" ? groups : [];
  const extent = Math.max(
    0.1,
    initial.referenceExtent ?? 0,
    atlasSceneExtent(points),
    displayedGroups.reduce(
      (radius, bubble) =>
        Math.max(radius, Math.hypot(...bubble.position) + bubble.radiusMpc),
      0,
    ),
  );
  const camera =
    initial.projection === "orthographic"
      ? new THREE.OrthographicCamera(
          -extent,
          extent,
          extent,
          -extent,
          extent / 10000,
          extent * 100,
        )
      : new THREE.PerspectiveCamera(40, 1, extent / 10000, extent * 100);
  let controls: ReturnType<typeof createSpatialOrbitControls> | null = null;
  let observer: ResizeObserver | null = null;
  let disposed = false;
  let width = 0,
    height = 0;
  let selected: number | null = null;
  let theme = initial.theme;
  let color = initial.color;
  let sizeMode = initial.sizeMode;
  let markerDensity = initial.markerDensity;
  const batches: {
    mesh: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    material: THREE.PointsMaterial;
    geometry: THREE.BufferGeometry;
    rows: AtlasSpatialPoint[];
  }[] = [];
  const markerTextures = new Map<AtlasKind, THREE.CanvasTexture>();
  const markerSizes = new Map<number, number>();
  const focusTargets = new Map<number, TargetDatum>();
  const axes: { position: THREE.Vector3; label: HTMLSpanElement }[] = [];
  const groupNodes: GroupNode[] = [];
  const groupMeshes = new Map<number, number>();
  const groupIds = new Set(displayedGroups.map((bubble) => bubble.pgc));
  const raycaster = new THREE.Raycaster();
  let halo: THREE.Sprite | null = null;
  let origin: THREE.Sprite | null = null;
  let grid: THREE.GridHelper | null = null;
  const guidePlane = new THREE.Group();
  const guideShells = new Map<number, THREE.LineSegments>();
  let start: { x: number; y: number; id: number } | null = null;
  let previousGroupTap: GroupTap | null = null;
  let flightFrame: number | null = null;
  let intervalMode = initial.intervalMode;
  let layers = initial.layers;
  let mdLines: THREE.LineSegments | null = null;
  const groupedMode = initial.displayMode === "groups";
  function visiblePgc(pgc: number) {
    return atlasLayerVisible(groupIds.has(pgc), groupedMode, layers);
  }
  const intervalLines: {
    quality: AtlasDistanceInterval["quality"];
    group: boolean;
    all: THREE.LineSegments;
    chosen: THREE.LineSegments;
  }[] = [];
  function own<T extends { dispose: () => void }>(resource: T): T {
    resources.push(resource);
    return resource;
  }
  function markerColor(point: AtlasSpatialPoint): THREE.Color {
    return new THREE.Color(
      color.comparisonColors?.get(point.object.pgc) ??
        (color.mode === "morphology"
          ? morphologyColor(point.object.morphology_t)
          : color.mode === "neutral"
            ? theme === "dark"
              ? "#c5d2da"
              : "#435365"
            : atlasColorForPgc(color, point.object.pgc)),
    );
  }
  function updateIntervals() {
    const selectedPgc = selected;
    for (const layer of intervalLines) {
      const interval = initial.intervals.find(
        (entry) =>
          entry.pgc === selectedPgc &&
          entry.quality === layer.quality &&
          groupIds.has(entry.pgc) === layer.group,
      );
      const visible = atlasLayerVisible(layer.group, groupedMode, layers);
      layer.all.visible = visible && intervalMode === "all";
      layer.chosen.visible =
        visible && intervalMode === "selected" && interval !== undefined;
      if (interval) {
        const positions = layer.chosen.geometry.getAttribute("position");
        positions.setXYZ(0, ...interval.lower);
        positions.setXYZ(1, ...interval.upper);
        positions.needsUpdate = true;
        layer.chosen.geometry.computeBoundingSphere();
      }
    }
  }
  function recolor() {
    for (const batch of batches) {
      const colors = batch.geometry.getAttribute("color");
      batch.rows.forEach((row, i) => {
        const c = markerColor(row);
        colors.setXYZ(i, c.r, c.g, c.b);
      });
      colors.needsUpdate = true;
    }
    for (const node of groupNodes)
      node.material.color.copy(groupColor(theme, color, node.bubble));
    if (origin)
      origin.material.color.set(theme === "dark" ? "#f1f4f8" : "#18252e");
    if (halo) halo.material.color.set(theme === "dark" ? "#f5df9e" : "#825500");
  }
  function clearMarkerBatches() {
    for (const batch of batches) {
      world.remove(batch.mesh);
      batch.geometry.dispose();
      batch.material.dispose();
    }
    batches.length = 0;
    markerSizes.clear();
  }
  function rebuildMarkers() {
    clearMarkerBatches();
    // One shared texture per shape; a small number of integer-size GPU batches.
    for (const kind of Object.keys(KINDS) as AtlasKind[]) {
      const buckets = new Map<number, AtlasSpatialPoint[]>();
      for (const point of points) {
        if (point.kind !== kind) continue;
        const diameter = atlasMarkerDiameter(
          sizeMode,
          markerDensity,
          point.object.abs_b_mag,
        );
        markerSizes.set(point.object.pgc, diameter);
        const bucket = buckets.get(diameter);
        if (bucket) bucket.push(point);
        else buckets.set(diameter, [point]);
      }
      if (!buckets.size) continue;
      let texture = markerTextures.get(kind);
      if (!texture) {
        texture = own(createMarkerTexture(KINDS[kind]));
        markerTextures.set(kind, texture);
      }
      for (const [diameter, rows] of buckets) {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.PointsMaterial({
          map: texture,
          size: diameter,
          sizeAttenuation: false,
          vertexColors: true,
          alphaTest: 0.25,
          transparent: false,
          toneMapped: false,
        });
        const mesh = new THREE.Points(geometry, material);
        batches.push({ mesh, material, geometry, rows });
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            rows.flatMap((p) => [...p.position]),
            3,
          ),
        );
        geometry.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(
            new Float32Array(rows.length * 3),
            3,
          ),
        );
        mesh.visible = atlasLayerVisible(false, groupedMode, layers);
        world.add(mesh);
      }
    }
    recolor();
  }
  function unitsPerPixelAt(position: THREE.Vector3) {
    const depth = -position.clone().applyMatrix4(camera.matrixWorldInverse).z;
    return camera instanceof THREE.OrthographicCamera
      ? 1 / orthographicPixelsPerUnit(camera, height)
      : (2 *
          Math.max(0, depth) *
          Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2)) /
          height;
  }
  function groupRadiusPixels(node: GroupNode) {
    const unitsPerPixel = unitsPerPixelAt(node.mesh.position);
    return unitsPerPixel > 0 ? node.bubble.radiusMpc / unitsPerPixel : 0;
  }
  function draw() {
    if (disposed || width <= 0 || height <= 0) return;
    camera.updateMatrixWorld();
    if (halo) {
      const node = groupNodes.find((group) => group.bubble.pgc === selected);
      const target =
        selected === null || !visiblePgc(selected)
          ? undefined
          : focusTargets.get(selected);
      halo.visible = target !== undefined && node === undefined;
      if (target && !node) {
        halo.position.copy(target.position);
        const unitsPerPixel = unitsPerPixelAt(target.position);
        halo.visible = unitsPerPixel > 0;
        halo.scale.setScalar(
          atlasMarkerHaloDiameter(
            selected === null ? 6 : (markerSizes.get(selected) ?? 6),
          ) * unitsPerPixel,
        );
      }
      for (const group of groupNodes) {
        const active = group.bubble.pgc === selected;
        group.material.emissive.set(
          active ? (theme === "dark" ? "#9b7938" : "#77531a") : "#000000",
        );
        group.material.opacity = active ? 0.65 : 0.38;
      }
    }
    if (origin) {
      const unitsPerPixel = unitsPerPixelAt(origin.position);
      origin.visible = unitsPerPixel > 0;
      origin.scale.setScalar(8 * unitsPerPixel);
    }
    renderer.render(world, camera);
    for (const axis of axes) {
      const p = projectSpatialPoint(axis.position, camera, width, height);
      axis.label.hidden =
        p.depth < -1 ||
        p.depth > 1 ||
        p.x < 8 ||
        p.x > width - 36 ||
        p.y < 12 ||
        p.y > height - 20;
      axis.label.style.transform = `translate(${p.x + 3}px, ${p.y - 8}px)`;
    }
    scale.style.borderBottomStyle =
      camera instanceof THREE.OrthographicCamera ? "solid" : "none";
    if (camera instanceof THREE.OrthographicCamera) {
      const pixels = orthographicPixelsPerUnit(camera, height);
      const bar = scaleBarUnits(1 / pixels);
      scale.textContent = `${formatSpatialUnits(bar)} Mpc`;
      scale.style.width = `${bar * pixels}px`;
    } else {
      scale.textContent = "Perspective · scale varies with depth";
      scale.style.width = "auto";
    }
  }
  function exportImage(
    legend: readonly SpatialExportLine[],
  ): HTMLCanvasElement {
    if (disposed || width <= 0 || height <= 0 || controls === null)
      throw new Error("Spatial scene unavailable");
    const gl = renderer.getContext();
    if (gl.isContextLost()) throw new Error("WebGL context unavailable");
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const limit = Math.min(
      viewport[0],
      viewport[1],
      Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)),
      renderer.capabilities.maxTextureSize,
    );
    const ratio = spatialExportRatio(width, height, limit);
    try {
      return withSpatialExportRatio(renderer, ratio, () => {
        draw();
        if (gl.isContextLost())
          throw new Error("WebGL context lost during export");
        return composeSpatialImage(
          canvas,
          width,
          height,
          theme,
          legend,
          (context) => {
            context.font = "600 13px sans-serif";
            for (const axis of axes) {
              if (axis.label.hidden) continue;
              const p = projectSpatialPoint(
                axis.position,
                camera,
                width,
                height,
              );
              context.fillStyle = axis.label.style.color;
              context.fillText(axis.label.textContent, p.x + 3, p.y - 8);
            }
            context.font = "12px sans-serif";
            context.fillStyle = theme === "dark" ? "#e7edf2" : "#273341";
            if (camera instanceof THREE.OrthographicCamera) {
              const pixels = orthographicPixelsPerUnit(camera, height);
              const bar = scaleBarUnits(1 / pixels);
              const length = bar * pixels;
              if (Number.isFinite(length) && length > 0) {
                context.fillText(
                  `${formatSpatialUnits(bar)} Mpc`,
                  12,
                  height - 30,
                );
                context.strokeStyle = context.fillStyle;
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(12, height - 12);
                context.lineTo(12 + length, height - 12);
                context.stroke();
              }
            } else {
              context.fillText(
                "Perspective · scale varies with depth",
                12,
                height - 24,
              );
            }
          },
        );
      });
    } finally {
      draw();
    }
  }
  const scheduler = createFrameScheduler(draw);

  function schedule() {
    scheduler.schedule();
  }

  function stopFlight() {
    if (flightFrame !== null) cancelAnimationFrame(flightFrame);
    flightFrame = null;
  }
  function setupControls(target: THREE.Vector3) {
    controls = createSpatialOrbitControls(camera, canvas);
    controls.minDistance = extent / 10000;
    controls.maxDistance = extent * 80;
    controls.target.copy(target);
    controls.update();
    controls.addEventListener("change", schedule);
    controls.addEventListener("start", stopFlight);
    schedule();
  }
  function restoreCamera(saved: AtlasCameraState) {
    stopFlight();
    controls?.dispose();
    camera.up.set(...saved.up).normalize();
    camera.position.set(...saved.position);
    camera.zoom = saved.zoom;
    const aspect = width / height;
    if (
      camera instanceof THREE.OrthographicCamera &&
      saved.halfHeight !== null
    ) {
      setOrthographicFrame(camera, saved.halfHeight, aspect);
    } else if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    const target = new THREE.Vector3(...saved.target);
    camera.lookAt(target);
    setupControls(target);
  }
  function captureCamera(): AtlasCameraState | null {
    if (disposed || !controls || width <= 0 || height <= 0) return null;
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
      zoom: camera.zoom,
      halfHeight:
        camera instanceof THREE.OrthographicCamera ? camera.top : null,
    };
  }
  function fit(view: SceneView, target = new THREE.Vector3(), radius = extent) {
    stopFlight();
    controls?.dispose();
    const vectors = viewVectors(view);
    const direction = new THREE.Vector3(...vectors.position).normalize();
    camera.up.set(...vectors.up);
    camera.zoom = 1;
    const aspect = width > 0 && height > 0 ? width / height : 1;
    const span = radius * 1.14;
    if (camera instanceof THREE.OrthographicCamera) {
      setOrthographicFrame(camera, span / Math.min(1, aspect), aspect);
      camera.position.copy(target).addScaledVector(direction, extent * 4);
    } else {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const halfAngle = Math.atan(
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
          Math.min(1, aspect),
      );
      camera.position
        .copy(target)
        .addScaledVector(direction, span / Math.sin(halfAngle));
    }
    camera.lookAt(target);
    setupControls(target);
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    if (
      rect.width < 1 ||
      rect.height < 1 ||
      (width === rect.width && height === rect.height)
    )
      return;
    stopFlight();
    const first = width === 0;
    width = rect.width;
    height = rect.height;
    renderer.setSize(width, height, false);
    if (first) {
      if (initial.cameraState) restoreCamera(initial.cameraState);
      else fit("XY");
    } else if (camera instanceof THREE.OrthographicCamera)
      setOrthographicFrame(camera, camera.top, width / height);
    else {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    schedule();
  }
  function focus(pgc: number) {
    const target = focusTargets.get(pgc);
    if (
      !target ||
      !visiblePgc(pgc) ||
      !controls ||
      disposed ||
      width <= 0 ||
      height <= 0
    )
      return;
    const orbit = controls;
    const destination = target.position.clone();
    stopFlight();
    // Retain the user's current viewing direction, including canonical views.
    const fromTarget = orbit.target.clone();
    const direction = camera.position.clone().sub(fromTarget).normalize();
    const fromDistance = camera.position.distanceTo(fromTarget);
    if (!(fromDistance > 0)) return;
    const aspect = width / height;
    const span = target.radius * 1.14;
    const orthographic = camera instanceof THREE.OrthographicCamera;
    const fromScale = orthographic ? camera.top / camera.zoom : fromDistance;
    const toScale =
      camera instanceof THREE.OrthographicCamera
        ? span / Math.min(1, aspect)
        : span /
          Math.sin(
            Math.atan(
              Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2) *
                Math.min(1, aspect),
            ),
          );
    if (!(
      fromScale > 0 &&
      toScale > 0 &&
      Number.isFinite(fromScale) &&
      Number.isFinite(toScale)
    ))
      return;
    const began = performance.now();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    function advance(now: number) {
      flightFrame = null;
      if (disposed || controls !== orbit) return;
      const progress = reducedMotion ? 1 : atlasFlightProgress(now - began);
      const scaleValue = atlasFlightScale(fromScale, toScale, progress);
      orbit.target.lerpVectors(fromTarget, destination, progress);
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = 1;
        setOrthographicFrame(camera, scaleValue, aspect);
        camera.position
          .copy(orbit.target)
          .addScaledVector(direction, fromDistance);
      } else {
        camera.position
          .copy(orbit.target)
          .addScaledVector(direction, scaleValue);
      }
      orbit.update();
      schedule();
      if (progress < 1) flightFrame = requestAnimationFrame(advance);
    }
    if (reducedMotion) advance(began);
    else flightFrame = requestAnimationFrame(advance);
  }
  const keyboard = bindSpatialKeyboard(canvas, {
    move(x, y, seconds, fast) {
      if (disposed || !controls) return;
      stopFlight();
      panSpatialCamera(camera, controls.target, x, y, seconds, fast);
      controls.update();
      schedule();
    },
    focus() {
      if (selected !== null) focus(selected);
    },
  });
  function down(e: PointerEvent) {
    stopFlight();
    keyboard.stop();
    if (e.isPrimary) canvas.focus({ preventScroll: true });
    if (!e.isPrimary) previousGroupTap = null;
    start =
      e.isPrimary && e.button === 0
        ? { x: e.clientX, y: e.clientY, id: e.pointerId }
        : null;
  }
  function moved(e: PointerEvent) {
    if (start && spatialPointerMoved(start, e)) {
      start = null;
      previousGroupTap = null;
    }
  }
  function cancel() {
    stopFlight();
    start = null;
    previousGroupTap = null;
  }
  function up(e: PointerEvent) {
    const from = start;
    start = null;
    if (
      !from ||
      from.id !== e.pointerId ||
      Math.hypot(e.clientX - from.x, e.clientY - from.y) > 5
    ) {
      previousGroupTap = null;
      return;
    }
    camera.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const projected = [...focusTargets]
      .filter(([pgc]) => !groupIds.has(pgc) && visiblePgc(pgc))
      .map(([pgc, target]) => ({
        pgc,
        ...projectSpatialPoint(target.position, camera, width, height),
        radius: atlasMarkerHitRadius(markerSizes.get(pgc) ?? 6),
      }));
    const ids = atlasMarkerHits(projected, x, y);
    if (layers.groups && groupNodes.length && width > 0 && height > 0) {
      world.updateMatrixWorld(true);
      raycaster.near = camera.near;
      raycaster.far = camera.far;
      raycaster.setFromCamera(
        new THREE.Vector2((2 * x) / width - 1, 1 - (2 * y) / height),
        camera,
      );
      for (const hit of raycaster.intersectObjects(
        groupNodes.map((node) => node.mesh),
        false,
      )) {
        const pgc = groupMeshes.get(hit.object.id);
        if (pgc !== undefined && !ids.includes(pgc)) ids.push(pgc);
      }
      // Tiny spheres retain an accessible hit target without changing their geometry.
      const tiny = groupNodes
        .filter((node) => groupRadiusPixels(node) < 5)
        .map((node) => ({
          pgc: node.bubble.pgc,
          ...projectSpatialPoint(node.mesh.position, camera, width, height),
          radius: 5,
        }));
      for (const pgc of atlasMarkerHits(tiny, x, y))
        if (!ids.includes(pgc)) ids.push(pgc);
    }
    onHits(ids);
    if (ids.length !== 1) {
      previousGroupTap = null;
      return;
    }
    const tap = { pgc: ids[0], time: e.timeStamp, x: e.clientX, y: e.clientY };
    if (isAtlasGroupDoubleTap(previousGroupTap, tap)) {
      previousGroupTap = null;
      focus(tap.pgc);
    } else previousGroupTap = tap;
  }
  function lost(e: Event) {
    e.preventDefault();
    keyboard.dispose();
    stopFlight();
    scheduler.dispose();
    onFailure();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    keyboard.dispose();
    stopFlight();
    scheduler.dispose();
    observer?.disconnect();
    controls?.dispose();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointermove", moved);
    canvas.removeEventListener("wheel", stopFlight, true);
    canvas.removeEventListener("pointercancel", cancel);
    canvas.removeEventListener("webglcontextlost", lost);
    clearMarkerBatches();
    markerTextures.clear();
    resources.forEach((r) => r.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    overlay.replaceChildren();
  }
  try {
    canvas.setAttribute(
      "aria-label",
      initial.displayMode === "groups"
        ? "Interactive physical groups and field galaxies"
        : "Interactive Local Volume spatial positions",
    );
    canvas.setAttribute("role", "img");
    host.appendChild(canvas);
    if (displayedGroups.length) {
      const geometry = own(new THREE.SphereGeometry(1, 40, 24));
      world.add(new THREE.AmbientLight(0xffffff, 1.0));
      const light = new THREE.DirectionalLight(0xffffff, 2.0);
      light.position.set(-1, 2, 3);
      world.add(light);
      for (const bubble of displayedGroups) {
        const material = own(
          new THREE.MeshPhongMaterial({
            color: groupColor(theme, color, bubble),
            specular: 0x9bb3c8,
            shininess: 32,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
            depthTest: true,
            side: THREE.FrontSide,
            toneMapped: false,
          }),
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...bubble.position);
        mesh.scale.setScalar(bubble.radiusMpc);
        mesh.visible = layers.groups;
        world.add(mesh);
        groupMeshes.set(mesh.id, bubble.pgc);
        focusTargets.set(bubble.pgc, {
          position: new THREE.Vector3(...bubble.position),
          radius: Math.max(bubble.radiusMpc * 3, 1.2),
        });
        groupNodes.push({ bubble, mesh, material });
      }
    }
    for (const row of points)
      focusTargets.set(row.object.pgc, {
        position: new THREE.Vector3(...row.position),
        radius: extent / 5,
      });
    rebuildMarkers();
    if (!groupedMode && initial.mdEdges.length) {
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          initial.mdEdges.flatMap((edge) => [...edge.from, ...edge.to]),
          3,
        ),
      );
      const material = own(
        new THREE.LineBasicMaterial({
          color: 0x7297aa,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      mdLines = new THREE.LineSegments(geometry, material);
      mdLines.visible = layers.md;
      world.add(mdLines);
    }
    for (const quality of ["verified", "catalogue"] as const) {
      for (const group of [false, true]) {
        const material = own(
          new THREE.LineBasicMaterial({
            color: quality === "verified" ? "#46bfac" : "#ba9b65",
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            depthTest: true,
            toneMapped: false,
          }),
        );
        const geometry = own(new THREE.BufferGeometry());
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            initial.intervals
              .filter(
                (entry) =>
                  entry.quality === quality &&
                  groupIds.has(entry.pgc) === group,
              )
              .flatMap((entry) => [...entry.lower, ...entry.upper]),
            3,
          ),
        );
        const all = new THREE.LineSegments(geometry, material);
        const chosenGeometry = own(new THREE.BufferGeometry());
        chosenGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(new Float32Array(6), 3),
        );
        const chosen = new THREE.LineSegments(chosenGeometry, material);
        world.add(all, chosen);
        intervalLines.push({ quality, group, all, chosen });
      }
    }
    updateIntervals();
    const haloTexture = own(createMarkerTexture("halo"));
    halo = new THREE.Sprite(
      own(
        new THREE.SpriteMaterial({
          map: haloTexture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        }),
      ),
    );
    halo.visible = false;
    halo.renderOrder = 20;
    world.add(halo);
    origin = new THREE.Sprite(
      own(
        new THREE.SpriteMaterial({
          map: haloTexture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      ),
    );
    world.add(origin);
    // A coordinate ruler in the XY plane, not a density field or a physical boundary.
    const spacing =
      extent <= 12
        ? 2
        : extent <= 30
          ? 5
          : Math.max(10, Math.ceil(extent / 50) * 5);
    if (extent >= spacing) {
      const divisions = Math.floor(extent / spacing);
      grid = new THREE.GridHelper(
        2 * divisions * spacing,
        2 * divisions,
        0x657786,
        0x657786,
      );
      own(grid.geometry);
      for (const material of Array.isArray(grid.material)
        ? grid.material
        : [grid.material]) {
        own(material);
        material.transparent = true;
        material.opacity = 0.2;
        material.depthWrite = false;
      }
      grid.rotation.x = Math.PI / 2;
      grid.visible = initial.grid;
      world.add(grid);
    }
    // Guides are reference geometry only; never included in picking or scene extent.
    const planeGeometry = own(new THREE.CircleGeometry(extent, 96));
    const planeMaterial = own(
      new THREE.MeshBasicMaterial({
        color: 0x718ba5,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.renderOrder = -10;
    guidePlane.add(plane);
    const outlinePoints = Array.from({ length: 96 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 96;
      return new THREE.Vector3(
        extent * Math.cos(angle),
        extent * Math.sin(angle),
        0,
      );
    });
    const outlineGeometry = own(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
    );
    const outlineMaterial = own(
      new THREE.LineBasicMaterial({
        color: 0x718ba5,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    outline.renderOrder = -9;
    guidePlane.add(outline);
    guidePlane.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(...atlasSupergalacticNormal(initial.frame)).normalize(),
    );
    guidePlane.visible = initial.guides.plane;
    world.add(guidePlane);
    const shellMaterial = own(
      new THREE.LineBasicMaterial({
        color: 0x789a87,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    for (const radius of ATLAS_SHELL_RADII) {
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(atlasShellSegments(radius), 3),
      );
      const shell = new THREE.LineSegments(geometry, shellMaterial);
      shell.renderOrder = -8;
      shell.visible = initial.guides.shells.includes(radius);
      guideShells.set(radius, shell);
      world.add(shell);
    }
    if (initial.slice || initial.region) {
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          initial.region
            ? regionGuideSegments(initial.region, initial.frame)
            : initial.slice
              ? sliceGuideSegments(initial.slice, initial.frame, extent)
              : [],
          3,
        ),
      );
      const material = own(
        new THREE.LineBasicMaterial({
          color: 0xc4935d,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      world.add(new THREE.LineSegments(geometry, material));
    }
    const axisExtent = extent * 1.04;
    for (let i = 0; i < 3; i++) {
      const positive = new THREE.Vector3().setComponent(i, axisExtent);
      const geometry = own(
        new THREE.BufferGeometry().setFromPoints([
          positive.clone().negate(),
          positive,
        ]),
      );
      const material = own(
        new THREE.LineBasicMaterial({
          color: AXIS_COLORS[i],
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      world.add(new THREE.Line(geometry, material));
      const label = document.createElement("span");
      label.textContent = initial.axes[i];
      label.style.color = AXIS_COLORS[i];
      overlay.appendChild(label);
      axes.push({ position: positive, label });
    }
    recolor();
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointermove", moved);
    canvas.addEventListener("wheel", stopFlight, {
      capture: true,
      passive: true,
    });
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("webglcontextlost", lost);
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    dispose,
    cameraState: captureCamera,
    exportImage,
    select(pgc: number | null) {
      selected = pgc;
      updateIntervals();
      schedule();
    },
    setLayers(next: AtlasLayers) {
      const changed =
        layers.groups !== next.groups || layers.field !== next.field;
      layers = next;
      if (changed) {
        stopFlight();
        previousGroupTap = null;
        for (const node of groupNodes) node.mesh.visible = layers.groups;
        for (const batch of batches)
          batch.mesh.visible = atlasLayerVisible(false, groupedMode, layers);
        updateIntervals();
      }
      if (mdLines) mdLines.visible = layers.md;
      schedule();
    },
    setIntervalMode(next: AtlasIntervalMode) {
      if (next === intervalMode) return;
      intervalMode = next;
      updateIntervals();
      schedule();
    },
    home(view: SceneView) {
      fit(view);
    },
    setGrid(visible: boolean) {
      if (grid) grid.visible = visible;
      schedule();
    },
    setGuides(next: AtlasGuides) {
      if (disposed) return;
      guidePlane.visible = next.plane;
      for (const radius of ATLAS_SHELL_RADII) {
        const shell = guideShells.get(radius);
        if (shell) shell.visible = next.shells.includes(radius);
      }
      schedule();
    },
    focus,
    setMarkerSize(nextMode: AtlasSizeMode, nextDensity: AtlasMarkerDensity) {
      if (disposed || (nextMode === sizeMode && nextDensity === markerDensity))
        return;
      sizeMode = nextMode;
      markerDensity = nextDensity;
      try {
        rebuildMarkers();
        schedule();
      } catch {
        dispose();
        onFailure();
      }
    },
    style(nextTheme: AtlasTheme, nextColor: AtlasRenderColor) {
      if (disposed || (nextTheme === theme && nextColor === color)) return;
      theme = nextTheme;
      color = nextColor;
      renderer.setClearColor(theme === "dark" ? 0x101820 : 0xf3f5f7, 1);
      recolor();
      schedule();
    },
  };
}
