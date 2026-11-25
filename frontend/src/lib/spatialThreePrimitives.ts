import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Marker glyphs describe display classes, not independent scientific evidence.
export type SpatialMarkerKind =
  | "INDIVIDUAL_ADOPTED"
  | "ASSIGNED_PROJECTION"
  | "MODEL_ESTIMATE"
  | "UNCLASSIFIED_ESTIMATE"
  | "DIRECTION_ONLY"
  | "UNAVAILABLE"
  | "halo";

export function createMarkerTexture(
  kind: SpatialMarkerKind,
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

export function createSpatialRenderer(background: THREE.ColorRepresentation) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(background, 1);
  return renderer;
}

export function createSpatialOrbitControls(
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
) {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minZoom = 0.12;
  controls.maxZoom = 30;
  return controls;
}

export function projectSpatialPoint(
  point: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
) {
  const q = point.clone().project(camera);
  return {
    x: ((q.x + 1) * width) / 2,
    y: ((1 - q.y) * height) / 2,
    depth: q.z,
  };
}

export function orthographicPixelsPerUnit(
  camera: THREE.OrthographicCamera,
  height: number,
) {
  return (height * camera.zoom) / (camera.top - camera.bottom);
}

export function setOrthographicFrame(
  camera: THREE.OrthographicCamera,
  halfHeight: number,
  aspect: number,
) {
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
