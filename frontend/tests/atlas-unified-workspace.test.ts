import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
const view = readFileSync(
  new URL("../src/components/SpatialAtlasView.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/components/SpatialAtlasView.css", import.meta.url),
  "utf8",
);
function page(name: string, next: string): string {
  return view.slice(
    view.indexOf(`id="lv-spatial-tool-${name}"`),
    view.indexOf(next),
  );
}
describe("Unified Atlas workspace", () => {
  test("preserves four control pages and one persistent canvas", () => {
    for (const name of ["view", "appearance", "select", "compare"]) {
      expect(view).toContain(`id="lv-spatial-tool-${name}"`);
      expect(view).toContain(`hidden={controlPage !== "${name}"}`);
    }
    expect(view.match(/ref=\{host\}/g)?.length).toBe(1);
    expect(view).toMatch(/label:\s*"Analysis"/);
  });
  test("scientific connectivity and population comparison share Analysis", () => {
    const appearance = page("appearance", 'id="lv-spatial-tool-select"');
    const analysis = page("compare", 'aria-label="Spatial view"');
    expect(appearance).not.toContain('aria-label="Spatial connectivity"');
    expect(analysis).toContain('aria-label="Spatial connectivity"');
    expect(analysis).toContain('aria-label="Population comparison"');
    expect(analysis).toContain("Run FoF");
    expect(analysis).toContain("Run Cut MST");
    expect(analysis).toContain("Clear connectivity");
  });
  test("appearance keeps colour, markers and reference layers", () => {
    const appearance = page("appearance", 'id="lv-spatial-tool-select"');
    for (const label of [
      "Colour encoding",
      "Galaxy size encoding",
      "Radial peculiar velocity vectors",
      "Distance intervals",
      "Zone of Avoidance",
    ])
      expect(appearance).toContain(label);
    expect(view.match(/comparisonResult\.counts\[kind\]/g)?.length).toBe(1);
    expect(view.match(/onClick=\{transferSample\}/g)?.length).toBe(1);
  });
  test("numeric fields and search are themed without changing the workspace grid", () => {
    expect(css).toContain(
      '.lv-spatial-dialog .lv-spatial-panel input[type="number"]',
    );
    expect(css).toContain(
      '.lv-spatial-dialog .lv-spatial-panel input[type="search"]',
    );
    expect(css).toContain("--spatial-input-bg");
    expect(css).toContain(
      ".lv-spatial-stage--light .lv-spatial-environment-hud",
    );
    expect(css).toContain(".lv-spatial-tool-page[hidden]");
  });
  test("direct tool navigation removes nested disclosures without losing filters", () => {
    const tools = page("appearance", 'aria-label="Spatial view"');
    expect(tools).not.toContain("<details");
    expect(tools).toContain('label="Appearance tools"');
    expect(tools).toContain('label="Selection tools"');
    expect(tools).toContain('hidden={selectionPage !== "region"}');
    expect(tools).toContain('hidden={selectionPage !== "populations"}');
    expect(tools).toContain("onClick={applySelection}");
    expect(tools).toContain("onClick={clearSpatialSelection}");
    expect(tools).toContain('label="Population to edit"');
    expect(tools).toContain("onClick={transferSample}");
    expect(css).toContain(".lv-spatial-tool-page [hidden]");
  });
  test("connectivity describes each draft method and retains explicit execution", () => {
    const analysis = page("compare", 'aria-label="Spatial view"');
    expect(analysis).toContain("Friends-of-Friends (FoF) links every pair");
    expect(analysis).toContain("minimum spanning tree (MST) connects");
    expect(analysis).toContain("Cut MST removes all tree edges");
    expect(analysis).not.toContain(
      "Visible eligible galaxies; nominal distances. MST minimizes",
    );
    expect(analysis).toContain("Run Cut MST");
    expect(analysis).toContain("Clear connectivity");
    expect(view).toMatch(/Nominal connectivity,\s+not\s+physical membership/);
  });
});

describe("Atlas polish", () => {
  test("single export footer lives outside the scrolling tools and all four pages", () => {
    const tools = view.slice(
      view.indexOf('className="lv-spatial-tools"'),
      view.indexOf('aria-label="Spatial view"'),
    );
    expect(tools.match(/void exportPng\(\)/g)?.length).toBe(1);
    expect(
      tools.indexOf(
        '<footer className="lv-spatial-export lv-spatial-export-footer"',
      ),
    ).toBeGreaterThan(tools.indexOf('id="lv-spatial-tool-compare"'));
    expect(tools).toMatch(
      /<\/div>\s*<\/div>\s*<footer className="lv-spatial-export lv-spatial-export-footer"/,
    );
    expect(css).toContain(".lv-spatial-export-footer");
  });
  test("global reset is on the title; local resets remain distinct", () => {
    const header = view.slice(
      view.indexOf('<header className="lv-spatial-header"'),
      view.indexOf("</header>"),
    );
    expect(header).toContain("onClick={resetAtlas}");
    for (const handler of [
      "resetView",
      "resetAppearance",
      "resetSelect",
      "resetAnalysis",
      "resetDisplay",
      "resetCamera",
      "resetRegion",
      "resetPopulations",
      "resetConnectivity",
      "resetComparison",
    ])
      expect(view).toContain(`onReset={${handler}}`);
    expect(view).not.toContain("Local Volume · Mpc");
    expect(view).not.toContain(" · ");
    expect(view).toContain("requiresGalaxies");
    const localResets = view.slice(
      view.indexOf("function resetDisplay()"),
      view.indexOf("function resetAtlas()"),
    );
    expect(localResets).not.toContain("setEnvironmentHubble(");
    expect(localResets).not.toContain("resetAtlas(");
  });
  test("inspector separates search, selection, counts and scientific legend", () => {
    const inspector = view.slice(
      view.indexOf('aria-label="Catalogue inspector"'),
    );
    expect(inspector).toContain('aria-label="Object search"');
    expect(inspector).toContain('aria-label="Selected object"');
    expect(inspector).toContain('aria-label="Catalogue coverage"');
    expect(inspector).toContain('aria-label="Legend"');
    expect(inspector).toContain('aria-label="Connectivity results"');
    expect(inspector).not.toContain(
      "Select an object in the scene or search results.",
    );
    expect(inspector).not.toContain("<summary>Navigation</summary>");
    expect(inspector).toContain("Coordinates & provenance");
    expect(inspector).toContain("!activeShown.has(currentGalaxy.object.pgc)");
  });
});
