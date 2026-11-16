-- depends: 0009.lv_physical_p3_diameter
-- Materialized scientifically derived quantities in lv.physical.
-- Existing published/candidate columns remain untouched for now: historical data
-- is not silently deleted. API uses exclusively the new computed columns.
-- The trigger merely marks the catalog dirty; all expensive mathematics lives
-- in the background Python refresh worker, outside source-data transactions.

DO $$
BEGIN
  IF to_regclass('lv.physical') IS NULL OR to_regclass('lv.observed') IS NULL
     OR to_regclass('lv.objects') IS NULL THEN
    RAISE EXCEPTION '0010 requires existing lv.physical, lv.observed and lv.objects';
  END IF;
END $$;

-- 0006 required Table-2 provenance for every physical row. Computed records
-- no longer require a published counterpart, and objects must be deletable.
ALTER TABLE lv.physical
  ALTER COLUMN source_catalog DROP NOT NULL,
  ALTER COLUMN source_name DROP NOT NULL,
  ALTER COLUMN source_file DROP NOT NULL,
  ALTER COLUMN source_sha256 DROP NOT NULL,
  ALTER COLUMN source_line_number DROP NOT NULL;

DO $$
DECLARE old_fk text;
BEGIN
  SELECT conname INTO old_fk
  FROM pg_constraint
  WHERE conrelid = 'lv.physical'::regclass
    AND confrelid = 'lv.objects'::regclass
    AND contype = 'f';
  IF old_fk IS NULL THEN
    RAISE EXCEPTION 'Expected physical-to-objects FK not found';
  END IF;
  EXECUTE format('ALTER TABLE lv.physical DROP CONSTRAINT %I', old_fk);
END $$;
ALTER TABLE lv.physical
  ADD CONSTRAINT physical_pgc_fk_computed
  FOREIGN KEY (pgc) REFERENCES lv.objects(pgc) ON DELETE CASCADE;

ALTER TABLE lv.physical
  ADD COLUMN a26_kpc double precision,
  ADD COLUMN inclination_deg double precision,
  ADD COLUMN vrot_kms double precision,
  ADD COLUMN a_b_internal_mag double precision,
  ADD COLUMN abs_b_mag double precision,
  ADD COLUMN abs_ks_mag double precision,
  ADD COLUMN mean_sb_b_mag_arcsec2 double precision,
  ADD COLUMN log_lks_lsun double precision,
  ADD COLUMN log_m26_msun double precision,
  ADD COLUMN log_mhi_msun double precision,
  ADD COLUMN derived_hi_limit_flag text CHECK (derived_hi_limit_flag IS NULL OR derived_hi_limit_flag = '<'),
  ADD COLUMN log_sfr_halpha_msun_yr double precision,
  ADD COLUMN log_sfr_fuv_msun_yr double precision,
  ADD COLUMN log_sfr_halpha_upper_limit boolean,
  ADD COLUMN log_sfr_fuv_upper_limit boolean,
  ADD COLUMN ks_mag_used double precision,
  ADD COLUMN ks_estimated boolean,
  ADD COLUMN ks_method text,
  ADD COLUMN distance_method text,
  ADD COLUMN internal_extinction_method text,
  ADD COLUMN md_pgc integer,
  ADD COLUMN theta1 double precision,
  ADD COLUMN theta5 double precision,
  ADD COLUMN thetaj double precision,
  ADD COLUMN environment_coverage text,
  ADD COLUMN environment_donors_used integer,
  ADD COLUMN environment_neighbors_1mpc integer,
  ADD COLUMN physical_method text,
  ADD COLUMN computed_revision bigint,
  ADD COLUMN computed_at timestamptz;

CREATE TABLE lv.physical_refresh_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  source_revision bigint NOT NULL DEFAULT 1 CHECK (source_revision >= 1),
  applied_revision bigint NOT NULL DEFAULT 0 CHECK (applied_revision >= 0),
  formula_version text,
  source_changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  refreshed_at timestamptz,
  last_error text,
  last_error_at timestamptz
);
INSERT INTO lv.physical_refresh_state (singleton) VALUES (true);

CREATE FUNCTION lv.mark_physical_dirty() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE lv.physical_refresh_state
     SET source_revision = source_revision + 1,
         source_changed_at = clock_timestamp(),
         last_error = NULL,
         last_error_at = NULL
   WHERE singleton = true;
  PERFORM pg_notify('lv_physical_dirty', 'changed');
  RETURN NULL;
END $$;

CREATE TRIGGER observed_physical_dirty
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON lv.observed
FOR EACH STATEMENT EXECUTE FUNCTION lv.mark_physical_dirty();

CREATE TRIGGER objects_physical_dirty
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON lv.objects
FOR EACH STATEMENT EXECUTE FUNCTION lv.mark_physical_dirty();

-- An INSERT/UPDATE/DELETE invalidates the full environment catalogue. The
-- worker recomputes all targets using one shared donor snapshot. Every new
-- column used by a future scientific formula needs a code/version change.

SELECT meta.setparams('lv', 'physical',
  '{"description":"Precomputed physical galaxy parameters from adopted lv.objects and lv.observed data. API uses computed columns; historical *_published and calc_* fields are deprecated and are not required or consulted. Global refresh uses an epoch-based durable invalidation marker."}');
