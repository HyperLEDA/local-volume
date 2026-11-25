# Stage 07f.1 — spatial session continuity

- Tab-local preferences: frame, projection, distance/display modes, volume, theme, colour, marker settings, guides, layers, interval mode and selected PGC. Unknown enum values use defaults. PGCs outside the current Atlas sample are rejected.
- Camera snapshot saved on renderer cleanup or pagehide; restore only for exact matching scene geometry, projection, frame and distance/volume mode. An incompatible scene uses XY home. Camera coordinates are display state, not a scientific export. No DB writes.
- `spatial=1` in Atlas URL records open view without creating a new history entry. Object navigation retains the existing collection return URL. Closing removes only the spatial parameter. Browser Back from a group returns to the Atlas URL. `Show on sky` centres the existing sky map on selected galaxy/root without modifying filters.
- Session storage is per tab and has a memory fallback. The last camera only is retained. Search query and overlapping picks are transient. Full bidirectional sky reticle integration, Group 3D state, and scientific frozen sample export remain later work.
- Browser acceptance: close/reopen, object navigation and back, refresh, invalid or changed geometry, filters, resize, both projections, storage denial, no DB writes.
