import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  createGalaxyOverlayController,
  GALAXY_COMPARISON_LAYER,
  normaliseOpacity,
  type ComparisonAladinView,
} from "../src/lib/galaxySurveyOverlay.ts";

function mockView() {
  const actions: string[] = [];
  let layer: { setOpacity: (v: number) => void } | null = null;
  const view: ComparisonAladinView = {
    setOverlayImageLayer(id, name) {
      actions.push(`add:${id}:${name}`);
      layer = { setOpacity: (v: number) => actions.push(`opacity:${v}`) };
    },
    getOverlayImageLayer() { return layer; },
    removeImageLayer(name) { actions.push(`remove:${name}`); layer = null; },
  };
  return { view, actions };
}

function tick(): Promise<void> {
  return new Promise<void>((resolve) => { setTimeout(resolve, 0); });
}

function uninitializedRelease(): never {
  throw new Error("Promise release was not initialized");
}

describe("galaxy comparison layer", () => {
  test("clamps opacity and rejects non-finite inputs", () => {
    expect(normaliseOpacity(-2)).toBe(0);
    expect(normaliseOpacity(1.5)).toBe(1);
    expect(normaliseOpacity(NaN)).toBe(0.5);
  });

  test("adds exactly one named image layer; opacity does not reload surveys", async () => {
    const { view, actions } = mockView();
    const errors: (string | null)[] = [];
    const controller = createGalaxyOverlayController(view, (x) => errors.push(x));
    controller.request("P/GALEXGR6/AIS/color", 0.35);
    await tick();
    controller.request("P/GALEXGR6/AIS/color", 0.8);
    await tick();
    expect(actions.filter((x) => x.startsWith("add:"))).toHaveLength(1);
    expect(actions).toContain(`add:P/GALEXGR6/AIS/color:${GALAXY_COMPARISON_LAYER}`);
    expect(actions).toContain("opacity:0.35");
    expect(actions).toContain("opacity:0.8");
    expect(errors.at(-1)).toBeNull();
    controller.request(null, 0.5);
    await tick();
    expect(actions).toContain(`remove:${GALAXY_COMPARISON_LAYER}`);
    controller.dispose();
  });

  test("rapid survey changes preserve only latest selection", async () => {
    const { view, actions } = mockView();
    let release: () => void = uninitializedRelease;
    let pending: Promise<void> | null = null;
    const originalSet = view.setOverlayImageLayer;
    view.setOverlayImageLayer = (id, name) => {
      void originalSet(id, name);
      if (!pending) pending = new Promise<void>((resolve) => { release = resolve; });
      return pending;
    };
    const controller = createGalaxyOverlayController(view, () => {});
    controller.request("galex", 0.3);
    controller.request("2mass", 0.6);
    controller.request("allwise", 0.75);
    expect(actions.filter((x) => x.startsWith("add:")).length).toBe(1);
    release();
    await tick();
    expect(actions.filter((x) => x.startsWith("add:")).map((x) => x.split(":")[1])).toEqual(["galex", "allwise"]);
    expect(actions.at(-1)).toBe("opacity:0.75");
    controller.dispose();
  });

  test("disabling while a HiPS add is pending removes late overlay", async () => {
    const { view, actions } = mockView();
    let release: () => void = uninitializedRelease;
    const originalSet = view.setOverlayImageLayer;
    view.setOverlayImageLayer = (id, name) => {
      void originalSet(id, name);
      return new Promise<void>((resolve) => { release = resolve; });
    };
    const controller = createGalaxyOverlayController(view, () => {});
    controller.request("galex", 0.5);
    controller.request(null, 0.5);
    release();
    await tick();
    expect(actions.at(-1)).toBe(`remove:${GALAXY_COMPARISON_LAYER}`);
    controller.dispose();
  });

  test("keeps existing map and marker APIs out of the comparison controller", () => {
    const source = readFileSync(new URL("../src/lib/galaxySurveyOverlay.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../src/pages/ObjectPage.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("setFoV(");
    expect(source).not.toContain("gotoRaDec(");
    expect(source).not.toContain("removeOverlays(");
    expect(page).toContain('type="range"');
    expect(page).toContain("detailOverlaySurveyId={comparisonEnabled ? comparisonSurvey.hips : null}");
  });
});
