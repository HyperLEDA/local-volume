import { describe, expect, test } from "bun:test";
import {
  applySkySelection,
  decodeAtlasPreferences,
} from "../src/lib/atlasSession.ts";

describe("explicit Sky / Spatial selection handoff", () => {
  const allowed = new Set([42, 43]);
  const previous = decodeAtlasPreferences(
    { selectedGroup: 42, displayMode: "groups", grid: true, mode: "verified" },
    allowed,
    "dark",
  );
  test("no explicit sky action preserves existing spatial session", () => {
    expect(applySkySelection(previous, undefined, allowed)).toBe(previous);
  });
  test("galaxy handoff preserves quality and selects the actual galaxy, not the group", () => {
    expect(applySkySelection(previous, 43, allowed)).toEqual({
      ...previous,
      displayMode: "galaxies",
      selectedGroup: null,
      selectedGalaxy: 43,
    });
  });
  test("explicit empty click clears both selections without changing display or filters", () => {
    expect(applySkySelection(previous, null, allowed)).toEqual({
      ...previous,
      selectedGroup: null,
      selectedGalaxy: null,
    });
  });
  test("out-of-sample selection cannot add a new galaxy to the scene", () => {
    expect(applySkySelection(previous, 99, allowed)).toEqual({
      ...previous,
      selectedGroup: null,
      selectedGalaxy: null,
    });
  });
});
