import { describe, expect, test } from "bun:test";
import {
  spatialExportRatio,
  withSpatialExportRatio,
  wrapSpatialExportLine,
} from "../src/lib/spatialImageExport.ts";

describe("Spatial PNG export", () => {
  test("bounded sampling preserves CSS framing", () => {
    expect(spatialExportRatio(800, 600, 8192)).toBe(3);
    expect(spatialExportRatio(2048, 1000, 8192)).toBe(2);
    expect(spatialExportRatio(800, 400, 1024)).toBe(1.28);
    expect(() => spatialExportRatio(0, 300, 4096)).toThrow();
  });
  test("drawing-buffer ratio is restored on successful capture", () => {
    let ratio = 1.5;
    const renderer = {
      getPixelRatio() {
        return ratio;
      },
      setPixelRatio(value: number) {
        ratio = value;
      },
    };
    expect(withSpatialExportRatio(renderer, 3, () => ratio)).toBe(3);
    expect(ratio).toBe(1.5);
  });
  test("drawing-buffer ratio is restored after a failed capture", () => {
    let ratio = 2;
    const renderer = {
      getPixelRatio() {
        return ratio;
      },
      setPixelRatio(value: number) {
        ratio = value;
      },
    };
    expect(() =>
      withSpatialExportRatio(renderer, 3, () => {
        throw new Error("capture failed");
      }),
    ).toThrow();
    expect(ratio).toBe(2);
  });
  test("wraps legend text without removing criteria", () => {
    expect(
      wrapSpatialExportLine(
        "A: dwarf AND negative Theta",
        10,
        (text) => text.length,
      ),
    ).toEqual(["A: dwarf", "AND", "negative", "Theta"]);
  });
});
