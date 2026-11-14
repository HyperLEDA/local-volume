-- depends: 0004.lv_sao_catalog
-- Source-native velocity evidence from the frozen LVGDB catalog.
-- Keeps the twelve historical LV-0002 fields unchanged. No backfill here.
ALTER TABLE lv.observed
    ADD COLUMN lvg_v_hel_kms double precision,
    ADD COLUMN lvg_e_v_hel_kms real CHECK (lvg_e_v_hel_kms >= 0),
    ADD COLUMN lvg_v_lg_kms double precision,
    ADD COLUMN lvg_source_catalog text,
    ADD COLUMN lvg_source_name text,
    ADD CONSTRAINT lvg_source_fields_together
      CHECK ((lvg_source_catalog IS NULL) = (lvg_source_name IS NULL));

SELECT meta.setparams('lv','observed','lvg_v_hel_kms',
 '{"description":"Original LVGDB Table 1 heliocentric radial velocity, without Layer-2 aggregation", "unit":"km/s", "ucd":"spect.dopplerVeloc"}');
SELECT meta.setparams('lv','observed','lvg_e_v_hel_kms',
 '{"description":"Original LVGDB Table 1 error of heliocentric radial velocity (non-negative)", "unit":"km/s", "ucd":"stat.error;spect.dopplerVeloc"}');
SELECT meta.setparams('lv','observed','lvg_v_lg_kms',
 '{"description":"Original LVGDB Table 1 Local Group adopted velocity; not recomputed from heliocentric", "unit":"km/s", "ucd":"spect.dopplerVeloc"}');
SELECT meta.setparams('lv','observed','lvg_source_catalog',
 '{"description":"Source identifier for LVGDB-specific fields ONLY (including B, Ks, H-alpha, distances and native velocities); does not describe LV-0002 legacy fields"}');
SELECT meta.setparams('lv','observed','lvg_source_name',
 '{"description":"Original LVGDB source-row designation for LVGDB-specific fields; PGC identity is validated separately"}');
