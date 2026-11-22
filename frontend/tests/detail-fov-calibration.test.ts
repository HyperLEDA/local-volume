import { describe, expect, test } from "bun:test";
import {
  detailFovNeedsCorrection,
  detailViewportIsSquare,
} from "../src/lib/detailFovCalibration.ts";

describe("initial galaxy-detail sky calibration", () => {
  test("requires synchronized, square CSS and Aladin WebGL viewports", () => {
    expect(detailViewportIsSquare(600, 600, 600, 600)).toBe(true);
    expect(detailViewportIsSquare(600, 600, 300, 150)).toBe(false);
    expect(detailViewportIsSquare(600, 540, 600, 540)).toBe(false);
    expect(detailViewportIsSquare(600, 600, 599, 601)).toBe(true);
    expect(detailViewportIsSquare(NaN, 600, 600, 600)).toBe(false);
  });

  test("M 110 corrects both sky axes to its 19.5-arcmin diameter", () => {
    const requested = 19.5 / 60;
    expect(detailFovNeedsCorrection([10.32 / 60, 10.32 / 60], requested)).toBe(true);
    expect(detailFovNeedsCorrection([requested, requested], requested)).toBe(false);
    expect(detailFovNeedsCorrection([requested, 0.26], requested)).toBe(true);
  });

  test("ignores unsupported measurements instead of dividing by zero", () => {
    expect(detailFovNeedsCorrection([0.3, 0.3], 0)).toBe(false);
    expect(detailFovNeedsCorrection([0.3, 0.3], NaN)).toBe(false);
    expect(detailFovNeedsCorrection([], 0.3)).toBe(false);
  });
});
