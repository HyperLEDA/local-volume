-- depends: 0005.lvg_source_velocities
-- Published LVGDB Table 2 physical parameters: one canonical, eligible PGC per row.
-- These are author-published quantities, NOT pipeline recomputations.
-- Explicit *_published names reserve independent calculated quantities for later migrations.
-- No source-row rewriting or backfill in the migration itself.
-- This file is for the isolated test database first; review before submitting as a PR.

DO $$
BEGIN
    IF to_regclass('lv.objects') IS NULL OR to_regclass('lv.observed') IS NULL THEN
        RAISE EXCEPTION '0006 requires the official lv.objects and lv.observed tables';
    END IF;
    IF to_regclass('lv.physical') IS NOT NULL THEN
        RAISE EXCEPTION 'lv.physical already exists: refuse to overwrite';
    END IF;
END $$;

CREATE TABLE lv.physical (
    pgc integer PRIMARY KEY REFERENCES lv.objects(pgc) ON DELETE RESTRICT,
    source_catalog text NOT NULL CHECK (source_catalog = 'lvgdb_frozen_table2'),
    source_name text NOT NULL,
    source_file text NOT NULL CHECK (source_file = 'lvg_table2.dat'),
    source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    source_line_number integer NOT NULL CHECK (source_line_number > 0),
    a26_kpc_published numeric(12,4) CHECK (a26_kpc_published > 0),
    inclination_deg_published numeric(8,4) CHECK (
        inclination_deg_published BETWEEN 0 AND 90
    ),
    vrot_kms_published numeric(12,4) CHECK (vrot_kms_published >= 0),
    a_b_internal_mag_published numeric(12,4) CHECK (a_b_internal_mag_published >= 0),
    abs_b_mag_published numeric(12,4),
    mean_sb_b_mag_arcsec2_published numeric(12,4),
    log_lks_lsun_published numeric(12,4),
    log_m26_msun_published numeric(12,4),
    log_mhi_limit_flag text CHECK (log_mhi_limit_flag IN ('<')),
    log_mhi_msun_published numeric(12,4),
    v_lg_kms_published numeric(12,4),
    theta1_published numeric(12,4),
    md_published text,
    theta5_published numeric(12,4),
    thetaj_published numeric(12,4),
    loaded_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT physical_hi_limit_has_value CHECK (
        log_mhi_limit_flag IS NULL OR log_mhi_msun_published IS NOT NULL
    ),
    CONSTRAINT physical_tidal_pair_together CHECK (
        (theta1_published IS NULL) = (theta5_published IS NULL)
    ),
    CONSTRAINT physical_md_for_theta1 CHECK (
        theta1_published IS NULL OR md_published IS NOT NULL
    ),
    CONSTRAINT physical_unique_source_line UNIQUE (source_sha256, source_line_number)
);

CREATE INDEX physical_source_name_idx ON lv.physical (source_name);

SELECT meta.setparams('lv','physical',
    '{"description":"Published global parameters from the frozen LVGDB lvg_table2.dat snapshot; one row per canonical science-eligible PGC; not independently recomputed. Source identity is resolved separately. The source-native values, including HI upper limits, are preserved without correction."}');
SELECT meta.setparams('lv','physical','pgc',
    '{"description":"Canonical, previously resolved PGC", "ucd":"meta.id;meta.main"}');
SELECT meta.setparams('lv','physical','source_catalog',
    '{"description":"Fixed provenance identifier of the frozen LVGDB Table 2 snapshot"}');
SELECT meta.setparams('lv','physical','source_name',
    '{"description":"Unmodified source designation used to match the published Table 2 row"}');
SELECT meta.setparams('lv','physical','source_file',
    '{"description":"Source basename of the frozen LVGDB text table"}');
SELECT meta.setparams('lv','physical','source_sha256',
    '{"description":"SHA256 hash of the complete original frozen source file"}');
SELECT meta.setparams('lv','physical','source_line_number',
    '{"description":"One-based physical source text line number"}');
SELECT meta.setparams('lv','physical','a26_kpc_published',
    '{"description":"Published major linear diameter at the corrected Holmberg 26.5 B-mag/arcsec2 isophote (Table 2 note 1)","unit":"kpc"}');
SELECT meta.setparams('lv','physical','inclination_deg_published',
    '{"description":"Published disk inclination from LVGDB Table 2", "unit":"deg"}');
SELECT meta.setparams('lv','physical','vrot_kms_published',
    '{"description":"Published rotational amplitude Vm from HI W50, turbulence and inclination corrected (Table 2 note 2)","unit":"km/s"}');
SELECT meta.setparams('lv','physical','a_b_internal_mag_published',
    '{"description":"Published internal B-band attenuation AB, following the catalog convention for gas-poor systems (Table 2 note 3)","unit":"mag"}');
SELECT meta.setparams('lv','physical','abs_b_mag_published',
    '{"description":"Published absolute B-band magnitude corrected for Galactic and internal extinction (Table 2 note 4)","unit":"mag"}');
SELECT meta.setparams('lv','physical','mean_sb_b_mag_arcsec2_published',
    '{"description":"Published average B-band surface brightness inside corrected Holmberg isophote (Table 2 note 5)","unit":"mag/arcsec2"}');
SELECT meta.setparams('lv','physical','log_lks_lsun_published',
    '{"description":"Published log10 Ks-band luminosity relative to the Sun (Table 2 note 6)","unit":"dex(solLum)"}');
SELECT meta.setparams('lv','physical','log_m26_msun_published',
    '{"description":"Published log10 dynamical mass within Holmberg radius (Table 2 note 7)","unit":"dex(solMass)"}');
SELECT meta.setparams('lv','physical','log_mhi_limit_flag',
    '{"description":"Original Table 2 upper-limit qualifier (<) for log HI mass, not a detection"}');
SELECT meta.setparams('lv','physical','log_mhi_msun_published',
    '{"description":"Published log10 HI mass, with upper-limit status in log_mhi_limit_flag (Table 2 note 8)","unit":"dex(solMass)"}');
SELECT meta.setparams('lv','physical','v_lg_kms_published',
    '{"description":"Published Local Group frame velocity from Table 2 (note 9); distinct from Table 1 source-native velocity", "unit":"km/s"}');
SELECT meta.setparams('lv','physical','theta1_published',
    '{"description":"Published maximum-neighbor tidal index Theta1 (Table 2 note 10)"}');
SELECT meta.setparams('lv','physical','md_published',
    '{"description":"Published main disturber designation (Table 2 note 11), may be outside LVGDB"}');
SELECT meta.setparams('lv','physical','theta5_published',
    '{"description":"Published top-five-neighbor tidal index Theta5 (Table 2 note 12)"}');
SELECT meta.setparams('lv','physical','thetaj_published',
    '{"description":"Published log Ks luminosity density within 1 Mpc relative to cosmic mean (Table 2 note 13)"}');
SELECT meta.setparams('lv','physical','loaded_at',
    '{"description":"Time at which canonical published physical row was first loaded"}');
