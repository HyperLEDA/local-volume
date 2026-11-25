import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decodeGroupPreferences } from "../src/lib/groupSession.ts";
import {
  INITIAL_SCENE_OPTIONS,
  viewVectors,
  scaleBarKpc,
  pickProjectedMarker,
} from "../src/lib/groupSceneWebGLPolicy.ts";
describe("Three.js group modal", () => {
  test("relations start off for a new group and restore a saved preference", () => {
    expect(INITIAL_SCENE_OPTIONS.relations).toBe(false);
    const members = new Set([1]);
    expect(decodeGroupPreferences(null, members, 1).relations).toBe(false);
    expect(
      decodeGroupPreferences({ relations: true }, members, 1).relations,
    ).toBe(true);
    expect(
      decodeGroupPreferences({ relations: false }, members, 1).relations,
    ).toBe(false);
    expect(
      decodeGroupPreferences({ relations: "true" }, members, 1).relations,
    ).toBe(false);
  });
  test("camera presets use positive east/north/LOS consistently", () => {
    expect(viewVectors("XY")).toEqual({ position: [0, 0, 1], up: [0, 1, 0] });
    expect(viewVectors("XZ")).toEqual({ position: [0, -1, 0], up: [0, 0, 1] });
    expect(viewVectors("YZ")).toEqual({ position: [1, 0, 0], up: [0, 0, 1] });
  });
  test("scale is based on true orthographic units per screen pixel", () => {
    for (const scale of [0.02, 0.2, 1, 3, 20]) {
      expect(scaleBarKpc(scale) / scale).toBeLessThanOrEqual(110);
      expect(scaleBarKpc(scale) / scale).toBeGreaterThan(20);
    }
    expect(scaleBarKpc(0)).toBe(0);
  });
  test("marker picking rejects empty space and picks foreground for overlapping sources", () => {
    const points = [
      { pgc: 1, x: 50, y: 50, depth: 0.8, radius: 9 },
      { pgc: 2, x: 50, y: 50, depth: -0.8, radius: 9 },
      { pgc: 3, x: 50, y: 50, depth: -2, radius: 9 },
    ];
    expect(pickProjectedMarker(points, 50, 50)).toBe(2);
    expect(pickProjectedMarker(points, 10, 10)).toBe(null);
  });
  test("Aladin remains mounted outside the lazy modal", () => {
    const page = readFileSync(
      new URL("../src/pages/GroupPage.tsx", import.meta.url),
      "utf8",
    );
    expect(page).toContain("<GroupSkyMap");
    expect(page).toContain("3D Group");
    expect(page).toContain("<GroupSceneView");
    expect(page).not.toContain('mapMode === "3D"');
  });
  test("native dialog and explicit edge toggle are wired", () => {
    const modal = readFileSync(
      new URL("../src/components/GroupSceneView.tsx", import.meta.url),
      "utf8",
    );
    const engine = readFileSync(
      new URL("../src/components/GroupSceneThree.tsx", import.meta.url),
      "utf8",
    );
    expect(modal).toContain("showModal()");
    expect(modal).toContain("readGroupPreferences(");
    expect(modal).toContain("useState<boolean>(restored.relations)");
    expect(modal).toContain("saveGroupPreferences(sessionId, {");
    expect(modal).toContain("relations={relations}");
    expect(modal).toContain("setRelations((v) => !v)");
    expect(engine).toContain("relations.visible = next.relations");
    expect(engine).toContain("renderer.dispose()");
  });
});
