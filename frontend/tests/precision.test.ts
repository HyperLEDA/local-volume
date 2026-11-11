import { describe, expect, test } from "bun:test";
import { formatParameterDisplay } from "../src/lib/precision.ts";

const degrees = { unit: "deg", ucd: "pos.eq.ra" };
const magnitudes = { unit: "mag", ucd: "phot.mag" };
const velocities = { unit: "km/s", ucd: "spect.dopplerVeloc" };

function pair(
  key: string,
  value: unknown,
  error: unknown,
  meta: { unit?: string | null; ucd?: string | null },
  errorUnit = meta.unit ?? null,
) {
  return formatParameterDisplay(key, value, error, meta, { unit: errorUnit });
}

describe("display-only precision", () => {
  test("keeps degree positions consistent with sub-arcsecond errors", () => {
    expect(pair("ra", 150.82851482124977, 0.00008147, degrees)).toEqual({
      value: "150.828515",
      error: "0.000081",
    });
  });

  test("matches magnitude value and error decimal places", () => {
    expect(pair("bt", 10.6175, 0.051, magnitudes)).toEqual({
      value: "10.618",
      error: "0.051",
    });
    expect(pair("kt", 7.411, 0.113, magnitudes)).toEqual({
      value: "7.41",
      error: "0.11",
    });
  });

  test("rounds positive and negative velocities at the error precision", () => {
    expect(pair("v_hel", -7.826548909, 3.694945, velocities)).toEqual({
      value: "-7.8",
      error: "3.7",
    });
    expect(pair("v_lg", 133.346124558, 4.577437, velocities)).toEqual({
      value: "133.3",
      error: "4.6",
    });
  });

  test("preserves trailing zeroes needed for two significant error digits", () => {
    expect(pair("bt", 13.2, 0.1, magnitudes)).toEqual({
      value: "13.20",
      error: "0.10",
    });
    expect(pair("bt", 13.25, 0.0999, magnitudes)).toEqual({
      value: "13.25",
      error: "0.10",
    });
  });

  test("rounds large uncertainties to tens or hundreds", () => {
    expect(pair("v_hel", 12345.6, 1670, velocities)).toEqual({
      value: "12300",
      error: "1700",
    });
  });

  test("does not couple degree value and arcsecond uncertainty", () => {
    expect(pair("ra", 12.123456789, 0.5, degrees, "arcsec")).toEqual({
      value: "12.123457",
      error: "0.50",
    });
  });

  test("uses configurable metadata fallbacks without a measured uncertainty", () => {
    expect(
      formatParameterDisplay("a50", 63.7626, null, { unit: "arcsec" }, null)
        .value,
    ).toBe("63.8");
    expect(
      formatParameterDisplay("kt", 7.411234, null, magnitudes, null).value,
    ).toBe("7.41");
    expect(
      formatParameterDisplay("dist", 12.3456, null, { unit: "Mpc" }, null)
        .value,
    ).toBe("12.35");
    expect(
      formatParameterDisplay(
        "pa",
        87.777,
        null,
        { unit: "deg", ucd: "pos.posAng" },
        null,
      ).value,
    ).toBe("87.8");
    expect(formatParameterDisplay("n", 12345, null, {}, null).value).toBe(
      "12345",
    );
  });

  test("preserves reported zero error and never invents error", () => {
    expect(pair("ra", 12.25, 0, degrees)).toEqual({
      value: "12.25",
      error: "0",
    });
    expect(formatParameterDisplay("ra", 12.25, null, degrees, null)).toEqual({
      value: "12.25",
      error: null,
    });
  });

  test("preserves text and unknown values without numeric coercion", () => {
    expect(
      formatParameterDisplay("d_26", "<2", null, { unit: "arcsec" }, null),
    ).toEqual({
      value: "<2",
      error: null,
    });
    expect(formatParameterDisplay("unknown", null, null, {}, null).value).toBe(
      "",
    );
  });

  test("handles a very small positive uncertainty without rounding to zero", () => {
    const result = pair("ra", 1.2345678901234, 0.000000000000015, degrees);
    expect(result.error).toBe("1.5e-14");
    expect(result.value).toBe("1.23456789012");
  });
});
