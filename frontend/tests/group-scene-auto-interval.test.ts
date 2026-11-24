import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { INITIAL_SCENE_OPTIONS } from "../src/lib/groupSceneWebGLPolicy.ts";

const modal = readFileSync(
  new URL("../src/components/GroupSceneView.tsx", import.meta.url),
  "utf8",
);
const engine = readFileSync(
  new URL("../src/components/GroupSceneThree.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/components/GroupSceneView.css", import.meta.url),
  "utf8",
);

describe("Automatic selected-galaxy distance interval", () => {
  test("selection alone drives the interval, without a layer toggle", () => {
    expect(modal).not.toContain("setInterval");
    expect(modal).not.toContain("interval={interval}");
    expect(modal).toContain("onSelect={setSelected}");
    expect(engine).not.toContain("props.interval");
    expect(engine).toContain("byPgc.get(props.selected)");
    expect(engine).toContain("drawDistanceInterval()");
  });
  test("each redraw clears the old interval and rejects unavailable or hidden positions", () => {
    expect(engine).toContain('intervalOverlay.style.display = "none"');
    expect(engine).toContain("intervalStatus.hidden = true");
    expect(engine).toContain("!entry?.sprite.visible || !entry.point.interval");
    expect(engine).toContain("intervalStatus.hidden = false");
    expect(engine).toContain("project(vec(segment.lowerKpc))");
    expect(engine).toContain("project(vec(segment.upperKpc))");
  });
  test("optional guides remain off in the moderate landscape workspace", () => {
    expect(INITIAL_SCENE_OPTIONS.grid).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.box).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.relations).toBe(false);
    expect(css).toContain("Stage 06k: moderate landscape viewport");
    expect(css).toContain("--lv-inspector-width: clamp(300px, 24vw, 360px)");
    expect(css).toMatch(/aspect-ratio:\s*5\s*\/\s*4;/);
  });
});
