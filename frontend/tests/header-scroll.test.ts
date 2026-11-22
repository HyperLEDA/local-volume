import { describe, expect, test } from "bun:test";
import {
  HEADER_COLLAPSE_SCROLL_Y,
  HEADER_EXPAND_SCROLL_Y,
  headerCompactAtScroll,
} from "../src/lib/headerScroll.ts";

describe("scientific header scroll state", () => {
  test("expands at the top and collapses after deliberate scrolling", () => {
    expect(headerCompactAtScroll(0, false)).toBe(false);
    expect(headerCompactAtScroll(HEADER_COLLAPSE_SCROLL_Y, false)).toBe(true);
    expect(headerCompactAtScroll(200, false)).toBe(true);
  });

  test("uses hysteresis so changes in header height do not flicker", () => {
    expect(headerCompactAtScroll(40, false)).toBe(false);
    expect(headerCompactAtScroll(40, true)).toBe(true);
    expect(headerCompactAtScroll(HEADER_EXPAND_SCROLL_Y, true)).toBe(false);
    expect(headerCompactAtScroll(13, true)).toBe(true);
  });

  test("ignores invalid measurements and treats iOS overscroll as the top", () => {
    expect(headerCompactAtScroll(NaN, true)).toBe(true);
    expect(headerCompactAtScroll(Infinity, false)).toBe(false);
    expect(headerCompactAtScroll(-8, true)).toBe(false);
  });
});
