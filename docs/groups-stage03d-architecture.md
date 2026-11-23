# Milestone 02 · Stage 03d — Sky-anchored subgroup boundaries

## Why Stage 03c jittered
The subgroup contour was built in **screen pixels** using marching squares every time a
React camera revision changed. The underlying Aladin image, markers and tidal links
are instead native Aladin sky layers. Independent render loops, frame quantization,
zoom scaling and hover state changes made the boundary visibly pulse and shift.

## Stage 03d contract
- Group hierarchies and membership lists still come exclusively from the selected
  Group API definition and explicit `parent_md_pgc` links.
- A stable, deterministic orthographic reference plane is constructed from the
  group's root ICRS coordinates. A marching-squares region is generated **once per
  group dataset**, not when the Aladin view pans/zooms or a cursor moves.
- The contour vertices are converted back to ICRS and rendered as native Aladin
  `A.polygon` footprints on a dashed `graphicOverlay` with the markers. Pan, zoom,
  rotation and HiPS rendering use **Aladin's own frame lifecycle**.
- Hover and click selection map current Aladin pixel coordinates through `pix2world`
  into the immutable reference plane; no cursor event changes the polygon.
- Hover fill is a separate native overlay. A polygon with holes is not filled,
  avoiding false inclusion of an excluded sky marker.
- If the initial celestial geometry is ambiguous, off-projection, or contains
  indistinguishable subgroup/foreign source positions, the unsupported contour is
  omitted. A hidden contour makes no dynamical or physical claim.
- Native marker clicks, the original two-line tidal-pair popover, source version,
  subgroup member links and the definition selector are preserved.

The result is **not** a virial radius, membership probability contour, HI envelope,
or other scientific mass/density boundary. It is an interaction footprint illustrating
explicit catalogue membership.

## Visual review
1. NGC 253 / NGC 247: scroll smoothly through 3–5 zoom levels, including large changes;
   the outline should move in lockstep with galaxy markers, not split in response to FoV.
2. Move the cursor across empty and filled sky without pressing buttons. Dashed lines
   should not move; only hover fill should change.
3. Check galaxies which are not members of the NGC 247 MD against the shaded region;
   ambiguous cases must remain unselected.
4. Open the subgroup card; verify every member points to its original object record.
5. Check NGC 5128 and M 104 group fields, group selector and native Aladin marker clicks.
6. Inspect mobile width, light/dark mode, hi-DPI displays and the browser console.

If native Aladin Polygon drawing appears incorrectly at the SIN projection horizon,
report the sky target and FoV; do not silently construct a screen-space fallback.
