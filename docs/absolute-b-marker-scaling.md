# Marker size: absolute B magnitude

The public object summary exposes `lv.physical.abs_b_mag` through its existing
revision/formula-version guarded join. Stale/unavailable values remain null.
No new calculation, observed-data write, or migration is introduced.

Diameter is 6–12 CSS px on Atlas and group maps and 6–18 px for the central
galaxy detail map, before the existing context size multiplier. The normalized
fraction is clamp((-10 - M_B)/12, 0, 1) raised to gamma=0.8. More luminous galaxies are larger;
unknown M_B uses the minimum. This is a logarithmic luminosity encoding, not
angular or physical size. The B magnitude remains unchanged in photometry,
popups, filtering and exports. Reticle matching and group edge trimming reuse
the same function. The hierarchy preview renderer version changes; unannotated
portrait previews remain valid. Regenerate hierarchy thumbnails when convenient.
