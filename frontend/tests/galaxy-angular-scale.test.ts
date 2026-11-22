import { describe, expect, test } from "bun:test";
import {
  getGalaxyAngularScale,
  greatCircleDegrees,
  projectedScaleLabel,
} from "../src/lib/galaxyAngularScale.ts";

describe("#66: scientifically qualified dynamic image scale", () => {
  test("uses real pixel-to-sky geometry rather than initial requested FoV", () => {
    const scale = getGalaxyAngularScale({
      getSize: () => [600, 600],
      pix2world: (x: number) => [((x - 300) / 3600 + 360) % 360, 0],
    });
    expect(scale?.arcmin).toBe(1);
    expect(scale?.angleLabel).toBe("1′");
    expect(scale?.pixels).toBeCloseTo(60, 3);
  });
  test("degree labels use three significant figures without changing the ruler", () => {
    const scale = getGalaxyAngularScale({
      getSize: () => [600, 600],
      pix2world: (x: number) => [((x - 300) * 2) / 110, 0],
    });
    expect(scale?.arcmin).toBe(100);
    expect(scale?.angleLabel).toBe("1.67°");
    expect(scale?.pixels).toBeCloseTo(110 * (100 / 120), 3);
    expect(scale === null ? null : projectedScaleLabel(scale.arcmin, 0.77)).toBe("22.4 kpc projected");
  });
  test("handles RA=0 and refuses invalid or uninitialized WebGL sizes", () => {
    expect(greatCircleDegrees(359.999, 0, 0.001, 0)).toBeCloseTo(0.002, 6);
    expect(getGalaxyAngularScale({getSize: () => [0, 0], pix2world: () => null})).toBeNull();
    expect(getGalaxyAngularScale({getSize: () => [600, 600], pix2world: () => null})).toBeNull();
  });
  test("uses adopted D only for a projected transverse conversion", () => {
    expect(projectedScaleLabel(1, 1)).toBe("291 pc projected");
    expect(projectedScaleLabel(1, null)).toBeNull();
    expect(projectedScaleLabel(1, -1)).toBeNull();
    expect(projectedScaleLabel(1, Number.NaN)).toBeNull();
  });
});
