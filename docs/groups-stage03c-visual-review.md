# Milestone 02 · Stage 03c visual acceptance

- Source membership and `parent_md_pgc` remain the only basis for projected subgroup ribbons; no nearest-neighbour associations are invented. A continuous UI corridor over one declared hierarchy link remains connected across zoom, rather than disappearing at an arbitrary 120-pixel threshold.
- Contours are interpolated smooth iso-lines of a narrow analytic selection surface, not pixel-cell boundaries. Foreign group galaxies are excluded. A narrowly detoured corridor is **an interface hit region only** and must not be interpreted as a measured astronomical bridge or physical boundary.
- If foreign and member markers are visually indistinguishable, hide the ambiguous footprint.
- Hover respects projection updates and a small tolerance; selection and native Aladin marker interactions are retained.
- Galaxy detail: show each membership definition as a compact direct link under survey controls and above External catalogues, with pilot/unconfirmed qualifications and source provenance on hover. No collapsed `View groups` menu.
- Group Properties uses the same matrix, caption typography and readable label/value scale as individual Galaxy parameters; four-field rows become two balanced rows. All numerical data, units, tooltip provenance and scientific formulas remain unchanged.
- Browser checks before merging: NGC 253/NGC 247 at several FoVs; NGC 5128 dense center; M104 wide field. Verify SVG projection synchronization while dragging/zooming, foreign-marker exclusion, close/open cards, direct links, and mobile layouts.
