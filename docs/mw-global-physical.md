# Milky Way global physical model

Canonical PGC 5064336. This is an explicit global model, not an
external-galaxy flux calculation. Original source rows are immutable.

| Field | Adopted value | Evidence and semantics |
|---|---:|---|
| abs_b_mag | -19.10 mag | frozen LVGDB Table 2, line 1626, published |
| log_mhi_msun | 9.47 | same Table 2 row, not a flux-derived estimate or upper limit |
| abs_ks_mag | -24.2 mag | Just et al. 2015, MNRAS 451, 149–158, section 3.5, DOI 10.1093/mnras/stv858; model extrapolation of 2MASS K-band light, estimated uncertainty 0.2 mag |
| log_lks_lsun | 10.992 | derived from the preceding model and existing solar zero point M_K,Sun=3.28; estimated uncertainty 0.08 dex from M_K alone |

LVGDB frozen Table 2 `lvg_table2.dat` SHA256:
`a5e8d0ca8dcf9bb37d5a0f3692d2e61ef79bdb8d21e5e62750256000b2904f0b`.
The two adopted published values are explicitly frozen in the versioned code,
not copied dynamically from the deprecated published columns at refresh time.
The preview verifies both against the audited source row. Missing measurement
errors for these values are not invented. The literature K-band model is
mapped to the catalogue K_s convention; no extra filter conversion is assumed.
The estimate is flagged, and no apparent K magnitude is fabricated.

The centre D and its source-paired uncertainty are retained for geometry only.
No inclination, external extinction, Holmberg diameter, rotation amplitude,
Holmberg dynamical mass, surface brightness or tracer-specific SFR is inferred.

The distinct MW.2 effective tidal calibration (10.553407183824561) remains
unchanged in donor preparation and group cycle resolution. It is not a
photometric measurement. Theta_j also uses this historical effective proxy;
its value is not an independently calibrated luminosity density.

`physical_method` identifies the adopted model; `ks_method` identifies the
literature photometry, and `ks_estimated` is true. The physical table tooltips
identify the origin of each restored parameter. Other consumers of K luminosity
use the model, not the tidal proxy. A new formula epoch invalidates old derived
rows. Read-only preview and isolated database-clone acceptance passed.
For the final internal-observer geometry and diagnostics, see
[mw-internal-observer-geometry.md](mw-internal-observer-geometry.md) and
[mw-galactocentric-diagnostics.md](mw-galactocentric-diagnostics.md).
