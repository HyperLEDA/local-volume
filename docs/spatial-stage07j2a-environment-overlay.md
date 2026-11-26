# Stage 07j.2a — in-scene spatial environment

- Explicit opt-in on the scene, switches aggregated groups to individual galaxies only on user action. The selected group's root is used as a galaxy, not its aggregate extent.
- Search sphere, cyan neighbour rings and amber nearest-neighbour ring/link use nominal positions. Only actual displayed eligible identities receive rings/links; the computation sample stays the 07j.1 input before spatial/population filters. HUD reports shown/total, nominal density and radial residual; nearest can lie outside radius. Hidden nearest is labelled, not drawn. No filters or colours are changed.
- Radius/H0 in compact scene HUD; details in inspector. Overlay follows selected object, Reset clears preferences, groups mode disables overlay. No persisted overlay state. PNG includes WebGL guides but not HUD; no new legend.
- Geometry is display-only and not part of hit testing, fit or camera key. Fixed-capacity buffers reused, resources disposed through renderer ownership. Boundary and distance quality caveats retained. No backend changes.
- Acceptance: test real group root/field, frame changes, filters and hidden nearest, deselect/reset, both themes, picking, camera stability and PNG. Full browser acceptance remains open.
