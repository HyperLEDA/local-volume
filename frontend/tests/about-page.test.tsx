import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CatalogSidebar } from "../src/components/CatalogSidebar.tsx";
import {
  AboutPage,
  aboutMollweidePoints,
  aboutSkyPoints,
  aboutHierarchyLinks,
  aboutTrgbVelocitySample,
  aboutSampleManifest,
  aboutGroupCaptureMatches,
} from "../src/pages/AboutPage.tsx";
import type { CatalogObject } from "../src/api/objects.ts";
import type { GroupDetail } from "../src/api/groups.ts";

function object(
  pgc: number,
  ra: number | null,
  dec: number | null,
): CatalogObject {
  return {
    pgc,
    name: `PGC ${pgc}`,
    ra,
    dec,
    bt: null,
    v_hel: null,
    type_name: null,
    names: [],
  };
}
function markup() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/about"]}>
      <AboutPage />
    </MemoryRouter>,
  );
}
const source = readFileSync(
  new URL("../src/pages/AboutPage.tsx", import.meta.url),
  "utf8",
);

describe("Issue #85 v20.2: M104 hero, catalogue count and editorial layout", () => {
  test("keeps the original flyout and places About ahead of Explore", () => {
    const sidebar = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/about"]}>
        <CatalogSidebar />
      </MemoryRouter>,
    );
    const flyout = sidebar.slice(
      sidebar.indexOf('id="scientific-sidebar-flyout"'),
    );
    expect(flyout.indexOf("About LV LEDA")).toBeLessThan(
      flyout.indexOf("Explore LV LEDA"),
    );
  });
  test("Issue #85 v17: restored scientific editorial", () => {
    const page = markup();
    const chapters = [...source.matchAll(/number:\s*"0[1-6]",\s*label:/g)];
    expect(chapters).toHaveLength(6);
    expect(page.indexOf('id="about-v14-heritage"')).toBeLessThan(
      page.indexOf('id="about-v11-focus"'),
    );
    expect(page).toContain("04A / CATALOGUE SELECTION");
    expect(page).toContain("04B / INDIVIDUAL GALAXY");
    expect(page).toContain("04C / GROUP HIERARCHIES");
    expect(page).toContain("(Kovlakas et al., 2021)");
    expect(page).toContain("(Cook et al., 2023)");
  });
  test("moves bibliography into a compact, DOI-linked scientific lineage", () => {
    const page = markup();
    expect(page).toContain("A history of nearby-galaxy catalogues");
    expect(page).toContain("The nearby-galaxy census");
    expect(page).toContain("HyperLEDA and EDD");
    expect(page).toContain("Comparative satellite samples");
    expect(page).not.toContain(
      "Selected observational and theoretical literature.",
    );
    expect(page).not.toContain('class="about-v10-literature"');
    expect(page).toContain('id="about-v14-heritage"');
    expect(page).toContain('href="#about-v14-heritage"');
  });
  test("uses captured Atlas and Galaxy interfaces and resolves the Group figure asynchronously", () => {
    const page = markup();
    expect(page).toContain("/about/captures/atlas-sky.webp");
    expect(source).toContain("galaxy-case.webp");
    // The group and galaxy images share the same verified source PGC.
    expect(source).toContain("group-sky.webp");
    expect(source).toContain("group-suite.json");
    expect(source).toContain("galaxy-case.json");
    expect(source).toContain('fetchGroup(meta.root_pgc, "suite")');
    expect(source).toContain("controller.signal.aborted");
    expect(source).not.toContain("<iframe");
    expect(source).not.toContain("NativeAboutGroupMap");
    expect(source).toContain("View the original interface");
    expect(page).toContain("Scientific Atlas");
    expect(page).toContain("PGC 42407");
  });
  test("retains evidence-grounded scientific questions and the future issue tracker", () => {
    const page = markup();
    expect(page).toContain("Which dark-matter haloes host observable dwarfs?");
    expect(page).toContain(
      "How is star formation suppressed in low-mass galaxies?",
    );
    expect(page).toContain(
      "Which apparent associations are genuine galaxy systems?",
    );
    expect(page).toContain(
      "What do nearby deviations from the Hubble flow trace?",
    );
    for (const number of [78, 79, 80, 81, 82, 83, 87, 90, 93, 95]) {
      expect(page).toContain(
        `https://github.com/HyperLEDA/local-volume/issues/${number}`,
      );
    }
  });
  test("uses 20 real DOI entries in author-year inline citations, no bibliography wall", () => {
    const page = markup();
    for (const doi of [
      "10.1088/0004-6256/145/4/101",
      "10.1088/0004-6256/147/1/13",
      "10.1051/0004-6361/201423496",
      "10.1088/0004-6256/138/2/323",
      "10.33232/001c.144859",
      "10.1086/382905",
      "10.1086/516566",
      "10.1088/0004-6256/138/2/332",
      "10.1088/0004-637X/757/1/85",
      "10.1146/annurev-astro-091916-055313",
      "10.3847/0004-6256/152/2/50",
      "10.1088/0004-637X/804/2/136",
    ])
      expect(page).toContain(`href="https://doi.org/${doi}"`);
    expect(page).toContain("(Karachentsev et al., 2013)");
    expect(page).toContain("(Geha et al., 2012)");
  });
  test("restores full scientific navigation and source-data rules", () => {
    const page = markup();
    expect(page).toContain('aria-label="About LV LEDA chapters"');
    expect(page).toContain('href="#about-v10-why"');
    expect(page).toContain('href="#about-v11-future"');
    expect(page).toContain('href="#about-v14-heritage"');
    expect(page).toContain("The nearby velocity field");
    expect(page).toContain("Galaxies with adopted TRGB distances");
    expect(page).toContain("Scientific lineage");
    expect(page).not.toContain("1,677");
    const input = [
      object(1, 180, 0),
      object(2, 0, 0),
      object(3, 90, 0),
      object(4, 180, 90),
      object(5, 360, 0),
      object(6, 180, null),
      object(7, -1, 0),
    ];
    expect(aboutSkyPoints(input).map((p) => p.pgc)).toEqual([1, 2, 3, 4]);
    expect(aboutMollweidePoints(input).map((p) => p.pgc)).toEqual([1, 2, 3, 4]);
  });
  test("hierarchy edges are recorded only where the parent PGC is explicit and in sample", () => {
    expect(
      aboutHierarchyLinks([
        { pgc: 10, parent_md_pgc: null },
        { pgc: 11, parent_md_pgc: 10 },
        { pgc: 12, parent_md_pgc: 11 },
        { pgc: 13, parent_md_pgc: 999 },
        { pgc: 14, parent_md_pgc: 14 },
      ]),
    ).toEqual([
      { parent: 10, child: 11 },
      { parent: 11, child: 12 },
    ]);
  });
  test("sample selection uses the documented TRGB criteria without claiming completeness", () => {
    const records: CatalogObject[] = [
      {
        ...object(1, 10, 10),
        dist: 3.1,
        distance_method: "TRGB",
        lvg_v_lg_kms: 140,
      },
      {
        ...object(2, 10, 10),
        dist: 11.2,
        distance_method: "TRGB",
        lvg_v_lg_kms: 220,
      },
      {
        ...object(3, 10, 10),
        dist: 3.1,
        distance_method: "Tully-Fisher",
        lvg_v_lg_kms: 180,
      },
      {
        ...object(4, 10, 10),
        dist: 6,
        distance_method: "TRGB",
        lvg_v_lg_kms: null,
      },
      {
        ...object(5, 10, 10),
        dist: 11,
        distance_method: "TRGB",
        lvg_v_lg_kms: -40,
      },
    ];
    const selected = aboutTrgbVelocitySample(records);
    expect(selected.map((row) => row.pgc)).toEqual([1, 5]);
    const meta = aboutSampleManifest(
      { records, retrievedAt: "2026-11-23T12:00:00.000Z" },
      selected,
    );
    expect(meta.plotted_count).toBe(2);
    expect(meta.plotted_pgcs).toEqual([1, 5]);
    expect(meta.source_release).toBeNull();
    expect(meta.selection_function).toBe("Not modelled");
    expect(meta.velocity_frame).toBe("Local Group");
  });
  test("static group figure refuses mismatched source versions and counts", () => {
    const capture = {
      root_pgc: 42407,
      name: "M 104",
      member_count: 120,
      captured_at: "2026-11-22T00:00:00Z",
      source_catalog: "lv.physical",
      source_version: "2026-11-17-v2-uncertainties",
      source_sha256: "abc",
    };
    const record = {
      definition: "suite",
      root_pgc: 42407,
      member_count: 120,
      source_catalog: "lv.physical",
      source_version: "2026-11-17-v2-uncertainties",
      source_sha256: "abc",
    } as GroupDetail;
    expect(aboutGroupCaptureMatches(capture, record)).toBe(true);
    expect(
      aboutGroupCaptureMatches(capture, { ...record, member_count: 121 }),
    ).toBe(false);
    expect(
      aboutGroupCaptureMatches(capture, { ...record, source_version: "next" }),
    ).toBe(false);
    expect(
      aboutGroupCaptureMatches(capture, {
        ...record,
        source_sha256: "changed",
      }),
    ).toBe(false);
    expect(
      aboutGroupCaptureMatches(capture, { ...record, root_pgc: 28630 }),
    ).toBe(false);
  });
  test("the M104 hero and science case use the same PGC identifier", () => {
    const page = markup();
    expect(page).toContain("HUBBLE OBSERVATION · 2025");
    expect(page).toContain("The Local Volume organised for research");
    expect(page).not.toContain("Galaxies, measurements, environments");
    expect(page).toContain('class="about-v6-project-name">LV LEDA</span>');
    expect(page).toContain('href="#about-v6-object"');
    expect(page).toContain("M104 as a worked example");
    expect(page).toContain("PGC 42407");
    expect(page).not.toContain("Messier 81");
    expect(page).toContain("Sombrero Galaxy");
  });
  test("keeps full science, exportable plot, and improved readable visual layout", () => {
    const styles = readFileSync(
      new URL("../src/styles/about.css", import.meta.url),
      "utf8",
    );
    expect(styles).toContain(".about-v14-interface-capture");
    expect(styles).toContain(".about-v17-nav");
    const figureSource = readFileSync(
      new URL("../src/components/AboutVelocityFigure.tsx", import.meta.url),
      "utf8",
    );
    expect(figureSource).toContain("renderGroupFigureJpeg");
    expect(figureSource).toContain("GroupFigureInspector");
    expect(figureSource).toContain("lv-leda-trgb-vlg.jpg");
    expect(figureSource).toContain("lv-leda-trgb-vlg.png");
    expect(figureSource).toContain("lv-leda-trgb-vlg.csv");
    expect(figureSource).toContain("lv-leda-trgb-vlg-method.json");
    expect(figureSource).not.toContain("Open module");
    expect(source).not.toContain("API snapshot retrieved");
    expect(source).not.toContain("Current catalogue endpoint");
    expect(source).toContain("group.source_version !== meta.source_version");
    expect(source).not.toContain("This is an archived figure");
    const citations =
      source
        .split("const SCIENCE_REFERENCES = [")[1]
        ?.split("] as const;")[0] ?? "";
    expect(citations.match(/id:\s*"/g) ?? []).toHaveLength(22);
    expect(styles).toContain(".about-v14-heritage-sequence");
    expect(styles).toContain(".about-v14 .about-v6-section");
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("galaxy-case.json");
    expect(source).not.toContain('className="about-v14-group-table"'); // no duplicate table
  });
  test("the About narrative uses a square M104 observation and current LEDA identity", () => {
    const page = markup();
    const styles = readFileSync(
      new URL("../src/styles/about.css", import.meta.url),
      "utf8",
    );
    expect(page).toContain('class="about-v6-project-name">LV LEDA</span>');
    expect(page).not.toContain("From the census to M104");
    expect(page).not.toContain("Skip introduction");
    expect(page).not.toContain("celestial context");
    expect(page).not.toContain("a complete distance-limited sample");
    expect(page).toContain("M104 as a worked example");
    expect(page).toContain("SAO RAS · LEDA");
    expect(page).not.toContain("SAO RAS · HYPERLEDA");
    expect(page).not.toContain("LABORATORY");
    expect(source).toContain("heic2506a.jpg");
    expect(styles).toContain(".about-v21 .about-v6-hero-observation");
    expect(styles).toContain("aspect-ratio: 1 / 1");
  });
  test("catalogue coverage is a dynamic research fact and section headings align at the top", () => {
    const page = markup();
    const styles = readFileSync(
      new URL("../src/styles/about.css", import.meta.url),
      "utf8",
    );
    expect(page).toContain('aria-label="Current catalogue size"');
    expect(page).toContain("Catalogue coverage");
    expect(source).toContain("snapshot.records.length.toLocaleString");
    expect(page).not.toContain("1,677");
    expect(styles).toContain(".about-v21 .about-v6-section-heading");
    expect(styles).toContain("align-items: start");
    expect(styles).toContain(".about-v21-census");
    expect(page).toContain("Messier 104 in LV LEDA");
    expect(page).not.toContain("AS A RESOLVED LABORATORY");
    expect(source).not.toMatch(/\.\s*<\/p>/);
  });
});
