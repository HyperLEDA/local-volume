-- depends: 0012.lv_group_previews
-- Additive, source-paired uncertainties for derived adopted distance and V_LG.
-- Does not mutate source observations or legacy/published physical values.
-- Production must NOT be used for first application.
DO $$
BEGIN
  IF to_regclass('lv.objects') IS NULL OR to_regclass('lv.observed') IS NULL OR
     to_regclass('lv.physical') IS NULL OR to_regclass('lv.physical_refresh_state') IS NULL OR
     to_regclass('lv.group_previews') IS NULL THEN
    RAISE EXCEPTION '0013 requires a fully migrated isolated Scientific Atlas / Groups database';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'lv' AND table_name = 'physical' AND column_name = 'distance_mpc'
  ) THEN
    RAISE EXCEPTION '0013: distance_mpc exists: stop rather than overwrite';
  END IF;
END $$;

ALTER TABLE lv.physical
  ADD COLUMN distance_mpc double precision CHECK (distance_mpc > 0),
  ADD COLUMN e_distance_minus_mpc double precision CHECK (e_distance_minus_mpc >= 0),
  ADD COLUMN e_distance_plus_mpc double precision CHECK (e_distance_plus_mpc >= 0),
  ADD COLUMN distance_error_basis text CHECK (
    distance_error_basis IS NULL OR distance_error_basis = 'observed_mu_e_mu_exact'
  ),
  ADD COLUMN v_lg_kms double precision,
  ADD COLUMN e_v_lg_kms double precision CHECK (e_v_lg_kms >= 0),
  ADD COLUMN velocity_error_basis text CHECK (
    velocity_error_basis IS NULL OR velocity_error_basis IN (
      'lvg_e_v_hel_kms_paired','observed_v_lg_e_v_lg',
      'observed_v_hel_e_v_hel_paired'
    )
  );

ALTER TABLE lv.physical
  ADD CONSTRAINT physical_distance_errors_paired CHECK (
    (e_distance_minus_mpc IS NULL AND e_distance_plus_mpc IS NULL AND distance_error_basis IS NULL)
    OR (distance_mpc IS NOT NULL AND e_distance_minus_mpc IS NOT NULL AND
        e_distance_plus_mpc IS NOT NULL AND distance_error_basis IS NOT NULL)
  ),
  ADD CONSTRAINT physical_velocity_error_paired CHECK (
    (e_v_lg_kms IS NULL AND velocity_error_basis IS NULL)
    OR (v_lg_kms IS NOT NULL AND e_v_lg_kms IS NOT NULL AND velocity_error_basis IS NOT NULL)
  );

SELECT meta.setparams('lv','physical','distance_mpc',
 '{"description":"Computed adopted distance following the mu-first source rule; not a published independent measurement","unit":"Mpc","ucd":"pos.distance"}');
SELECT meta.setparams('lv','physical','e_distance_minus_mpc',
 '{"description":"Lower one-sigma distance error propagated exactly from observed e_mu","unit":"Mpc","ucd":"stat.error;pos.distance"}');
SELECT meta.setparams('lv','physical','e_distance_plus_mpc',
 '{"description":"Upper one-sigma distance error propagated exactly from observed e_mu","unit":"Mpc","ucd":"stat.error;pos.distance"}');
SELECT meta.setparams('lv','physical','distance_error_basis',
 '{"description":"Source and propagation method of calculated distance error"}');
SELECT meta.setparams('lv','physical','v_lg_kms',
 '{"description":"Adopted Local Group frame velocity from lv.observed native value, legacy fallback only if unavailable","unit":"km/s","ucd":"spect.dopplerVeloc"}');
SELECT meta.setparams('lv','physical','e_v_lg_kms',
 '{"description":"Measurement-only VLG uncertainty inherited from paired observed velocity error; excludes frame-systematic error","unit":"km/s","ucd":"stat.error;spect.dopplerVeloc"}');
SELECT meta.setparams('lv','physical','velocity_error_basis',
 '{"description":"Paired source velocity uncertainty identifier; NULL if unavailable"}');
