# MW tidal environment calibration (2026-11-27)

The frozen LVGDB Table 2 snapshot SHA256 is
`a5e8d0ca8dcf9bb37d5a0f3692d2e61ef79bdb8d21e5e62750256000b2904f0b`.
The read-only audit at source/applied revision 7 reproduced the previous MD
and three environment indices for 1676 non-HOLD targets (1655 donors).
Inverting the 71 published MW MD values with the adopted mu-first ICRS geometry
and C = 10.96 gave median 10.553407183824561, MAD 0.0024430281653 dex,
range [10.547991592662418, 10.55816551082434]. This is an effective K-band
luminosity for reconstructing the historic tidal convention, not a measurement,
a fitted uncertainty, or a dynamically recalibrated parameter.

The constant is used in the donor census for Theta1, Theta5 and Thetaj, and
in the cycle-root ranking for MW only; it is **not** written to photometric
log_lks_lsun or abs_ks_mag. The MW target is evaluated normally (no self term).
The donor catalogue remains incomplete. The MW centre must be the adopted
catalogue centre (geometry sanity checks: 5–15 kpc, within 1 degree of the
frozen catalogue centre direction). Invalid input fails closed. No source or
published column is overwritten. No group memberships are hardcoded.

Expected audit baseline on this exact snapshot: 71 direct MW MDs, 2 published
LMC MDs retained, 72 changed MDs including MW itself; 57 Physical groups,
MW Physical 63 members including root; 66 Suites, MW Suite 74 including root.
Expected MW MD PGC 4689212, Theta1 2.76422308518638, Theta5 2.9341164978849292,
Thetaj 1.559695309665129. These are regression targets for this snapshot,
not claims about other catalogue revisions.

The external-galaxy projected group extent is not valid for the observer-inside
MW group and remains NULL. Dedicated Galactocentric diagnostics and the Atlas
MW envelope are described in [internal observer geometry](mw-internal-observer-geometry.md)
and [Atlas group envelope](mw-atlas-group-envelope.md). The ordinary
extragalactic spatial sample still excludes MW.

Independent physical photometry and adopted published B/HI values use the
separate [MW global physical model](mw-global-physical.md). The tidal
calibration is never substituted for photometric luminosity or used to
infer inclination. The tidal equations follow Karachentsev, Makarov & Kaisina
(2013), AJ 145, 101, https://doi.org/10.1088/0004-6256/145/4/101.

The final formula epoch is `lv-physical-precomputed-2026-11-27-v4-mw-global`.
Installing files alone does not write the database. The read-only snapshot
audit and a refresh of an isolated local database clone passed. Production
refresh is subject to the normal deployment and catalogue-owner approval.

## Local validation (2026-11-27)

On the audited revision-7 snapshot (1677 objects), isolated clone refresh
reproduced 72 changed MDs, all 71 published MW MDs and both published LMC
MDs, with no additional MW MDs. RMS residual in published MW Theta1 was
0.0030399577379036295 dex. This is an in-sample reconstruction statistic,
not independent predictive validation. The original database was unchanged.
The physical MW group contains 63 galaxies including the root; the suite
contains 74. The 62 qualified physical-group satellites yield maximum, mean
and median nominal Galactocentric radii of 513.2013, 134.2877 and 97.9806 kpc.
The Atlas envelope agrees in ICRS, Galactic and Supergalactic frames.
Local QA: 184 backend tests, 612 frontend tests, Ruff lint/format,
basedpyright, Oxlint, TypeScript/Vite build, and browser acceptance.
