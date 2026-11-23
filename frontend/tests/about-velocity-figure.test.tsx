import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildAboutVelocityGroupFigure } from "../src/components/AboutVelocityFigure.tsx";

const figureSource = readFileSync(
  new URL("../src/components/AboutVelocityFigure.tsx", import.meta.url),
  "utf8",
);
const sharedSource = readFileSync(
  new URL("../src/lib/groupFigureJpeg.ts", import.meta.url),
  "utf8",
);

describe("Issue #85: nearby velocity field uses Group Page scientific figures", () => {
  const figure = buildAboutVelocityGroupFigure([
    { pgc: 42407, name: "M104", distance: 9.55, velocity: 894, method: "TRGB" },
    { pgc: 28630, name: "M81", distance: 3.7, velocity: 104, method: "TRGB" },
  ]);
  test("adopts the Group Page data model and genuine scientific axis typesetting", () => {
    expect(figure.kind).toBe("scatter");
    expect(figure.key).toBe("velocity-distance");
    expect(figure.xLabel).toBe("D [Mpc]");
    expect(figure.yLabel).toBe("V_LG [km s⁻¹]");
    expect(figure.points.map((point) => point.pgc)).toEqual([42407, 28630]);
  });
  test("shows a reference Hubble law, not a regression through the sample", () => {
    expect(figure.lines).toEqual([
      { slope: 70, intercept: 0, label: "H₀ = 70 km s⁻¹ Mpc⁻¹" },
    ]);
    expect(sharedSource).toContain("plot.lines ?? []");
    expect(figure.xDomain).toEqual([0, 11]);
    expect(figure.yDomain?.[0]).toBeLessThan(0);
    expect(figure.yDomain?.[1]).toBeGreaterThan(894);
  });
  test("shares the group renderer, native modal and point inspection", () => {
    expect(figureSource).toContain("renderGroupFigureJpeg");
    expect(figureSource).toContain("GroupFigureInspector");
    expect(figureSource).toContain(
      'className="group-figure-dialog about-v19-figure-dialog"',
    );
    expect(figureSource).toContain("groupFigureCsv");
    expect(figureSource).not.toContain("Open module");
  });
  test("preserves the original measurement columns in scientific exports", () => {
    expect(figure.csvRows[0]).toEqual({
      pgc: 42407,
      name: "M104",
      distance_mpc: 9.55,
      v_lg_kms: 894,
      distance_method: "TRGB",
    });
    expect(figureSource).toContain('"lv-leda-trgb-vlg.csv"');
    expect(figureSource).toContain('"lv-leda-trgb-vlg-method.json"');
  });
});
