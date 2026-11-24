import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ScenePoint } from "../lib/groupScene3d.ts";
import type { Vec3 } from "../lib/groupGeometry3d.ts";
import { morphologyColor } from "../lib/morphologyColors.ts";
import {
  groupTidalEdges,
  TIDAL_TONES,
  type TidalMember,
} from "../lib/groupTidalEdges.ts";
import {
  frameAxisLabels,
  type ViewerScene,
  type SceneFrameMode,
} from "../lib/groupSceneSupergalactic.ts";
import { markerRadius } from "../lib/groupSceneCamera.ts";
import {
  formatKpc,
  pickProjectedMarker,
  scaleBarKpc,
  sceneFrameRadius,
  schematicEdge,
  axisLabelPlacement,
  galaxyFitHalfHeight,
  intervalProjectedLength,
  frameHalfSpans,
  sphereGuideRadius,
  sphereGuideVertices,
  sphereFitHalfHeight,
  viewVectors,
  visibleScenePoint,
  type SceneView,
} from "../lib/groupSceneWebGLPolicy.ts";

type Props = {
  scene: ViewerScene;
  frameMode: SceneFrameMode;
  members: readonly TidalMember[];
  selected: number | null;
  onSelect: (pgc: number) => void;
  relations: boolean;
  individualOnly: boolean;
  grid: boolean;
  box: boolean;
  sphere: boolean;
  view: SceneView;
  viewRevision: number;
};
type Engine = { update: (props: Props) => void; dispose: () => void };
function vec(v: Vec3) {
  return new THREE.Vector3(...v);
}
const AXES = [
  { name: "E", vector: [1, 0, 0] as Vec3, color: "#d19a92" },
  { name: "N", vector: [0, 1, 0] as Vec3, color: "#92c5af" },
  { name: "LOS+", vector: [0, 0, 1] as Vec3, color: "#9cb9df" },
];
function createMarkerTexture(
  kind: ScenePoint["kind"] | "halo",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.translate(48, 48);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = 11;
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "ASSIGNED_PROJECTION") {
    ctx.moveTo(0, -35);
    ctx.lineTo(35, 0);
    ctx.lineTo(0, 35);
    ctx.lineTo(-35, 0);
    ctx.closePath();
  } else if (kind === "MODEL_ESTIMATE") {
    ctx.moveTo(0, -35);
    ctx.lineTo(35, 29);
    ctx.lineTo(-35, 29);
    ctx.closePath();
  } else if (kind === "UNCLASSIFIED_ESTIMATE") {
    ctx.rect(-29, -29, 58, 58);
    ctx.setLineDash([12, 8]);
  } else {
    ctx.arc(0, 0, kind === "halo" ? 38 : 34, 0, 2 * Math.PI);
  }
  if (kind === "INDIVIDUAL_ADOPTED") {
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function createEngine(
  host: HTMLDivElement,
  labels: HTMLDivElement,
  scaleText: HTMLDivElement,
  compass: HTMLCanvasElement,
  tooltip: HTMLDivElement,
  initial: Props,
): Engine {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0c151f, 1);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", "Interactive 3D galaxy positions");
  canvas.setAttribute("role", "img");
  host.appendChild(canvas);
  const axisNames = frameAxisLabels(initial.frameMode);
  const sceneAxes = AXES.map((axis, index) => ({
    ...axis,
    name: axisNames[index],
  }));
  const world = new THREE.Scene();
  const radius = sceneFrameRadius(initial.scene);
  const camera = new THREE.OrthographicCamera(
    -radius,
    radius,
    radius,
    -radius,
    0.001,
    radius * 100,
  );
  const markers = new THREE.Group(),
    relations = new THREE.Group(),
    grid = new THREE.Group(),
    axes = new THREE.Group(),
    box = new THREE.Group();
  const sphere = new THREE.Group();
  world.add(markers, relations, grid, axes, box);
  world.add(sphere);
  sphere.visible = false;
  const geometry = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Map<string, THREE.CanvasTexture>();
  function texture(kind: ScenePoint["kind"] | "halo") {
    let t = textures.get(kind);
    if (!t) {
      t = createMarkerTexture(kind);
      textures.set(kind, t);
    }
    return t;
  }
  function line(
    parent: THREE.Group,
    a: THREE.Vector3,
    b: THREE.Vector3,
    color: string,
    opacity: number,
    dashed = false,
  ) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: radius / 55,
          gapSize: radius / 85,
          depthWrite: false,
        })
      : new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
        });
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    parent.add(l);
    geometry.add(g);
    materials.add(m);
    return l;
  }
  const byPgc = new Map<
    number,
    { point: ScenePoint; sprite: THREE.Sprite; pixels: number }
  >();
  for (const point of initial.scene.points) {
    if (!point.displayPositionKpc) continue;
    const material = new THREE.SpriteMaterial({
      map: texture(point.kind),
      color: morphologyColor(point.morphologyT),
      transparent: true,
      opacity: point.acceptedMember ? 1 : 0.55,
      depthWrite: false,
      alphaTest: 0.02,
      toneMapped: false,
    });
    materials.add(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(vec(point.displayPositionKpc));
    sprite.renderOrder = 5;
    markers.add(sprite);
    byPgc.set(point.pgc, {
      point,
      sprite,
      pixels: 12 + ((markerRadius(point.absBMag) - 3) * 10) / 6,
    });
  }
  const haloMat = new THREE.SpriteMaterial({
    map: texture("halo"),
    color: 0xf5df9e,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  materials.add(haloMat);
  const halo = new THREE.Sprite(haloMat);
  halo.renderOrder = 20;
  world.add(halo);
  halo.visible = false;
  const rootMat = new THREE.SpriteMaterial({
    map: texture("halo"),
    color: 0xf5df9e,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  materials.add(rootMat);
  const rootHalo = new THREE.Sprite(rootMat);
  world.add(rootHalo);
  rootHalo.visible = false;
  const edges = groupTidalEdges(initial.members).flatMap((edge) => {
    const a = byPgc.get(edge.memberPgc),
      b = byPgc.get(edge.parentPgc);
    if (!a || !b || !a.point.acceptedMember || !b.point.acceptedMember)
      return [];
    return [
      {
        a,
        b,
        line: line(
          relations,
          a.sprite.position,
          b.sprite.position,
          TIDAL_TONES[edge.tone],
          0.47,
          schematicEdge(a.point, b.point),
        ),
      },
    ];
  });
  const guideRadius = sphereGuideRadius(initial.scene.points);
  if (guideRadius > 0) {
    const sphereGeometry = new THREE.BufferGeometry().setFromPoints(
      sphereGuideVertices(guideRadius).map(vec),
    );
    const sphereMaterial = new THREE.LineBasicMaterial({
      color: "#69889c",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    sphere.add(new THREE.LineSegments(sphereGeometry, sphereMaterial));
    geometry.add(sphereGeometry);
    materials.add(sphereMaterial);
  }
  const step = scaleBarKpc(radius / 500);
  const [sx, sy, sz] = frameHalfSpans(initial.scene.points, step);
  const spans: Vec3 = [sx, sy, sz];
  axes.visible = true;
  const corners: THREE.Vector3[] = [];
  for (const x of [-sx, sx])
    for (const y of [-sy, sy])
      for (const z of [-sz, sz]) corners.push(new THREE.Vector3(x, y, z));
  // The wireframe bounds are display guides only, not a virial volume.
  for (const x of [-sx, sx])
    for (const y of [-sy, sy])
      line(
        box,
        new THREE.Vector3(x, y, -sz),
        new THREE.Vector3(x, y, sz),
        "#577185",
        0.48,
      );
  for (const z of [-sz, sz]) {
    for (const x of [-sx, sx])
      line(
        box,
        new THREE.Vector3(x, -sy, z),
        new THREE.Vector3(x, sy, z),
        "#577185",
        0.48,
      );
    for (const y of [-sy, sy])
      line(
        box,
        new THREE.Vector3(-sx, y, z),
        new THREE.Vector3(sx, y, z),
        "#577185",
        0.48,
      );
  }
  // Coordinate guide plane through the adopted centre (local LOS=0 or relative SGZ=0).
  for (let i = -Math.round(sx / step); i <= Math.round(sx / step); i++) {
    if (i === 0) continue;
    const x = i * step;
    line(
      grid,
      new THREE.Vector3(x, -sy, 0),
      new THREE.Vector3(x, sy, 0),
      "#587387",
      0.34,
    );
  }
  for (let i = -Math.round(sy / step); i <= Math.round(sy / step); i++) {
    if (i === 0) continue;
    const y = i * step;
    line(
      grid,
      new THREE.Vector3(-sx, y, 0),
      new THREE.Vector3(sx, y, 0),
      "#587387",
      0.34,
    );
  }
  const anchors: { element: HTMLSpanElement; pos: THREE.Vector3 }[] = [];
  function label(text: string, color: string, pos: THREE.Vector3) {
    const element = document.createElement("span");
    element.textContent = text;
    element.style.color = color;
    labels.appendChild(element);
    const anchor = { element, pos };
    anchors.push(anchor);
    return anchor;
  }
  for (const [i, axis] of sceneAxes.entries()) {
    const end = vec(axis.vector).multiplyScalar(spans[i]);
    line(
      axes,
      end.clone().negate(),
      new THREE.Vector3(),
      axis.color,
      0.38,
      true,
    );
    line(axes, new THREE.Vector3(), end, axis.color, 0.95);
    label(`${axis.name} ${formatKpc(spans[i])}`, axis.color, end);
  }
  const activeLabel = label("", "#f5df9e", new THREE.Vector3());
  const svgNS = "http://www.w3.org/2000/svg";
  const intervalOverlay = document.createElementNS(svgNS, "svg");
  intervalOverlay.setAttribute("class", "lv-three-interval-overlay");
  const intervalLine = document.createElementNS(svgNS, "line");
  const endA = document.createElementNS(svgNS, "circle");
  const endB = document.createElementNS(svgNS, "circle");
  const unresolved = document.createElementNS(svgNS, "circle");
  intervalLine.setAttribute("stroke", "#ffe2a0");
  intervalLine.setAttribute("stroke-width", "2.5");
  for (const endpoint of [endA, endB, unresolved]) {
    endpoint.setAttribute("stroke", "#ffe2a0");
    endpoint.setAttribute("stroke-width", "2");
    endpoint.setAttribute("fill", "none");
  }
  endA.setAttribute("r", "3.5");
  endB.setAttribute("r", "3.5");
  unresolved.setAttribute("r", "7");
  intervalOverlay.append(intervalLine, endA, endB, unresolved);
  labels.appendChild(intervalOverlay);
  const intervalStatus = document.createElement("div");
  intervalStatus.className = "lv-three-interval-status";
  intervalStatus.setAttribute("role", "status");
  labels.appendChild(intervalStatus);
  let props = initial,
    controls: OrbitControls | null = null,
    width = 1,
    height = 1,
    raf = 0,
    disposed = false;
  let lastViewRevision = -1;
  function pixelsPerKpc() {
    return (height * camera.zoom) / (camera.top - camera.bottom);
  }
  function project(p: THREE.Vector3) {
    const q = p.clone().project(camera);
    return {
      x: ((q.x + 1) * width) / 2,
      y: ((1 - q.y) * height) / 2,
      depth: q.z,
    };
  }
  function drawDistanceInterval() {
    intervalOverlay.style.display = "none";
    intervalStatus.hidden = true;
    const entry =
      props.selected === null ? undefined : byPgc.get(props.selected);
    if (!entry?.sprite.visible || !entry.point.interval) {
      return;
    }
    intervalStatus.hidden = false;
    const segment = entry.point.interval;
    const a = project(vec(segment.lowerKpc));
    const b = project(vec(segment.upperKpc));
    if (a.depth < -1 || a.depth > 1 || b.depth < -1 || b.depth > 1) {
      intervalStatus.textContent = "D interval outside camera depth range";
      return;
    }
    intervalOverlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
    intervalOverlay.style.display = "block";
    const short = intervalProjectedLength(a, b) < 8;
    intervalLine.style.display = short ? "none" : "";
    endA.style.display = short ? "none" : "";
    endB.style.display = short ? "none" : "";
    unresolved.style.display = short ? "" : "none";
    intervalLine.setAttribute("x1", String(a.x));
    intervalLine.setAttribute("y1", String(a.y));
    intervalLine.setAttribute("x2", String(b.x));
    intervalLine.setAttribute("y2", String(b.y));
    intervalLine.setAttribute(
      "stroke-dasharray",
      segment.quality === "VERIFIED" ? "none" : "5 3",
    );
    endA.setAttribute("cx", String(a.x));
    endA.setAttribute("cy", String(a.y));
    endB.setAttribute("cx", String(b.x));
    endB.setAttribute("cy", String(b.y));
    unresolved.setAttribute("cx", String((a.x + b.x) / 2));
    unresolved.setAttribute("cy", String((a.y + b.y) / 2));
    intervalStatus.textContent = `${entry.point.name}: −${segment.minusMpc.toFixed(3)} / +${segment.plusMpc.toFixed(3)} Mpc · ${segment.quality === "VERIFIED" ? "verified" : "catalogue, unreviewed"}${short ? " · unresolved at this view/zoom; rotate or zoom in" : ""}`;
  }
  function drawCompass() {
    const ctx = compass.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 120);
    const inverse = camera.quaternion.clone().invert();
    ctx.font = "600 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const axis of sceneAxes) {
      const q = vec(axis.vector).applyQuaternion(inverse);
      const x = 60 + q.x * 36,
        y = 60 - q.y * 36;
      ctx.strokeStyle = axis.color;
      ctx.fillStyle = axis.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 60);
      ctx.lineTo(x, y);
      ctx.stroke();
      const length = Math.hypot(q.x, q.y);
      if (length < 0.18) {
        ctx.beginPath();
        ctx.arc(60, 60, 4, 0, 2 * Math.PI);
        if (q.z > 0) ctx.fill();
        else ctx.stroke();
        ctx.fillText(axis.name, 60, 78);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillText(
          axis.name,
          x + (q.x / length) * 13,
          y - (q.y / length) * 13,
        );
      }
    }
    ctx.fillStyle = "#dce6ee";
    ctx.beginPath();
    ctx.arc(60, 60, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
  function draw() {
    raf = 0;
    if (disposed) return;
    camera.updateMatrixWorld();
    const scale = pixelsPerKpc();
    for (const entry of byPgc.values()) {
      const size = entry.pixels / scale;
      entry.sprite.scale.set(size, size, 1);
    }
    const selected =
      props.selected === null ? undefined : byPgc.get(props.selected);
    halo.visible = !!selected?.sprite.visible;
    if (selected && halo.visible) {
      halo.position.copy(selected.sprite.position);
      const size = (selected.pixels + 12) / scale;
      halo.scale.set(size, size, 1);
      activeLabel.element.textContent = selected.point.name;
      activeLabel.pos.copy(selected.sprite.position);
    } else activeLabel.element.textContent = "";
    const root = byPgc.get(initial.scene.rootPgc);
    rootHalo.visible = !!root?.sprite.visible;
    if (root && rootHalo.visible) {
      rootHalo.position.copy(root.sprite.position);
      const size = (root.pixels + 6) / scale;
      rootHalo.scale.set(size, size, 1);
    }
    renderer.render(world, camera);
    drawCompass();
    drawDistanceInterval();
    const centre = project(new THREE.Vector3());
    for (const [index, anchor] of anchors.entries()) {
      const p = project(anchor.pos);
      let x = p.x;
      let y = p.y;
      if (anchor !== activeLabel) {
        const placement = axisLabelPlacement(centre, p, width, height);
        const axis = sceneAxes[index];
        if (placement === null) {
          anchor.element.hidden = true;
          continue;
        }
        x = placement.x;
        y = placement.y;
        // An off-screen endpoint gets a direction label, never a false tick value.
        anchor.element.textContent =
          placement.fraction >= 0.999
            ? `${axis.name} ${formatKpc(spans[index])}`
            : axis.name;
        anchor.element.hidden = false;
      } else {
        anchor.element.hidden =
          p.depth < -1 ||
          p.depth > 1 ||
          x < 0 ||
          x > width ||
          y < 0 ||
          y > height ||
          !anchor.element.textContent;
      }
      anchor.element.style.transform = `translate(${Math.max(5, Math.min(width - anchor.element.offsetWidth - 5, x + 8))}px,${Math.max(5, Math.min(height - 20, y - 17))}px)`;
    }
    const bar = scaleBarKpc(1 / scale);
    scaleText.textContent = `${formatKpc(bar)} kpc`;
    scaleText.style.width = `${bar * scale}px`;
  }
  function schedule() {
    if (!disposed && !raf) raf = requestAnimationFrame(draw);
  }
  function fitFrame() {
    camera.updateMatrixWorld();
    const inverse = camera.quaternion.clone().invert();
    const positions = props.box
      ? corners
      : [...byPgc.values()]
          .filter((entry) =>
            visibleScenePoint(entry.point, props.individualOnly),
          )
          .map((entry) => entry.sprite.position);
    const projected: Vec3[] = positions.map((c) => {
      const q = c.clone().applyQuaternion(inverse);
      return [q.x, q.y, q.z];
    });
    const aspect = width / height;
    const v = Math.max(
      galaxyFitHalfHeight(projected, aspect),
      props.sphere ? sphereFitHalfHeight(guideRadius, aspect) : 0,
    );
    camera.left = -v * aspect;
    camera.right = v * aspect;
    camera.top = v;
    camera.bottom = -v;
    camera.updateProjectionMatrix();
  }
  function frame(view: SceneView) {
    controls?.dispose();
    const vectors = viewVectors(view);
    camera.position.copy(
      vec(vectors.position)
        .normalize()
        .multiplyScalar(radius * 4),
    );
    camera.up.copy(vec(vectors.up));
    camera.zoom = 1;
    camera.lookAt(0, 0, 0);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.minZoom = 0.12;
    controls.maxZoom = 30;
    controls.target.set(0, 0, 0);
    controls.update();
    fitFrame();
    controls.addEventListener("change", schedule);
    schedule();
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    if (rect.width === width && rect.height === height) return;
    const firstLayout = width === 1 && height === 1;
    width = rect.width;
    height = rect.height;
    renderer.setSize(width, height, false);
    if (firstLayout && controls !== null) {
      fitFrame();
    } else {
      const aspect = width / height;
      const v = Math.max(1, camera.top);
      camera.left = -v * aspect;
      camera.right = v * aspect;
      camera.updateProjectionMatrix();
    }
    schedule();
  }
  function update(next: Props) {
    props = next;
    if (lastViewRevision !== next.viewRevision) {
      lastViewRevision = next.viewRevision;
      frame(next.view);
    }
    for (const entry of byPgc.values())
      entry.sprite.visible = visibleScenePoint(
        entry.point,
        next.individualOnly,
      );
    relations.visible = next.relations;
    grid.visible = next.grid;
    box.visible = next.box;
    sphere.visible = next.sphere;
    for (const edge of edges)
      edge.line.visible = edge.a.sprite.visible && edge.b.sprite.visible;
    schedule();
  }
  function picked(e: PointerEvent) {
    camera.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect();
    const items = [...byPgc.values()]
      .filter((p) => p.sprite.visible)
      .map((p) => ({
        ...project(p.sprite.position),
        pgc: p.point.pgc,
        radius: Math.max(8, p.pixels / 2 + 4),
      }));
    return pickProjectedMarker(
      items,
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
  }
  let start: { x: number; y: number; id: number } | null = null;
  function hideTooltip() {
    tooltip.hidden = true;
    canvas.style.cursor = "";
  }
  function hover(e: PointerEvent) {
    if (e.buttons !== 0 || e.pointerType === "touch") {
      hideTooltip();
      return;
    }
    const pgc = picked(e);
    const entry = pgc === null ? undefined : byPgc.get(pgc);
    if (!entry) {
      hideTooltip();
      return;
    }
    const pos = project(entry.sprite.position);
    tooltip.textContent = entry.point.name;
    tooltip.hidden = false;
    canvas.style.cursor = "pointer";
    tooltip.style.left = `${Math.max(8, Math.min(width - tooltip.offsetWidth - 8, pos.x + 12))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(height - tooltip.offsetHeight - 8, pos.y - 30))}px`;
  }
  function down(e: PointerEvent) {
    hideTooltip();
    start =
      e.button === 0 ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
  }
  function cancel() {
    start = null;
    hideTooltip();
  }
  function up(e: PointerEvent) {
    const from = start;
    start = null;
    if (
      !from ||
      from.id !== e.pointerId ||
      Math.hypot(from.x - e.clientX, from.y - e.clientY) > 5
    )
      return;
    const pgc = picked(e);
    if (pgc !== null) props.onSelect(pgc);
  }
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("pointermove", hover);
  canvas.addEventListener("pointerleave", hideTooltip);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  update(initial);
  return {
    update,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls?.dispose();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("pointermove", hover);
      canvas.removeEventListener("pointerleave", hideTooltip);
      geometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      labels.replaceChildren();
    },
  };
}
export default function GroupSceneThree(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    labels = useRef<HTMLDivElement>(null),
    scale = useRef<HTMLDivElement>(null),
    compass = useRef<HTMLCanvasElement>(null),
    tooltip = useRef<HTMLDivElement>(null),
    engine = useRef<Engine | null>(null);
  const latest = useRef(props);
  const [error, setError] = useState(false);
  useEffect(() => {
    latest.current = props;
    engine.current?.update(props);
  }, [props]);
  useEffect(() => {
    if (
      !host.current ||
      !labels.current ||
      !scale.current ||
      !compass.current ||
      !tooltip.current
    )
      return;
    const element = host.current;
    try {
      const value = createEngine(
        element,
        labels.current,
        scale.current,
        compass.current,
        tooltip.current,
        latest.current,
      );
      engine.current = value;
      return () => {
        value.dispose();
        engine.current = null;
      };
    } catch {
      element.replaceChildren();
      setError(true);
    }
  }, [props.scene, props.members, props.frameMode]);
  return (
    <div className="lv-three-stage">
      <div className="lv-three-canvas" ref={host} />
      <div className="lv-three-labels" ref={labels} aria-hidden="true" />
      <div className="lv-three-scale" ref={scale} aria-hidden="true" />
      <canvas
        className="lv-three-compass"
        width={120}
        height={120}
        ref={compass}
        aria-hidden="true"
      />
      <div className="lv-three-hover" ref={tooltip} hidden aria-hidden="true" />
      {error && (
        <div className="lv-three-fallback" role="alert">
          WebGL could not initialize. The catalogue member inspector remains
          available.
        </div>
      )}
    </div>
  );
}
