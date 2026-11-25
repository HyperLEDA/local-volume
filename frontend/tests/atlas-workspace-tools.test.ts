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
describe("task-oriented spatial workspace", () => {
  test("four independent pages keep one spatial canvas", () => {
    for (const page of ["view", "appearance", "select", "compare"]) {
      expect(view).toContain(`id="lv-spatial-tool-${page}"`);
      expect(view).toContain(`hidden={controlPage !== "${page}"}`);
    }
    expect(view.match(/ref=\{host\}/g)?.length).toBe(1);
    expect(css).toContain(".lv-spatial-tool-page[hidden]");
  });
  test("active filters, transfer and reset remain reachable", () => {
    expect(view).toContain("lv-spatial-active-summary");
    expect(view.match(/onClick=\{transferSample\}/g)?.length).toBe(1);
    expect(view).toContain("onClick={resetAtlas}");
    expect(view).toContain('onClick={() => changeControlPage("select")}');
  });
  test("comparison counts and search remain available without a duplicate result panel", () => {
    expect(view.match(/comparisonResult\.counts\[kind\]/g)?.length).toBe(1);
    expect(view).toContain("current.exportImage([])");
    expect(view).not.toContain("const legend: SpatialExportLine[]");
    expect(view).toContain(
      "const [browseOpen, setBrowseOpen] = useState(false)",
    );
    expect(view).toContain("aria-expanded={browseOpen}");
  });
});
