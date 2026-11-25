# Stage 07e.2 — independent galaxy symbol sizing

- Default remains morphology colour, fixed 6 px galaxy symbols, groups + field, grid off.
- Fixed symbol diameters: Small 4, Normal 6, Large 8 CSS-pixel nominal PointsMaterial size. Texture padding and hardware limits may affect visible diameter. Group meshes use the existing projected extent in Mpc and are never resized by these controls.
- B luminosity mode reuses `markerDiameter(abs_b_mag, 12)` from the overview sky map and scales the returned nominal diameter by base / 6 (rounded to integer). Saturates at M_B >= -10 and M_B <= -22. Absolute magnitudes come from the catalogue's derived `abs_b_mag`; apparent photometry is never substituted. Missing/nonfinite values get the base size, counted separately in the legend. This is a symbol encoding, not physical size or luminosity-proportional area.
- Fixed magnitude anchors do not change with selection, depth, frame or display filters. Colour and size are independent. B luminosity means a monotonic visual mapping of absolute B magnitude, not a new photometric calculation.
- Rebatch by marker kind and integer diameter; keep textures per kind until renderer disposal, dispose old materials/geometries on every size change. Camera, group meshes, controls, selected PGC and position data remain intact. Picking and halo scale follow symbol diameter.
- No backend, schema, source or physical group changes. Local browser/hardware QA remains necessary (size, colour independence, selected highlight, group sizes, FPS, resource lifetime).
