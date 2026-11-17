import { describe, expect, test } from "bun:test";
import {
  formatUncertainty,
  nameIncludesPgc,
  parameterRows,
  type CatalogObjectDetail,
  type ColumnMeta,
} from "../src/api/objects.ts";

const schema: Record<string, ColumnMeta> = {
  pgc: { description: "PGC identifier" },
  name: { description: "Main designation" },
  ra: { description: "Right ascension", unit: "deg" },
  e_ra: { description: "Right ascension error", unit: "deg" },
  b_mag: { description: "B magnitude", unit: "mag" },
  e_b_mag: { description: "B magnitude error", unit: "mag" },
  lvg_v_hel_kms: { description: "Heliocentric velocity", unit: "km/s" },
  lvg_e_v_hel_kms: { description: "Heliocentric velocity error", unit: "km/s" },
  type_name: { description: "Object type" },
  names: { description: "Additional designations" },
};

const data: CatalogObjectDetail & { e_b_mag: number } = {
  pgc: 83,
  name: "NGC 123",
  names: ["LEDA 83"],
  type_name: "G",
  ra: 12.25,
  e_ra: 0,
  b_mag: 13.2,
  e_b_mag: 0.1,
  lvg_v_hel_kms: 350,
};

describe("nameIncludesPgc", () => {
  test("recognizes the canonical PGC even with spaces and leading zeros", () => {
    expect(nameIncludesPgc("PGC 000083", 83)).toBe(true);
    expect(nameIncludesPgc("pgc83", 83)).toBe(true);
    expect(nameIncludesPgc("NGC 123 (PGC 83)", 83)).toBe(true);
  });

  test("does not hide an unrelated identifier", () => {
    expect(nameIncludesPgc("NGC 123", 83)).toBe(false);
    expect(nameIncludesPgc("PGC 84", 83)).toBe(false);
    expect(nameIncludesPgc("PGC 830", 83)).toBe(false);
  });
});

describe("parameterRows", () => {
  test("groups uncertainties and excludes identity metadata", () => {
    const rows = parameterRows(data, schema);
    expect(rows.map((row) => row.name)).toEqual(["ra", "b_mag", "lvg_v_hel_kms"]);
    expect(rows[0]).toMatchObject({
      unit: "deg",
      value: "12.25",
      error: null,
      errorUnit: null,
    });
    expect(rows[1]).toMatchObject({ value: "13.2", error: "0.1" });
    expect(rows[2]).toMatchObject({ value: "350", error: null });
  });

  test("retains an orphan uncertainty rather than silently discarding it", () => {
    const orphan = parameterRows(
      { pgc: 83, name: "NGC 123", names: [], e_b_mag: 0.4 } as CatalogObjectDetail,
      schema,
    );
    expect(orphan).toEqual([
      {
        name: "e_b_mag",
        nice: null,
        description: "B magnitude error",
        unit: "mag",
        value: "0.4",
        error: null,
        errorUnit: null,
      },
    ]);
  });

  test("preserves the error's unit when different from the value's unit", () => {
    const rows = parameterRows(
      { pgc: 83, name: "NGC 123", names: [], ra: 12, e_ra: 0.5 },
      { ...schema, e_ra: { description: "RA error", unit: "arcsec" } },
    );
    expect(rows[0]).toMatchObject({
      name: "ra",
      value: "12",
      error: "0.5",
      errorUnit: "arcsec",
      unit: "deg",
    });
  });

  test("leaves the input object unchanged", () => {
    const original = { ...data };
    parameterRows(data, schema);
    expect(data).toEqual(original);
  });
});

describe("formatUncertainty", () => {
  test("adds the plus-minus sign to a reported uncertainty", () => {
    expect(formatUncertainty("0.1")).toBe("± 0.1");
    expect(formatUncertainty("2.75")).toBe("± 2.75");
  });

  test("preserves an exact zero uncertainty", () => {
    expect(formatUncertainty("0")).toBe("± 0");
  });

  test("renders missing uncertainties as a dash", () => {
    expect(formatUncertainty(null)).toBe("—");
    expect(formatUncertainty("")).toBe("—");
  });
});

describe("nice parameter labels", () => {
  test("forwards preferred names from column metadata without replacing identifiers", () => {
    const rows = parameterRows(data, {
      ...schema,
      b_mag: { ...schema.b_mag, nice: "B<sub>T</sub>" },
      ra: { ...schema.ra, nice: "α" },
    });
    expect(rows.find((row) => row.name === "b_mag")?.nice).toBe("B<sub>T</sub>");
    expect(rows.find((row) => row.name === "ra")?.nice).toBe("α");
    expect(rows.find((row) => row.name === "lvg_v_hel_kms")?.nice).toBeNull();
  });

  test("never changes data or reported errors because of a nice label", () => {
    const rows = parameterRows(data, {
      ...schema,
      b_mag: { ...schema.b_mag, nice: "B<sub>T</sub>" },
    });
    expect(rows.find((row) => row.name === "b_mag")).toMatchObject({
      value: "13.2",
      error: "0.1",
      name: "b_mag",
    });
  });
});
