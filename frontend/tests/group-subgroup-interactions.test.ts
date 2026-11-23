/* LV LEDA Milestone 02 — Stage 03b */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("#64 revised subgroup hover, selection, and member navigation", () => {
  const ui = readFileSync(
    new URL("../src/components/GroupTidalUI.tsx", import.meta.url),
    "utf8",
  );
  const sky = readFileSync(
    new URL("../src/components/GroupSkyMap.tsx", import.meta.url),
    "utf8",
  );
  test("has no persistent subgroup text or bounding ellipses", () => {
    expect(ui).not.toContain("subgroupScreenFootprint(");
    expect(ui).not.toContain("<ellipse");
    expect(ui).not.toContain("<text x=");
    expect(ui).toContain("buildCelestialSubgroups(group)");
    expect(ui).not.toContain("buildSubgroupRegion(");
    expect(sky).toContain("Stage 03d: native celestial subgroup contours");
  });
  test("selects through the map without blocking native Aladin marker clicks", () => {
    expect(ui).toContain('map.addEventListener("pointermove", move, true)');
    expect(ui).toContain('map.addEventListener("click", click, true)');
    expect(ui).toContain("if (onMarker(x, y)) return;");
    expect(ui).toContain('pointerEvents="none"');
  });
  test("opens a labelled subgroup card with actual member links and preserves group context", () => {
    expect(ui).toContain('aria-label="Subgroup galaxies"');
    expect(ui).toContain("activeSubgroup.memberPgcs.map");
    expect(ui).toMatch(/<Link\s+to=\{`\/object\/\$\{pgc\}`\}/);
    expect(ui).toContain("onMemberNavigate?.(member.pgc)");
    expect(sky).toContain("onMemberNavigate={onMemberNavigate}");
  });
  test("retains native tidal pair popup and the existing toggle", () => {
    expect(ui).toContain('aria-label="Selected tidal pair"');
    expect(ui).toContain("tidalEdgeTooltip(item.edge)");
    expect(ui).toMatch(/<input\s+type="checkbox"\s+checked=\{showSubgroups\}/);
    expect(ui).toContain('aria-label="Show subgroup"');
  });
});
