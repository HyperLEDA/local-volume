import * as THREE from "three";

// Physical key codes preserve WASD on non-Latin keyboard layouts.
export function spatialKeyDirection(
  code: string,
): readonly [number, number] | null {
  switch (code) {
    case "KeyA":
    case "ArrowLeft":
      return [-1, 0];
    case "KeyD":
    case "ArrowRight":
      return [1, 0];
    case "KeyW":
    case "ArrowUp":
      return [0, 1];
    case "KeyS":
    case "ArrowDown":
      return [0, -1];
    default:
      return null;
  }
}

export function spatialPointerMoved(
  start: { x: number; y: number; id: number },
  event: Pick<PointerEvent, "pointerId" | "clientX" | "clientY">,
): boolean {
  return (
    start.id === event.pointerId &&
    Math.hypot(start.x - event.clientX, start.y - event.clientY) > 5
  );
}

export function spatialKeyVector(
  codes: Iterable<string>,
): readonly [number, number] {
  let left = false,
    right = false,
    up = false,
    down = false;
  for (const code of codes) {
    const direction = spatialKeyDirection(code);
    if (!direction) continue;
    if (direction[0] < 0) left = true;
    if (direction[0] > 0) right = true;
    if (direction[1] < 0) down = true;
    if (direction[1] > 0) up = true;
  }
  // Alias keys must not double speed; opposite directions cancel.
  const x = Number(right) - Number(left);
  const y = Number(up) - Number(down);
  const norm = Math.max(1, Math.hypot(x, y));
  return [x / norm, y / norm];
}

export function panSpatialCamera(
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  target: THREE.Vector3,
  x: number,
  y: number,
  seconds: number,
  fast: boolean,
): void {
  const span =
    camera instanceof THREE.OrthographicCamera
      ? (camera.top - camera.bottom) / camera.zoom
      : 2 *
        camera.position.distanceTo(target) *
        Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
  if (!(
    span > 0 &&
    Number.isFinite(span) &&
    seconds > 0 &&
    Number.isFinite(seconds)
  ))
    return;
  const delta = new THREE.Vector3(x, y, 0)
    .applyQuaternion(camera.quaternion)
    .multiplyScalar(span * Math.min(seconds, 0.05) * (fast ? 1.65 : 0.55));
  camera.position.add(delta);
  target.add(delta);
}

type Actions = {
  move: (x: number, y: number, seconds: number, fast: boolean) => void;
  focus: () => void;
};

// Demand-driven motion: RAF exists only while a navigation key is held.
// The canvas, not document/window, receives navigation key events.
export function bindSpatialKeyboard(
  canvas: HTMLCanvasElement,
  actions: Actions,
) {
  const keys = new Set<string>();
  let frame: number | null = null;
  let previous = 0;
  let fast = false;
  let disposed = false;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-keyshortcuts",
    "W A S D ArrowUp ArrowDown ArrowLeft ArrowRight Enter",
  );
  canvas.classList.add("lv-spatial-keyboard-target");
  function stop() {
    keys.clear();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    fast = false;
  }
  function tick(now: number) {
    frame = null;
    if (disposed || keys.size === 0 || document.activeElement !== canvas) {
      stop();
      return;
    }
    const [x, y] = spatialKeyVector(keys);
    const seconds = Math.max(0, (now - previous) / 1000);
    previous = now;
    if (x !== 0 || y !== 0) actions.move(x, y, seconds, fast);
    if (keys.size > 0) frame = requestAnimationFrame(tick);
  }
  function down(event: KeyboardEvent) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      document.activeElement !== canvas
    )
      return;
    if (event.key === "Enter") {
      event.preventDefault();
      stop();
      if (!event.repeat) actions.focus();
      return;
    }
    fast = event.shiftKey;
    if (!spatialKeyDirection(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
    if (frame === null) {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function up(event: KeyboardEvent) {
    fast = event.shiftKey;
    if (keys.delete(event.code)) event.preventDefault();
    if (keys.size === 0) stop();
  }
  function visibility() {
    if (document.hidden) stop();
  }
  canvas.addEventListener("keydown", down);
  canvas.addEventListener("keyup", up);
  canvas.addEventListener("blur", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", visibility);
  return {
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      canvas.removeEventListener("keydown", down);
      canvas.removeEventListener("keyup", up);
      canvas.removeEventListener("blur", stop);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
