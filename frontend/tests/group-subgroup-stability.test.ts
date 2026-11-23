import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildSubgroupRegion } from "../src/lib/groupSubgroupRegion.ts";

const a = { pgc: 10, x: 100, y: 100 };
const b = { pgc: 11, x: 185, y: 100 };
const relation = [{ fromPgc: 11, toPgc: 10 }];

describe("#64 smooth connected subgroup selection", () => {
  test("keeps a hierarchy-connected footprint at both zoom levels", () => {
    const near = buildSubgroupRegion([a, b], relation, [], 700, 700)!;
    const far = buildSubgroupRegion(
      [a, { ...b, x: 460 }],
      relation,
      [],
      700,
      700,
    )!;
    expect(near.contains(143, 100)).toBe(true);
    expect(far.contains(280, 100)).toBe(true);
    expect(far.contains(280, 135)).toBe(false);
    expect(far.outline.match(/M/g)?.length).toBe(1);
    expect(far.outline).toContain("Q");
  });
  test("routes around an intervening unrelated galaxy", () => {
    const mid = { pgc: 99, x: 280, y: 100 };
    const region = buildSubgroupRegion(
      [a, { ...b, x: 460 }],
      relation,
      [mid],
      700,
      700,
    )!;
    expect(region.contains(mid.x, mid.y)).toBe(false);
    expect(region.contains(a.x, a.y)).toBe(true);
    expect(region.contains(460, 100)).toBe(true);
    expect(region.outline.match(/M/g)?.length).toBe(1);
  });
  test("does not invent a connection when the catalogue supplies none", () => {
    const region = buildSubgroupRegion([a, b], [], [], 700, 700)!;
    expect(region.contains(143, 100)).toBe(false);
  });
  test("keeps a small hover tolerance without admitting foreground markers", () => {
    const foreign = { pgc: 99, x: 143, y: 115 };
    const region = buildSubgroupRegion([a, b], relation, [foreign], 700, 700)!;
    expect(region.contains(143, 101, 2.5)).toBe(false);
    expect(region.contains(143, 115, 2.5)).toBe(false);
  });
  test("presentation uses no dropdown and puts group context below sky survey", () => {
    const links = readFileSync(
      new URL("../src/components/ObjectGroupLinks.tsx", import.meta.url),
      "utf8",
    );
    const page = readFileSync(
      new URL("../src/pages/ObjectPage.tsx", import.meta.url),
      "utf8",
    );
    const sky = page.indexOf('className="galaxy-survey-controls"');
    const membership = page.indexOf("<ObjectGroupLinks pgc={data.pgc} />");
    const external = page.indexOf(
      "<ExternalCatalogLinks pgc={data.pgc} />",
      membership,
    );
    expect(links).not.toContain("<details>");
    expect(links).toContain("groupMembershipUrl(group)");
    expect(sky).toBeGreaterThan(-1);
    expect(membership).toBeGreaterThan(sky);
    expect(external).toBeGreaterThan(membership);
  });
  test("the group property matrix inherits galaxy readability rather than tiny labels", () => {
    const groupCss = readFileSync(
      new URL("../src/styles/groups.css", import.meta.url),
      "utf8",
    );
    expect(groupCss).toContain("Stage 03c: Galaxy-scale group matrix");
    const component = readFileSync(
      new URL("../src/components/GroupParameters.tsx", import.meta.url),
      "utf8",
    );
    expect(component).toContain("parameter-matrix group-parameters-matrix");
  });
});
