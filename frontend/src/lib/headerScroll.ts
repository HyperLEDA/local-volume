/** Collapse after a deliberate scroll, expand only near the page top.
 * Two thresholds prevent header resize from causing scroll-state oscillation.
 */
export const HEADER_COLLAPSE_SCROLL_Y = 56;
export const HEADER_EXPAND_SCROLL_Y = 12;

export function headerCompactAtScroll(
  scrollY: number,
  wasCompact: boolean,
): boolean {
  if (!Number.isFinite(scrollY)) return wasCompact;
  if (scrollY >= HEADER_COLLAPSE_SCROLL_Y) return true;
  if (scrollY <= HEADER_EXPAND_SCROLL_Y) return false;
  return wasCompact;
}
