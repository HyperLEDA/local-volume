# Stage 07e.6 — Spatial reference guides

Global Atlas only. Independent, initially hidden geometric guides. Absolute SGZ=0 passes through the observer, not a group centre. Its displayed finite disk has radius equal to the existing scene extent and is not an inferred matter distribution, survey footprint or physical boundary. The normal is rotated using the existing shared spatial frame transformations. The ordinary XY grid remains independent.

Observer-centred shells at 2, 5 and 11 Mpc are each drawn as three orthogonal great circles (96 segments per circle); they are wire reference guides, not physical group halos, density surfaces or spatial filters. 11 Mpc coincides with the nominal Local Volume radial cut. Each shell is independently selectable. All guides start off. Toggling guides schedules a render without changing camera, selection, coordinates, scene extent, source rows, scientific statistics or picking. A guide can be clipped by the current camera; enabling it does not refit the scene. Resources are owned by the existing renderer and disposed with it.

No database or backend changes. The user can independently review the colours, disk opacity and shell presets. Full frontend QA and browser acceptance on actual catalogue are required. This is not a substitute for independent coordinate-transform validation (#43) or spatial selection (#107).
