-- depends: 0008.lv_physical_p2
-- P3. Corrected Holmberg diameter reconstruction + conditional mean B surface
-- brightness + provisional dynamical mass from PR5 Vm, all in lv.physical.
-- Additive only; no changes to observed, *_published, P1 or P2 columns.
-- Empirically reconstructed diameter recipe: candidate, not independently
-- documented original LVGDB code. Do not promote these as source measurements.

DO $$
BEGIN
  IF to_regclass('lv.physical') IS NULL THEN
    RAISE EXCEPTION '0009 requires lv.physical';
  END IF;
  IF to_regclass('lv.physical_calculated') IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected secondary physical table';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
       WHERE table_schema='lv' AND table_name='physical'
         AND column_name IN (
           'calc_p3_version','calc_p3_stage_sha256','calc_p3_code_sha256',
           'calc_p3_model','calc_p3_kd','calc_p3_inclination_coefficient',
           'calc_a26_corrected_arcmin','calc_a26_kpc','calc_a26_delta_kpc',
           'calc_a26_delta_dex','calc_a26_qa_status',
           'calc_mean_sb_conditional_mag_arcsec2','calc_mean_sb_delta_mag',
           'calc_mean_sb_qa_status','calc_log_m26_full_candidate_msun',
           'calc_log_m26_full_delta_dex','calc_log_m26_full_qa_status'
         )) THEN
    RAISE EXCEPTION 'P3 columns already exist: stop';
  END IF;
END $$;

ALTER TABLE lv.physical
  ADD COLUMN calc_p3_version text
    CHECK (calc_p3_version = 'p3_lv_corrected_a26_candidate_2026-11-15'),
  ADD COLUMN calc_p3_stage_sha256 text
    CHECK (calc_p3_stage_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN calc_p3_code_sha256 text
    CHECK (calc_p3_code_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN calc_p3_model text
    CHECK (calc_p3_model = 'P3_FOUQUE_PATUREL_STYLE_FIXED_C0P04_KD_T_CANDIDATE'),
  ADD COLUMN calc_p3_kd numeric(16,9),
  ADD COLUMN calc_p3_inclination_coefficient numeric(16,9)
    CHECK (calc_p3_inclination_coefficient = 0.04),
  ADD COLUMN calc_a26_corrected_arcmin numeric(16,9)
    CHECK (calc_a26_corrected_arcmin > 0),
  ADD COLUMN calc_a26_kpc numeric(16,9)
    CHECK (calc_a26_kpc > 0),
  ADD COLUMN calc_a26_delta_kpc numeric(16,9),
  ADD COLUMN calc_a26_delta_dex numeric(16,9),
  ADD COLUMN calc_a26_qa_status text
    CHECK (calc_a26_qa_status IN ('MATCH_WITH_ROUNDING','NOT_COMPARABLE','REVIEW_DISCREPANCY')),
  ADD COLUMN calc_mean_sb_conditional_mag_arcsec2 numeric(16,9),
  ADD COLUMN calc_mean_sb_delta_mag numeric(16,9),
  ADD COLUMN calc_mean_sb_qa_status text
    CHECK (calc_mean_sb_qa_status IN ('MATCH','NOT_COMPARABLE','REVIEW_DISCREPANCY')),
  ADD COLUMN calc_log_m26_full_candidate_msun numeric(16,9),
  ADD COLUMN calc_log_m26_full_delta_dex numeric(16,9),
  ADD COLUMN calc_log_m26_full_qa_status text
    CHECK (calc_log_m26_full_qa_status IN ('MATCH','NOT_COMPARABLE','REVIEW_DISCREPANCY'));

ALTER TABLE lv.physical
  ADD CONSTRAINT calc_p3_all_or_none CHECK (
    (calc_p3_version IS NULL AND calc_p3_stage_sha256 IS NULL AND calc_p3_code_sha256 IS NULL
     AND calc_p3_model IS NULL AND calc_p3_kd IS NULL AND calc_p3_inclination_coefficient IS NULL
     AND calc_a26_corrected_arcmin IS NULL AND calc_a26_kpc IS NULL
     AND calc_a26_delta_kpc IS NULL AND calc_a26_delta_dex IS NULL AND calc_a26_qa_status IS NULL
     AND calc_mean_sb_conditional_mag_arcsec2 IS NULL AND calc_mean_sb_delta_mag IS NULL
     AND calc_mean_sb_qa_status IS NULL AND calc_log_m26_full_candidate_msun IS NULL
     AND calc_log_m26_full_delta_dex IS NULL AND calc_log_m26_full_qa_status IS NULL)
    OR
    (calc_p3_version IS NOT NULL AND calc_p3_stage_sha256 IS NOT NULL
     AND calc_p3_code_sha256 IS NOT NULL AND calc_p3_model IS NOT NULL
     AND calc_p3_inclination_coefficient IS NOT NULL
     AND calc_a26_qa_status IS NOT NULL AND calc_mean_sb_qa_status IS NOT NULL
     AND calc_log_m26_full_qa_status IS NOT NULL)
  ),
  ADD CONSTRAINT calc_p3_depends_on_p2 CHECK (
    calc_p3_version IS NULL OR (calc_p2_version IS NOT NULL AND calc_version IS NOT NULL)
  ),
  ADD CONSTRAINT calc_p3_diameter_status CHECK (
    calc_p3_version IS NULL OR
    ((calc_a26_qa_status = 'NOT_COMPARABLE' AND calc_p3_kd IS NULL
       AND calc_a26_corrected_arcmin IS NULL AND calc_a26_kpc IS NULL
       AND calc_a26_delta_kpc IS NULL AND calc_a26_delta_dex IS NULL)
     OR
     (calc_a26_qa_status IN ('MATCH_WITH_ROUNDING','REVIEW_DISCREPANCY')
       AND calc_p3_kd IS NOT NULL AND calc_a26_corrected_arcmin IS NOT NULL
       AND calc_a26_kpc IS NOT NULL AND calc_a26_delta_kpc IS NOT NULL
       AND calc_a26_delta_dex IS NOT NULL))
  ),
  ADD CONSTRAINT calc_p3_mean_sb_status CHECK (
    calc_p3_version IS NULL OR
    ((calc_mean_sb_qa_status = 'NOT_COMPARABLE'
      AND calc_mean_sb_conditional_mag_arcsec2 IS NULL AND calc_mean_sb_delta_mag IS NULL)
     OR
     (calc_mean_sb_qa_status IN ('MATCH','REVIEW_DISCREPANCY')
      AND calc_mean_sb_conditional_mag_arcsec2 IS NOT NULL
      AND calc_mean_sb_delta_mag IS NOT NULL))
  ),
  ADD CONSTRAINT calc_p3_m26_status CHECK (
    calc_p3_version IS NULL OR
    ((calc_log_m26_full_qa_status = 'NOT_COMPARABLE'
      AND calc_log_m26_full_candidate_msun IS NULL AND calc_log_m26_full_delta_dex IS NULL)
     OR
     (calc_log_m26_full_qa_status IN ('MATCH','REVIEW_DISCREPANCY')
      AND calc_log_m26_full_candidate_msun IS NOT NULL
      AND calc_log_m26_full_delta_dex IS NOT NULL))
  );

SELECT meta.setparams('lv','physical','calc_p3_version',
 '{"description":"P3 reconstructed-diameter candidate and diagnostic QA version"}');
SELECT meta.setparams('lv','physical','calc_p3_stage_sha256',
 '{"description":"SHA256 of the frozen 1676-object P3 reconstruction CSV"}');
SELECT meta.setparams('lv','physical','calc_p3_code_sha256',
 '{"description":"SHA256 of the read-only P3 calculation program"}');
SELECT meta.setparams('lv','physical','calc_p3_model',
 '{"description":"Candidate corrected diameter formula; empirical LVGDB regression, not verified original source-code algorithm"}');
SELECT meta.setparams('lv','physical','calc_p3_kd',
 '{"description":"Morphological-type-dependent Galactic-extinction diameter coefficient K_D(T)"}');
SELECT meta.setparams('lv','physical','calc_p3_inclination_coefficient',
 '{"description":"Candidate inclination correction coefficient C=0.04"}');
SELECT meta.setparams('lv','physical','calc_a26_corrected_arcmin',
 '{"description":"Candidate corrected angular Holmberg a26 diameter from observed a26, B extinction, T and b/a","unit":"arcmin"}');
SELECT meta.setparams('lv','physical','calc_a26_kpc',
 '{"description":"Candidate corrected linear a26 diameter from reconstructed angular diameter and audited distance modulus","unit":"kpc"}');
SELECT meta.setparams('lv','physical','calc_a26_delta_kpc',
 '{"description":"Reconstructed minus published a26 linear diameter","unit":"kpc"}');
SELECT meta.setparams('lv','physical','calc_a26_delta_dex',
 '{"description":"log10(reconstructed / published a26 diameter)","unit":"dex"}');
SELECT meta.setparams('lv','physical','calc_a26_qa_status',
 '{"description":"Comparison with published a26: absolute log difference <=0.02 dex OR absolute linear difference <=0.01 kpc"}');
SELECT meta.setparams('lv','physical','calc_mean_sb_conditional_mag_arcsec2',
 '{"description":"Conditional reconstructed mean B surface brightness; depends on PUBLISHED internal B attenuation, not independent","unit":"mag/arcsec2"}');
SELECT meta.setparams('lv','physical','calc_mean_sb_delta_mag',
 '{"description":"Conditional reconstructed minus published mean B surface brightness","unit":"mag/arcsec2"}');
SELECT meta.setparams('lv','physical','calc_mean_sb_qa_status',
 '{"description":"Conditional mean B surface brightness comparison, absolute threshold 0.1 mag"}');
SELECT meta.setparams('lv','physical','calc_log_m26_full_candidate_msun',
 '{"description":"Provisional log M26 using candidate corrected a26 AND PR5 unrounded velocity; neither published mass nor a fully validated independent measurement","unit":"dex(solMass)"}');
SELECT meta.setparams('lv','physical','calc_log_m26_full_delta_dex',
 '{"description":"Provisional log M26 candidate minus published log M26","unit":"dex"}');
SELECT meta.setparams('lv','physical','calc_log_m26_full_qa_status',
 '{"description":"Provisional candidate log M26 comparison, absolute threshold 0.1 dex"}');
