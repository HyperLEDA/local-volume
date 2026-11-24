import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  axisLabelPlacement,
  INITIAL_SCENE_OPTIONS,
} from "../src/lib/groupSceneWebGLPolicy.ts";

describe("Viewer layout and independent coordinate axes", () => {
  test("the three coordinate axes do not depend on optional guides", () => {
    expect(INITIAL_SCENE_OPTIONS.grid).toBe(false);
    expect(INITIAL_SCENE_OPTIONS.box).toBe(false);
    const source = readFileSync(
      new URL("../src/components/GroupSceneThree.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("axes.visible = true");
    expect(source).not.toContain("axes.visible = next.grid");
    expect(source).not.toContain("!props.grid");
    expect(source).toContain("grid.visible = next.grid");
    expect(source).toContain("box.visible = next.box");
  });
  test("axis endpoint is retained when visible", () => {
    expect(
      axisLabelPlacement({ x: 100, y: 100 }, { x: 160, y: 140 }, 200, 200),
    ).toEqual({ x: 160, y: 140, fraction: 1 });
  });
  test("clipped positive axis labels stay on the projected axis without a fake tick", () => {
    const result = axisLabelPlacement(
      { x: 100, y: 100 },
      { x: 300, y: 200 },
      200,
      200,
    );
    expect(result?.x).toBeCloseTo(184, 8);
    expect(result?.y).toBeCloseTo(142, 8);
    expect(result?.fraction).toBeCloseTo(0.42, 8);
  });
  test("end-on and wholly off-screen axes are left to the orientation compass", () => {
    expect(
      axisLabelPlacement({ x: 100, y: 100 }, { x: 100, y: 101 }, 200, 200),
    ).toBeNull();
    expect(
      axisLabelPlacement({ x: -20, y: 60 }, { x: -40, y: 100 }, 200, 200),
    ).toBeNull();
  });
  test("panned axis entering the screen retains its true positive endpoint", () => {
    expect(
      axisLabelPlacement({ x: -50, y: 100 }, { x: 100, y: 100 }, 200, 200),
    ).toEqual({ x: 100, y: 100, fraction: 1 });
  });
  test("invalid viewport or nonfinite projection is not labelled", () => {
    expect(
      axisLabelPlacement({ x: 100, y: 100 }, { x: NaN, y: 140 }, 200, 200),
    ).toBeNull();
    expect(
      axisLabelPlacement({ x: 0, y: 0 }, { x: 50, y: 50 }, 0, 0),
    ).toBeNull();
  });
  test("actual rendering stage uses a moderate landscape ratio on desktop", () => {
    const css = readFileSync(
      new URL("../src/components/GroupSceneView.css", import.meta.url),
      "utf8",
    );
    const patch = css.split("Stage 06k: moderate landscape viewport")[1] ?? "";
    expect(patch).toMatch(
      /\.lv-three-stage\s*\{[^}]*aspect-ratio:\s*5\s*\/\s*4;/s,
    );
  });
});
