/** Group-gallery rendering policy. This does not alter group membership. */
export const GROUP_PORTRAIT_FOV_FACTOR = 1.4;

/** PGC 17223 is the LMC; a Milky Way-centric hierarchy needs separate handling. */
export function supportsHierarchyPreview(rootPgc: number): boolean {
  return rootPgc !== 17223;
}
