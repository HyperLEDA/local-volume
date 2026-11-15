-- depends: 0007.lv_physical_calculations
-- P2: independently reconstructed inclination and conditional Ks luminosity.
-- Only add calc_* columns to the existing lv.physical table.
-- Original *_published data and earlier P1 calc_* values are unchanged.

DO $$
BEGIN
    IF to_regclass('lv.physical') IS NULL THEN
        RAISE EXCEPTION 'P2 requires lv.physical';
    END IF;
    IF to_regclass('lv.physical_calculated') IS NOT NULL THEN
        RAISE EXCEPTION 'Unexpected secondary physical table';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='lv' AND table_name='physical'
          AND column_name IN (
             'calc_p2_version', 'calc_p2_stage_sha256', 'calc_p2_code_sha256',
             'calc_p2_pr5_sha256', 'calc_p2_pr6_sha256',
             'calc_inclination_deg', 'calc_inclination_delta_deg',
             'calc_inclination_qa_status', 'calc_log_lks_lsun',
             'calc_log_lks_delta_dex', 'calc_log_lks_qa_status'
          )
    ) THEN
        RAISE EXCEPTION 'P2 columns already exist: stop';
    END IF;
END $$;

ALTER TABLE lv.physical
    ADD COLUMN calc_p2_version text
        CHECK (calc_p2_version = 'p2_lv_reconstruction_2026-11-15'),
    ADD COLUMN calc_p2_stage_sha256 text
        CHECK (calc_p2_stage_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_p2_code_sha256 text
        CHECK (calc_p2_code_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_p2_pr5_sha256 text
        CHECK (calc_p2_pr5_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_p2_pr6_sha256 text
        CHECK (calc_p2_pr6_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_inclination_deg numeric(16,9)
        CHECK (calc_inclination_deg BETWEEN 0 AND 90),
    ADD COLUMN calc_inclination_delta_deg numeric(16,9),
    ADD COLUMN calc_inclination_qa_status text
        CHECK (calc_inclination_qa_status IN ('MATCH','NOT_COMPARABLE','REVIEW_DISCREPANCY')),
    ADD COLUMN calc_log_lks_lsun numeric(16,9),
    ADD COLUMN calc_log_lks_delta_dex numeric(16,9),
    ADD COLUMN calc_log_lks_qa_status text
        CHECK (calc_log_lks_qa_status IN ('MATCH','NOT_COMPARABLE','REVIEW_DISCREPANCY'));

ALTER TABLE lv.physical
    ADD CONSTRAINT calc_p2_all_or_none CHECK (
        (calc_p2_version IS NULL AND calc_p2_stage_sha256 IS NULL
         AND calc_p2_code_sha256 IS NULL AND calc_p2_pr5_sha256 IS NULL
         AND calc_p2_pr6_sha256 IS NULL AND calc_inclination_deg IS NULL
         AND calc_inclination_delta_deg IS NULL AND calc_inclination_qa_status IS NULL
         AND calc_log_lks_lsun IS NULL AND calc_log_lks_delta_dex IS NULL
         AND calc_log_lks_qa_status IS NULL)
        OR
        (calc_p2_version IS NOT NULL AND calc_p2_stage_sha256 IS NOT NULL
         AND calc_p2_code_sha256 IS NOT NULL AND calc_p2_pr5_sha256 IS NOT NULL
         AND calc_p2_pr6_sha256 IS NOT NULL AND calc_inclination_qa_status IS NOT NULL
         AND calc_log_lks_qa_status IS NOT NULL)
    ),
    ADD CONSTRAINT calc_p2_inclination_status CHECK (
        calc_p2_version IS NULL OR
        ( (calc_inclination_qa_status = 'NOT_COMPARABLE'
             AND calc_inclination_deg IS NULL AND calc_inclination_delta_deg IS NULL)
          OR
          (calc_inclination_qa_status IN ('MATCH','REVIEW_DISCREPANCY')
             AND calc_inclination_deg IS NOT NULL AND calc_inclination_delta_deg IS NOT NULL)
        )
    ),
    ADD CONSTRAINT calc_p2_lks_status CHECK (
        calc_p2_version IS NULL OR
        ( (calc_log_lks_qa_status = 'NOT_COMPARABLE'
             AND calc_log_lks_lsun IS NULL AND calc_log_lks_delta_dex IS NULL)
          OR
          (calc_log_lks_qa_status IN ('MATCH','REVIEW_DISCREPANCY')
             AND calc_log_lks_lsun IS NOT NULL AND calc_log_lks_delta_dex IS NOT NULL)
        )
    ),
    ADD CONSTRAINT calc_p2_depends_on_p1 CHECK (
        calc_p2_version IS NULL OR calc_version IS NOT NULL
    );

SELECT meta.setparams('lv','physical','calc_p2_version',
    '{"description":"P2 deterministic reconstruction and QA version"}');
SELECT meta.setparams('lv','physical','calc_p2_stage_sha256',
    '{"description":"SHA256 of frozen P2 staged 1676-row CSV"}');
SELECT meta.setparams('lv','physical','calc_p2_code_sha256',
    '{"description":"SHA256 of read-only P2 generator program"}');
SELECT meta.setparams('lv','physical','calc_p2_pr5_sha256',
    '{"description":"SHA256 of source PR5 inclination formula used for P2"}');
SELECT meta.setparams('lv','physical','calc_p2_pr6_sha256',
    '{"description":"SHA256 of source PR6 Ks-luminosity formula used for P2"}');
SELECT meta.setparams('lv','physical','calc_inclination_deg',
    '{"description":"Reconstructed inclination from observed LVG morphology T and b/a via PR5, not an independent measurement", "unit":"deg"}');
SELECT meta.setparams('lv','physical','calc_inclination_delta_deg',
    '{"description":"Reconstructed inclination minus published inclination, reference rounded to integer degrees", "unit":"deg"}');
SELECT meta.setparams('lv','physical','calc_inclination_qa_status',
    '{"description":"P2 inclination comparison to LVGDB at absolute tolerance 0.5 deg"}');
SELECT meta.setparams('lv','physical','calc_log_lks_lsun',
    '{"description":"Reconstructed log Ks luminosity using LVG observed Ks, adopted modulus, Galactic extinction and PUBLISHED internal B absorption", "unit":"dex(solLum)"}');
SELECT meta.setparams('lv','physical','calc_log_lks_delta_dex',
    '{"description":"Reconstructed minus published log Ks luminosity", "unit":"dex"}');
SELECT meta.setparams('lv','physical','calc_log_lks_qa_status',
    '{"description":"P2 Ks luminosity agreement with published value at absolute tolerance 0.05 dex"}');
