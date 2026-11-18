import { describe, expect, test } from "bun:test";
import {
  initialAladinTarget,
  isValidInitialAladinFocus,
} from "../src/lib/aladinInitialView.ts";

describe("issue #49: first Aladin view", () => {
  test("Atlas defaults to the documented full-sky center", () => {
    expect(initialAladinTarget(null)).toBe("180 +0");
  });

  test("galaxy details start at the actual adopted ICRS coordinates", () => {
    expect(initialAladinTarget({ ra: 37.5, dec: -12.25 })).toBe(
      "37.5 -12.25",
    );
    expect(initialAladinTarget({ ra: 0, dec: 0 })).toBe("0 +0");
    expect(initialAladinTarget({ ra: 359.9, dec: 12.5 })).toBe(
      "359.9 +12.5",
    );
  });

  test("invalid coordinates do not produce a malformed map target", () => {
    for (const ra of [NaN, Infinity, -1, 361]) {
      const focus = { ra, dec: 0 };
      expect(isValidInitialAladinFocus(focus)).toBe(false);
      expect(initialAladinTarget(focus)).toBe("180 +0");
    }
    for (const dec of [NaN, Infinity, -91, 91]) {
      expect(initialAladinTarget({ ra: 0, dec })).toBe("180 +0");
    }
  });
});
