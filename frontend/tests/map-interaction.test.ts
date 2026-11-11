import { describe, expect, test } from "bun:test";
import { shouldDismissSkyPopup } from "../src/lib/mapInteraction.ts";

describe("shouldDismissSkyPopup", () => {
  test("closes an open popup after an empty-sky click", () => {
    expect(shouldDismissSkyPopup(false, false)).toBe(true);
  });

  test("does not close a newly clicked marker popup", () => {
    expect(shouldDismissSkyPopup(true, false)).toBe(false);
  });

  test("does not interpret panning as a dismissal click", () => {
    expect(shouldDismissSkyPopup(false, true)).toBe(false);
    expect(shouldDismissSkyPopup(true, true)).toBe(false);
  });
});
