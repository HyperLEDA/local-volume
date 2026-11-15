-- depends: 0006.lv_physical
-- Single-table design: keep published and reconstructed data together in lv.physical.
-- Never modify *_published fields. Candidate values and QA are in calc_* fields.
-- Isolated local test database 127.0.0.1:6434 first; not for production.

DO $$
BEGIN
    IF to_regclass('lv.physical') IS NULL THEN
        RAISE EXCEPTION '0007 requires lv.physical, created by 0006';
    END IF;
    IF to_regclass('lv.physical_calculated') IS NOT NULL THEN
        RAISE EXCEPTION 'Separate lv.physical_calculated already exists: stop';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'lv' AND table_name = 'physical'
          AND left(column_name, 5) = 'calc_'
    ) THEN
        RAISE EXCEPTION 'Pre-existing calc_* columns on lv.physical: stop';
    END IF;
END $$;

ALTER TABLE lv.physical
    ADD COLUMN calc_version text CHECK (calc_version = 'p1_lv_reconstruction_2026-11-15'),
    ADD COLUMN calc_source_sha256 text CHECK (calc_source_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_stage_sha256 text CHECK (calc_stage_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_code_sha256 text CHECK (calc_code_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_pr5_sha256 text CHECK (calc_pr5_sha256 ~ '^[0-9a-f]{64}$'),
    ADD COLUMN calc_distance_method text CHECK (calc_distance_method IN ('LVGDB_TABLE6_MU','TABLE1_DISTANCE_FALLBACK_ROUNDED','NONE')),
    ADD COLUMN calc_mu_used_mag numeric(16,9),
    ADD COLUMN calc_mb_mag numeric(16,9),
    ADD COLUMN calc_mb_delta_mag numeric(16,9),
    ADD COLUMN calc_mb_qa_status text CHECK (calc_mb_qa_status IN ('MATCH_0P1','NOT_COMPARABLE','REVIEW_DISCREPANCY')),
    ADD COLUMN calc_log_mhi_msun numeric(16,9),
    ADD COLUMN calc_log_mhi_delta_dex numeric(16,9),
    ADD COLUMN calc_hi_limit_flag text CHECK (calc_hi_limit_flag = '<'),
    ADD COLUMN calc_mhi_qa_status text CHECK (calc_mhi_qa_status IN ('MATCH_0P1','NOT_COMPARABLE','REVIEW_DISCREPANCY','UPPER_LIMIT_MATCH_0P1','UPPER_LIMIT_NOT_COMPARABLE','UPPER_LIMIT_REVIEW_DISCREPANCY','MW_GEOMETRY_EXCEPTION')),
    ADD COLUMN calc_log_m26_rounded_vm_msun numeric(16,9),
    ADD COLUMN calc_log_m26_pr5_msun numeric(16,9),
    ADD COLUMN calc_m26_rounded_delta_dex numeric(16,9),
    ADD COLUMN calc_m26_pr5_delta_dex numeric(16,9),
    ADD COLUMN calc_vm_pr5_kms numeric(16,9) CHECK (calc_vm_pr5_kms > 0),
    ADD COLUMN calc_m26_rounded_qa_status text CHECK (calc_m26_rounded_qa_status IN ('MATCH_0P1','NOT_COMPARABLE','REVIEW_DISCREPANCY')),
    ADD COLUMN calc_m26_pr5_qa_status text CHECK (calc_m26_pr5_qa_status IN ('MATCH_0P1','NOT_COMPARABLE','REVIEW_DISCREPANCY'));

ALTER TABLE lv.physical
    ADD CONSTRAINT calc_empty_without_version CHECK (
        calc_version IS NOT NULL OR (
            calc_source_sha256 IS NULL
            AND calc_stage_sha256 IS NULL
            AND calc_code_sha256 IS NULL
            AND calc_pr5_sha256 IS NULL
            AND calc_distance_method IS NULL
            AND calc_mu_used_mag IS NULL
            AND calc_mb_mag IS NULL
            AND calc_mb_delta_mag IS NULL
            AND calc_mb_qa_status IS NULL
            AND calc_log_mhi_msun IS NULL
            AND calc_log_mhi_delta_dex IS NULL
            AND calc_hi_limit_flag IS NULL
            AND calc_mhi_qa_status IS NULL
            AND calc_log_m26_rounded_vm_msun IS NULL
            AND calc_log_m26_pr5_msun IS NULL
            AND calc_m26_rounded_delta_dex IS NULL
            AND calc_m26_pr5_delta_dex IS NULL
            AND calc_vm_pr5_kms IS NULL
            AND calc_m26_rounded_qa_status IS NULL
            AND calc_m26_pr5_qa_status IS NULL
        )
    ),
    ADD CONSTRAINT calc_status_requires_version CHECK (
        calc_version IS NOT NULL OR (
            calc_mb_qa_status IS NULL AND calc_mhi_qa_status IS NULL
            AND calc_m26_rounded_qa_status IS NULL AND calc_m26_pr5_qa_status IS NULL
        )
    ),
    ADD CONSTRAINT calc_statuses_present_when_versioned CHECK (
        calc_version IS NULL OR (
            calc_source_sha256 IS NOT NULL AND calc_stage_sha256 IS NOT NULL
            AND calc_code_sha256 IS NOT NULL AND calc_pr5_sha256 IS NOT NULL
            AND calc_distance_method IS NOT NULL AND calc_mb_qa_status IS NOT NULL
            AND calc_mhi_qa_status IS NOT NULL AND calc_m26_rounded_qa_status IS NOT NULL
            AND calc_m26_pr5_qa_status IS NOT NULL
        )
    ),
    ADD CONSTRAINT calc_hi_limit_consistency CHECK (
        calc_version IS NULL OR calc_hi_limit_flag IS NOT DISTINCT FROM log_mhi_limit_flag
    ),
    ADD CONSTRAINT calc_mb_status_delta_consistency CHECK (
        calc_version IS NULL OR
        ((calc_mb_qa_status = 'NOT_COMPARABLE') = (calc_mb_delta_mag IS NULL))
    ),
    ADD CONSTRAINT calc_mhi_status_delta_consistency CHECK (
        calc_version IS NULL OR (
            (calc_mhi_qa_status IN ('NOT_COMPARABLE','UPPER_LIMIT_NOT_COMPARABLE','MW_GEOMETRY_EXCEPTION'))
            = (calc_log_mhi_delta_dex IS NULL)
        )
    ),
    ADD CONSTRAINT calc_mhi_limit_status_consistency CHECK (
        calc_version IS NULL OR
        ((calc_hi_limit_flag IS NOT NULL) = (calc_mhi_qa_status LIKE 'UPPER_LIMIT_%'))
    ),
    ADD CONSTRAINT calc_mw_hi_absent CHECK (
        calc_mhi_qa_status IS DISTINCT FROM 'MW_GEOMETRY_EXCEPTION'
        OR (calc_log_mhi_msun IS NULL AND calc_log_mhi_delta_dex IS NULL)
    ),
    ADD CONSTRAINT calc_m26_rounded_status_delta_consistency CHECK (
        calc_version IS NULL OR
        ((calc_m26_rounded_qa_status = 'NOT_COMPARABLE') = (calc_m26_rounded_delta_dex IS NULL))
    ),
    ADD CONSTRAINT calc_m26_pr5_status_delta_consistency CHECK (
        calc_version IS NULL OR
        ((calc_m26_pr5_qa_status = 'NOT_COMPARABLE') = (calc_m26_pr5_delta_dex IS NULL))
    ),
    ADD CONSTRAINT calc_m26_pr5_vm_pair CHECK (
        (calc_vm_pr5_kms IS NULL) = (calc_log_m26_pr5_msun IS NULL)
    );

SELECT meta.setparams('lv','physical','calc_version',
    '{"description":"Frozen reconstruction recipe / QA version"}');
SELECT meta.setparams('lv','physical','calc_source_sha256',
    '{"description":"SHA256 of original LVGDB Table 2 snapshot used for published comparisons"}');
SELECT meta.setparams('lv','physical','calc_stage_sha256',
    '{"description":"SHA256 of staged reconstructed candidates CSV"}');
SELECT meta.setparams('lv','physical','calc_code_sha256',
    '{"description":"SHA256 of code that created the staged candidate calculations"}');
SELECT meta.setparams('lv','physical','calc_pr5_sha256',
    '{"description":"SHA256 of provisional W50 turbulence/inclination correction implementation (PR #5)"}');
SELECT meta.setparams('lv','physical','calc_distance_method',
    '{"description":"LVGDB Table 6 modulus preferred; rounded Table 1 distance used only if modulus absent"}');
SELECT meta.setparams('lv','physical','calc_mu_used_mag',
    '{"description":"Distance modulus used for candidate calculations", "unit":"mag"}');
SELECT meta.setparams('lv','physical','calc_mb_mag',
    '{"description":"B apparent magnitude minus observed foreground extinction, PUBLISHED internal attenuation and adopted distance modulus; dependent on published Ai","unit":"mag"}');
SELECT meta.setparams('lv','physical','calc_mb_delta_mag',
    '{"description":"Reconstructed minus published MB", "unit":"mag"}');
SELECT meta.setparams('lv','physical','calc_mb_qa_status',
    '{"description":"Per-object reconstruction agreement with published MB at absolute tolerance 0.1 mag"}');
SELECT meta.setparams('lv','physical','calc_log_mhi_msun',
    '{"description":"Candidate log HI mass (or upper limit) from observed HI 21cm magnitude and adopted modulus; Milky Way excluded", "unit":"dex(solMass)"}');
SELECT meta.setparams('lv','physical','calc_log_mhi_delta_dex',
    '{"description":"Reconstructed minus published log HI mass/limit", "unit":"dex"}');
SELECT meta.setparams('lv','physical','calc_hi_limit_flag',
    '{"description":"Upper-limit qualifier (<), explicitly not an HI detection"}');
SELECT meta.setparams('lv','physical','calc_mhi_qa_status',
    '{"description":"Per-object HI reconstruction status, including upper limits and Milky Way exclusion"}');
SELECT meta.setparams('lv','physical','calc_log_m26_rounded_vm_msun',
    '{"description":"Diagnostic M26 reconstructed from PUBLISHED rounded Vm and PUBLISHED a26; rounding-sensitive", "unit":"dex(solMass)"}');
SELECT meta.setparams('lv','physical','calc_log_m26_pr5_msun',
    '{"description":"Diagnostic M26 reconstructed from provisional PR #5 unrounded W50-derived Vm and PUBLISHED a26", "unit":"dex(solMass)"}');
SELECT meta.setparams('lv','physical','calc_m26_rounded_delta_dex',
    '{"description":"Rounded-Vm candidate minus published log M26", "unit":"dex"}');
SELECT meta.setparams('lv','physical','calc_m26_pr5_delta_dex',
    '{"description":"PR #5 candidate minus published log M26", "unit":"dex"}');
SELECT meta.setparams('lv','physical','calc_vm_pr5_kms',
    '{"description":"Provisional unrounded Vm based on PR #5 W50 correction", "unit":"km/s"}');
SELECT meta.setparams('lv','physical','calc_m26_rounded_qa_status',
    '{"description":"Comparison of rounded-Vm candidate against published M26, absolute 0.1 dex threshold"}');
SELECT meta.setparams('lv','physical','calc_m26_pr5_qa_status',
    '{"description":"Comparison of provisional PR #5 candidate against published M26, absolute 0.1 dex threshold"}');
