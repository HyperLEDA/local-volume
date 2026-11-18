export type InitialAladinFocus = { ra: number; dec: number };

export function isValidInitialAladinFocus(
  focus: InitialAladinFocus | null,
): focus is InitialAladinFocus {
  return (
    focus !== null &&
    Number.isFinite(focus.ra) &&
    focus.ra >= 0 &&
    focus.ra <= 360 &&
    Number.isFinite(focus.dec) &&
    focus.dec >= -90 &&
    focus.dec <= 90
  );
}

/** Give Aladin the final ICRS center before its first rendered frame. */
export function initialAladinTarget(focus: InitialAladinFocus | null): string {
  if (!isValidInitialAladinFocus(focus)) return "180 +0";
  return `${focus.ra} ${focus.dec >= 0 ? "+" : ""}${focus.dec}`;
}
