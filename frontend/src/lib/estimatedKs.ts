/** Display-only estimate; original LVGDB photometry and provenance remain unchanged. */
export type KsInputs = {
  ks_mag?: unknown;
  ks_estimated?: unknown;
  b_mag?: unknown;
  morphology_t?: unknown;
};

export type KsDisplay = { value: number | null; estimated: boolean };

function finiteNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())
  ) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Morphology-dependent mean B-Ks color (UNGC relation). */
export function meanBMinusKs(type: number): number {
  if (type < 3) return 4.1;
  if (type > 8) return 2.35;
  return 4.6 - 0.25 * type;
}

/** Prefer an independent Ks measurement; otherwise estimate from B and T. */
export function displayedKs(input: KsInputs): KsDisplay {
  const provided = finiteNumeric(input.ks_mag);
  const flag = input.ks_estimated === true || input.ks_estimated === "true";
  if (provided !== null && !flag) return { value: provided, estimated: false };

  const b = finiteNumeric(input.b_mag);
  const type = finiteNumeric(input.morphology_t);
  if (b !== null && type !== null) {
    return { value: b - meanBMinusKs(type), estimated: true };
  }

  // A published estimate can still be displayed when its original inputs
  // are unavailable; never represent it as an independent measurement.
  if (provided !== null) return { value: provided, estimated: flag };
  return { value: null, estimated: false };
}
