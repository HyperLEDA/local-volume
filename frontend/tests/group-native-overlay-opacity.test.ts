import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sky = readFileSync(
  new URL("../src/components/GroupSkyMap.tsx", import.meta.url),
  "utf8",
);
const begin = sky.indexOf("// Build sky polygons once from SOURCE membership.");
const end = sky.indexOf(
  "nativeSubgroupController.current = presentation.apply;",
  begin,
);
const native = begin >= 0 && end > begin ? sky.slice(begin, end) : "";

describe("#64 Stage 03e: independent native subgroup alpha", () => {
  test("keeps the source-defined celestial outlines opaque and permanently mounted", () => {
    expect(native).toContain(
      "Stage 03e: opacity-isolated native celestial contours",
    );
    expect(native).toContain("view.addOverlay(outlines)");
    expect(native).toContain("view.addOverlay(subgroupFill)");
    expect(native).toContain("view.addOverlay(highlights)");
    const outlines = native.slice(
      native.indexOf("for (const subgroup of celestial)"),
      native.indexOf("outlines.reportChange()"),
    );
    expect(outlines).toMatch(/opacity:\s*1\b/);
    expect(outlines).not.toMatch(/opacity:\s*0\./);
  });

  test("never uses low fill alpha for the highlighted contour stroke", () => {
    const emphasis = native.slice(native.indexOf("lastEmphasis = desired;"));
    expect(emphasis).toContain("subgroupFill.add(");
    expect(emphasis).toContain("highlights.add(");
    expect(emphasis).toContain('fillColor: "rgba(135, 214, 209, 0.13)"');
    expect(emphasis).not.toMatch(/opacity:\s*0\./);
    expect(emphasis.match(/opacity:\s*1\b/g)).toHaveLength(2);
    expect(emphasis).toMatch(/fill:\s*false/);
    expect(emphasis).not.toContain("opacity: hasHoles");
  });

  test("resets both hover overlays without changing subgroup membership", () => {
    expect(native).toContain("subgroupFill.removeAll()");
    expect(native).toContain("highlights.removeAll()");
    expect(native).toContain("buildCelestialSubgroups(group)");
    expect(native).toContain("new Map<number, CelestialSubgroup>");
  });
});
