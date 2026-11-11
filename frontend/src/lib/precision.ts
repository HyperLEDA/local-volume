/** Display-only precision policy for physical parameters. API values are untouched. */
export type PrecisionMeta = {
  unit?: string | null;
  ucd?: string | null;
};

export type DisplayMeasurement = {
  value: string;
  error: string | null;
};

// Use two significant digits for every positive measured uncertainty.
// Central values are rounded to the same decimal place, not independently.
const ERROR_SIGNIFICANT_DIGITS = 2;
const MAX_FIXED_DECIMALS = 12;

function plainText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function fixedWithoutPadding(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

function defaultDecimals(key: string, meta: PrecisionMeta): number | null {
  const normalizedKey = key.toLowerCase();
  const unit = meta.unit?.trim().toLowerCase() ?? "";
  const ucd = meta.ucd?.toLowerCase() ?? "";

  // Astrometry is stored in decimal degrees; avoid long binary floating tails.
  if (
    normalizedKey === "ra" ||
    normalizedKey === "dec" ||
    ucd.includes("pos.eq.ra") ||
    ucd.includes("pos.eq.dec")
  ) {
    return 6;
  }
  if (normalizedKey === "pa" || ucd.includes("pos.posang")) {
    return 1;
  }
  if (unit === "deg") {
    return 5;
  }
  if (unit === "arcsec" || unit === "arcmin") {
    return 1;
  }
  if (unit === "mag" || ucd.includes("phot.mag")) {
    return 2;
  }
  if (unit === "km/s" || ucd.includes("spect.dopplerveloc")) {
    return 1;
  }
  if (unit === "mpc" || unit === "kpc") {
    return 2;
  }
  if (
    normalizedKey === "b/a" ||
    normalizedKey === "axis_ratio" ||
    ucd.includes("phys.size.axisratio")
  ) {
    return 3;
  }
  if (normalizedKey === "t") {
    return 1;
  }
  return null;
}

function formatWithoutUncertainty(
  key: string,
  value: number,
  meta: PrecisionMeta,
): string {
  const decimals = defaultDecimals(key, meta);
  if (decimals !== null) {
    return fixedWithoutPadding(value, decimals);
  }
  // Preserve integral counts and other exact integers when no uncertainty
  // or suitable physical-unit metadata is available.
  if (Number.isInteger(value)) {
    return String(value);
  }
  // Unknown quantities: a conservative generic presentation, not an
  // assertion about the actual measurement precision.
  return String(Number(value.toPrecision(4)));
}

function roundToPlace(value: number, place: number): number {
  const increment = 10 ** place;
  return Math.sign(value) * Math.round(Math.abs(value) / increment) * increment;
}

function formatAtPlace(value: number, place: number): string {
  if (place >= 0) {
    return String(roundToPlace(value, place));
  }
  const decimals = -place;
  const fixed = roundToPlace(value, place).toFixed(decimals);
  // Avoid reporting negative zero after a decimal rounding.
  return Number(fixed) === 0 ? (0).toFixed(decimals) : fixed;
}

function roundedUncertainty(error: number): { rounded: number; place: number } {
  const rounded = Number(error.toPrecision(ERROR_SIGNIFICANT_DIGITS));
  // Compute the place from the *rounded* value so that 0.0999 -> 0.10,
  // rather than incorrectly displaying 0.100 (three significant digits).
  const place =
    Math.floor(Math.log10(rounded)) - (ERROR_SIGNIFICANT_DIGITS - 1);
  return { rounded, place };
}

export function formatParameterDisplay(
  key: string,
  rawValue: unknown,
  rawError: unknown,
  meta: PrecisionMeta,
  errorMeta: PrecisionMeta | null,
): DisplayMeasurement {
  const valueIsNumeric =
    typeof rawValue === "number" && Number.isFinite(rawValue);
  const errorIsPositive =
    typeof rawError === "number" && Number.isFinite(rawError) && rawError > 0;

  if (errorIsPositive) {
    const { rounded, place } = roundedUncertainty(rawError);
    const sameUnit = (errorMeta?.unit ?? null) === (meta.unit ?? null);
    const errorText =
      place < -MAX_FIXED_DECIMALS
        ? rounded.toPrecision(ERROR_SIGNIFICANT_DIGITS)
        : formatAtPlace(rounded, place);

    if (valueIsNumeric && sameUnit) {
      return {
        value:
          place < -MAX_FIXED_DECIMALS
            ? rawValue.toPrecision(12)
            : formatAtPlace(rawValue, place),
        error: errorText,
      };
    }
    // If value and error have different units (e.g. degrees and arcseconds),
    // do not silently interpret the error's decimal place in the value's unit.
    return {
      value: valueIsNumeric
        ? formatWithoutUncertainty(key, rawValue, meta)
        : plainText(rawValue),
      error: errorText,
    };
  }

  // Missing or zero uncertainties cannot determine precision. Use the
  // field-specific fallback; preserve non-numeric values and reported zeros.
  return {
    value: valueIsNumeric
      ? formatWithoutUncertainty(key, rawValue, meta)
      : plainText(rawValue),
    error:
      rawError === null || rawError === undefined ? null : plainText(rawError),
  };
}
