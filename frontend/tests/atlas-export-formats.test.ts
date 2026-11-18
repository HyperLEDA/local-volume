import { describe, expect, test } from "bun:test";
import type { CatalogObject } from "../src/api/objects.ts";
import {
  ATLAS_EXPORT_COLUMNS,
  atlasExportRows,
  buildAtlasCsv,
  buildAtlasJson,
  buildAtlasTsv,
} from "../src/lib/atlasExport.ts";
import {
  DEFAULT_SCIENTIFIC_FILTERS,
  matchesScientificFilters,
} from "../src/lib/scientificFilters.ts";

const galaxy: CatalogObject = {
  pgc: 42,
  name: "Объект, =test",
  ra: 0,
  dec: -2,
  dist: null,
  lvg_v_lg_kms: 100,
  hi21_mag: 13.2,
  hi21_limit: "<13.2",
  theta1: null,
  type_name: "dwarf",
  names: [],
};
const second: CatalogObject = {
  pgc: 7,
  name: "=unsafe formula",
  ra: 359.9,
  dec: 4,
  dist: 1.1,
  hi21_mag: null,
  hi21_limit: null,
  theta1: -0.4,
  type_name: null,
  names: [],
};

describe("scientific Atlas exports", () => {
  test("three formats use the exact same ordered source-native row model", () => {
    const objects = [galaxy, second];
    const json = JSON.parse(buildAtlasJson(objects, { query: "dwarf" })) as {
      rows: Record<string, unknown>[];
      columns: { key: string }[];
      metadata: { query: string };
    };
    const csv = buildAtlasCsv(objects);
    const tsv = buildAtlasTsv(objects);
    expect(json.rows).toEqual(atlasExportRows(objects));
    expect(json.columns.map((column) => column.key)).toEqual(
      ATLAS_EXPORT_COLUMNS.map((column) => column.key),
    );
    expect(json.rows.map((row) => row.pgc)).toEqual([42, 7]);
    expect(csv.indexOf('"42"')).toBeLessThan(csv.indexOf('"7"'));
    expect(tsv.indexOf("42\t")).toBeLessThan(tsv.indexOf("7\t"));
    expect(json.metadata.query).toBe("dwarf");
  });

  test("keeps H I upper limits as qualifiers and NULLs as null", () => {
    const rows = atlasExportRows([galaxy, second]);
    expect(rows[0]?.hi21_mag).toBe(13.2);
    expect(rows[0]?.hi21_limit).toBe("<13.2");
    expect(rows[0]?.distance_mpc).toBeNull();
    expect(rows[1]?.hi21_mag).toBeNull();
    expect(buildAtlasTsv([galaxy])).toContain("<13.2");
    expect(buildAtlasJson([galaxy], {})).toContain('"hi21_limit": "<13.2"');
  });

  test("handles empty selections and spreadsheet-formula names", () => {
    expect(atlasExportRows([])).toEqual([]);
    expect(JSON.parse(buildAtlasJson([], {})).rows).toEqual([]);
    expect(buildAtlasCsv([])).toContain("pgc,name,ra_deg");
    expect(buildAtlasCsv([second])).toContain("'=unsafe formula");
    expect(buildAtlasTsv([second])).toContain("'=unsafe formula");
    expect(buildAtlasJson([second], {})).toContain('"=unsafe formula"');
  });

  test("does not turn censored H I magnitudes into measured selections", () => {
    const filters = {
      ...DEFAULT_SCIENTIFIC_FILTERS,
      hi21: { active: true, min: 12, max: 14 },
      includeMissing: false,
    };
    expect(matchesScientificFilters(galaxy, filters)).toBe(false);
    expect(
      matchesScientificFilters({ ...galaxy, hi21_limit: null }, filters),
    ).toBe(true);
    expect(
      matchesScientificFilters(galaxy, { ...filters, includeMissing: true }),
    ).toBe(true);
  });

  test("scientific filters combine by AND without fabricating missing theta1", () => {
    const filters = {
      ...DEFAULT_SCIENTIFIC_FILTERS,
      distance: { active: true, min: 0, max: 5 },
      tidal: "isolated" as const,
      includeMissing: false,
    };
    expect(matchesScientificFilters(second, filters)).toBe(true);
    expect(matchesScientificFilters(galaxy, filters)).toBe(false);
    expect(matchesScientificFilters({ ...second, dist: 10 }, filters)).toBe(
      false,
    );
  });
});
