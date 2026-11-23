# Stage 03b — Subgroup outlines: display-only selection regions

The dotted outline on GroupSkyMap denotes a UI selection region for an explicitly
listed MD subtree; it does **not** delimit a physical halo, dynamical association,
or gravitationally bound volume. Clicking it opens the MD's subgroup and an exact
list of those members, including direct links to their galaxy pages.

The former axis-aligned bounding ellipse could enclose unrelated galaxies. The
new footprint is sampled in the **current Aladin screen projection** from discs
around member positions and narrow capsules around explicit parent-child links.
Nonmember group positions are excluded by a screen-space clearance. Long links
are not bridged by a misleading continuous region; several disconnected lobes
may represent one subgroup. If member and nonmember markers are unresolved at
this zoom, the footprint is suppressed. For missing sky coordinates the source
hierarchy's existing policy remains authoritative.

The contour and hit-test use the same screen-space membership criterion. It is
recomputed after zoom, pan and resize; neither method defines a celestial
boundary. Projection distortion and point crowding remain visual QA targets.
The ambient Aladin view keeps the normal marker interactions: the transparent
footprints do not receive pointer events, and clicks on markers are ignored by
the delegated subgroup selection handler.

Review NGC 253/NGC 247, NGC 5128, M 104 and crowded/overlapping MD trees at
wide and close zoom levels before treating the UI task as complete.
