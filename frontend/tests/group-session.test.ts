import { describe, expect, test } from "bun:test";
import {
  decodeGroupPreferences,
  groupSessionId,
} from "../src/lib/groupSession.ts";
import { decodeAtlasPreferences } from "../src/lib/atlasSession.ts";

describe("group session and atlas reset", () => {
  const allowed = new Set([1, 2]);
  test("composite group identities do not alias", () => {
    expect(groupSessionId("physical", 1, 2)).not.toBe(
      groupSessionId("suite", 1, 2),
    );
    expect(groupSessionId("physical", 1, 2)).not.toBe(
      groupSessionId("physical", 1, 3),
    );
  });
  test("preserve explicit deselection and reject stale member", () => {
    expect(
      decodeGroupPreferences({ selected: null }, allowed, 1).selected,
    ).toBeNull();
    expect(decodeGroupPreferences({ selected: 99 }, allowed, 1).selected).toBe(
      1,
    );
  });
  test("validate frame, view and flags", () => {
    const value = decodeGroupPreferences(
      { frameMode: "SUPERGALACTIC", view: "XZ", grid: true, sphere: "true" },
      allowed,
      1,
    );
    expect(value.frameMode).toBe("SUPERGALACTIC");
    expect(value.view).toBe("XZ");
    expect(value.grid).toBe(true);
    expect(value.sphere).toBe(false);
  });
  test("atlas reset uses first-launch policy", () => {
    const value = decodeAtlasPreferences(null, allowed, "light");
    expect(value.frame).toBe("SUPERGALACTIC");
    expect(value.projection).toBe("orthographic");
    expect(value.displayMode).toBe("groups");
    expect(value.colorMode).toBe("morphology");
    expect(value.localOnly).toBe(true);
    expect(value.selectedGalaxy).toBeNull();
    expect(value.selectedGroup).toBeNull();
    expect(value.theme).toBe("light");
  });
});
