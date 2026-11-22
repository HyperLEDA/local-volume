import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/pages/ObjectPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/galaxySurveyControls.css", import.meta.url), "utf8");
const groupCss = readFileSync(new URL("../src/styles/groups.css", import.meta.url), "utf8");
const baseCss = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const galaxyCss = readFileSync(new URL("../src/components/physicalParameters.css", import.meta.url), "utf8");

describe("#66, #70: quiet angular scale and matched detail workspaces", () => {
  test("embeds the dynamic scale in the same visual container as Aladin", () => {
    const wrapper = page.indexOf('<div className="galaxy-sky-view">');
    const aladin = page.indexOf("<AladinMap", wrapper);
    const scale = page.indexOf('className="galaxy-angular-scale"', aladin);
    const surveys = page.indexOf('className="galaxy-survey-controls"', scale);
    expect(wrapper).toBeGreaterThan(-1);
    expect(aladin).toBeGreaterThan(wrapper);
    expect(scale).toBeGreaterThan(aladin);
    expect(surveys).toBeGreaterThan(scale);
    expect(css).toContain("position: absolute;");
    expect(css).toContain("pointer-events: none;");
    expect(css).toContain("bottom: 34px;");
    expect(css).toContain("isolation: isolate;");
  });

  test("compact visual label leaves source qualifications in accessible text", () => {
    expect(page).toMatch(
      /compactProjectedScale\s*!==\s*null\s*\?\s*` ≈ \$\{compactProjectedScale\}`\s*:\s*""/,
    );
    expect(page).toMatch(/at adopted distance \$\{scaleDistance\.dist\} Mpc/);
    expect(page).toContain("scaleDistance.distance_method");
    expect(page).not.toContain("galaxy-angular-scale-projected");
    expect(page).toContain("onDetailScaleChange={setAngularScale}");
  });

  test("the group and galaxy detail workspaces share 1740px, with an 800px group map", () => {
    expect(baseCss).toContain("--group-map-max-size: 800px;");
    expect(baseCss).toMatch(/body:has\(\.group-details\) \.app-workspace \{[^}]*max-width: 1740px;/s);
    expect(groupCss).toMatch(/\.groups-layout\.group-details \{[^}]*max-width: 1740px;/s);
    expect(galaxyCss).toContain("--galaxy-workspace-max-width: 1740px;");
    expect(groupCss).toContain("min(50%, var(--group-map-max-size, 800px))");
    expect(groupCss).toContain("minmax(400px, 1fr)");
  });
});
