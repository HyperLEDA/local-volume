-- yoyo consolidated PUBLIC migration: preserve ra/dec and type_name. REVIEW CANDIDATE; not yet deployed.
-- depends: 0003.objects_nice_labels
-- Prerequisite: official 0001, 0002 and 0003.objects_nice_labels.
-- PR #22 writes nice labels on lv.objects; 0004 transfers those labels to lv.observed.
-- Clean target only. NEVER apply to the existing experimental lv database.
-- Excludes lv.distances, lv.source_snapshots, lv.source_rows, lv.observed_sources.
-- Source-level snapshots and raw rows belong to the offline ingestion workspace.
-- Existing data from LV 0002 is copied before legacy columns are dropped.

DO $$
BEGIN
  IF to_regclass('lv.observed') IS NOT NULL THEN
    RAISE EXCEPTION 'lv.observed already exists: 0004 requires an unmodified 0001+0002 target';
  END IF;
  IF to_regclass('lv.source_rows') IS NOT NULL
     OR to_regclass('lv.source_snapshots') IS NOT NULL
     OR to_regclass('lv.distances') IS NOT NULL
     OR to_regclass('lv.observed_sources') IS NOT NULL
     OR to_regclass('lv.obs_params') IS NOT NULL
     OR EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'lv' AND table_name = 'objects' AND column_name = 'dist'
     ) THEN
    RAISE EXCEPTION 'Experimental LV schema detected: do not run this migration in the old database';
  END IF;
END $$;

-- Public adopted observational measurements, one row per canonical PGC.
-- a50/b50 originate in published migration 0002. Their original measurement catalog
-- has not been verified; retain values without conflating with LVG a26_arcmin.
CREATE TABLE lv.observed (
    pgc integer PRIMARY KEY REFERENCES lv.objects(pgc) ON DELETE RESTRICT,
    v_hel double precision,
    e_v_hel real,
    bt real,
    e_bt real,
    kt real,
    e_kt real,
    v_lg double precision,
    e_v_lg real,
    a50 real,
    e_a50 real,
    b50 real,
    e_b50 real,
    source_catalog text,
    source_name text,
    dist double precision CHECK (dist > 0),
    mu numeric(10,4),
    e_mu numeric(10,4) CHECK (e_mu >= 0),
    distance_method text,
    modulus_method text,
    distance_reference text,
    morphology_t smallint,
    dwarf_morphology text,
    dwarf_sb_class text,
    a26_arcmin numeric(12,4) CHECK (a26_arcmin > 0),
    axis_ratio numeric(8,5) CHECK (axis_ratio > 0 AND axis_ratio <= 1),
    a_b_galactic_mag numeric(10,4) CHECK (a_b_galactic_mag >= 0),
    fuv_mag numeric(10,4),
    e_fuv_mag numeric(10,4) CHECK (e_fuv_mag >= 0),
    fuv_limit text,
    b_mag numeric(10,4),
    e_b_mag numeric(10,4) CHECK (e_b_mag >= 0),
    ha_mag numeric(10,4),
    e_ha_mag numeric(10,4) CHECK (e_ha_mag >= 0),
    ha_limit text,
    ks_mag numeric(10,4),
    e_ks_mag numeric(10,4) CHECK (e_ks_mag >= 0),
    ks_estimated boolean,
    hi21_mag numeric(10,4),
    e_hi21_mag numeric(10,4) CHECK (e_hi21_mag >= 0),
    hi21_limit text,
    w50_kms numeric(12,4) CHECK (w50_kms >= 0),
    e_w50_kms numeric(12,4) CHECK (e_w50_kms >= 0),
    loaded_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT observed_mu_error_requires_mu CHECK (e_mu IS NULL OR mu IS NOT NULL)
);

-- Preserve all previously published 0002 measurements in the new home.
-- DO NOT substitute LVG B / Ks / a26 for existing bt / kt / a50; definitions differ.
INSERT INTO lv.observed (pgc, v_hel, e_v_hel, bt, e_bt, kt, e_kt, v_lg, e_v_lg, a50, e_a50, b50, e_b50)
SELECT pgc, v_hel, e_v_hel, bt, e_bt, kt, e_kt, v_lg, e_v_lg, a50, e_a50, b50, e_b50
FROM lv.objects;

DO $$
BEGIN
  IF (SELECT count(*) FROM lv.observed) <> (SELECT count(*) FROM lv.objects) THEN
    RAISE EXCEPTION '0004 failed to preserve legacy lv.objects rows';
  END IF;
END $$;

-- Assert per-object AND per-field preservation, not just a row-count match.
-- This still runs before the destructive DROP COLUMN operations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM lv.objects AS o
    LEFT JOIN lv.observed AS obs ON obs.pgc = o.pgc
    WHERE obs.pgc IS NULL
       OR ROW(o.v_hel, o.e_v_hel, o.bt, o.e_bt, o.kt, o.e_kt,
              o.v_lg, o.e_v_lg, o.a50, o.e_a50, o.b50, o.e_b50)
          IS DISTINCT FROM
          ROW(obs.v_hel, obs.e_v_hel, obs.bt, obs.e_bt, obs.kt, obs.e_kt,
              obs.v_lg, obs.e_v_lg, obs.a50, obs.e_a50, obs.b50, obs.e_b50)
  ) THEN
    RAISE EXCEPTION '0004: legacy observational values differ after copy';
  END IF;
END $$;

-- Legacy observational columns now safely reside in lv.observed.
ALTER TABLE lv.objects
    DROP COLUMN v_hel,
    DROP COLUMN e_v_hel,
    DROP COLUMN bt,
    DROP COLUMN e_bt,
    DROP COLUMN kt,
    DROP COLUMN e_kt,
    DROP COLUMN v_lg,
    DROP COLUMN e_v_lg,
    DROP COLUMN a50,
    DROP COLUMN e_a50,
    DROP COLUMN b50,
    DROP COLUMN e_b50;

-- Preserve existing ICRS and classification columns without renaming:
-- ra, e_ra, dec, e_dec, type_name.

SELECT meta.setparams('lv', 'observed', '{"description": "Adopted Local Volume observed quantities; primary key PGC, one row per object"}');
SELECT meta.setparams('lv', 'observed', 'pgc', '{"description": "Canonical PGC identifier", "ucd": "meta.id;meta.main"}');
SELECT meta.setparams('lv', 'observed', 'v_hel', '{"description": "Heliocentric radial velocity carried forward from LV 0002", "unit": "km/s"}');
SELECT meta.setparams('lv', 'observed', 'e_v_hel', '{"description": "Uncertainty of heliocentric radial velocity from LV 0002", "unit": "km/s"}');
SELECT meta.setparams('lv', 'observed', 'bt', '{"description": "Mean total B magnitude from LV 0002", "unit": "mag", "ucd": "phot.mag;em.opt.B"}');
SELECT meta.setparams('lv', 'observed', 'e_bt', '{"description": "Uncertainty of mean total B magnitude from LV 0002", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'kt', '{"description": "Mean total K magnitude from LV 0002", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'e_kt', '{"description": "Uncertainty of mean total K magnitude from LV 0002", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'v_lg', '{"description": "Local Group velocity from LV 0002", "unit": "km/s"}');
SELECT meta.setparams('lv', 'observed', 'e_v_lg', '{"description": "Uncertainty of Local Group velocity from LV 0002", "unit": "km/s"}');
SELECT meta.setparams('lv', 'observed', 'a50', '{"description": "Mean semi-major axis enclosing 50% of flux from LV 0002", "unit": "arcsec", "ucd": "phys.angSize.smajAxis"}');
SELECT meta.setparams('lv', 'observed', 'e_a50', '{"description": "Uncertainty of a50 from LV 0002", "unit": "arcsec"}');
SELECT meta.setparams('lv', 'observed', 'b50', '{"description": "Mean semi-minor axis enclosing 50% of flux from LV 0002", "unit": "arcsec", "ucd": "phys.angSize.sminAxis"}');
SELECT meta.setparams('lv', 'observed', 'e_b50', '{"description": "Uncertainty of b50 from LV 0002", "unit": "arcsec"}');
SELECT meta.setparams('lv', 'observed', 'source_catalog', '{"description": "Identifier of the adopted source catalog; source-level, not per-measurement provenance"}');
SELECT meta.setparams('lv', 'observed', 'source_name', '{"description": "Source designation for the adopted catalog record"}');
SELECT meta.setparams('lv', 'observed', 'dist', '{"description": "Adopted LVG catalog distance", "unit": "Mpc", "ucd": "pos.distance"}');
SELECT meta.setparams('lv', 'observed', 'mu', '{"description": "Distance modulus as published in LVG Table 6", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'e_mu', '{"description": "Published non-negative uncertainty of distance modulus", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'distance_method', '{"description": "Method of adopted distance from LVG Table 1"}');
SELECT meta.setparams('lv', 'observed', 'modulus_method', '{"description": "Method associated with LVG Table 6 distance modulus"}');
SELECT meta.setparams('lv', 'observed', 'distance_reference', '{"description": "Bibliographic reference for LVG Table 6 distance modulus"}');
SELECT meta.setparams('lv', 'observed', 'morphology_t', '{"description": "LVG de Vaucouleurs morphological type"}');
SELECT meta.setparams('lv', 'observed', 'dwarf_morphology', '{"description": "LVG dwarf morphological class"}');
SELECT meta.setparams('lv', 'observed', 'dwarf_sb_class', '{"description": "LVG dwarf surface brightness class"}');
SELECT meta.setparams('lv', 'observed', 'a26_arcmin', '{"description": "LVG Holmberg major angular diameter (not a50)", "unit": "arcmin"}');
SELECT meta.setparams('lv', 'observed', 'axis_ratio', '{"description": "LVG axis ratio b/a"}');
SELECT meta.setparams('lv', 'observed', 'a_b_galactic_mag', '{"description": "LVG foreground Galactic B-band extinction", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'fuv_mag', '{"description": "LVG FUV apparent magnitude; see fuv_limit", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'e_fuv_mag', '{"description": "Valid non-negative FUV magnitude error", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'fuv_limit', '{"description": "Original limit qualifier for FUV magnitude"}');
SELECT meta.setparams('lv', 'observed', 'b_mag', '{"description": "LVG adopted integrated B apparent magnitude; not necessarily identical to bt", "unit": "mag", "ucd": "phot.mag;em.opt.B"}');
SELECT meta.setparams('lv', 'observed', 'e_b_mag', '{"description": "Valid non-negative LVG B magnitude error", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'ha_mag', '{"description": "LVG H-alpha apparent emission magnitude", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'e_ha_mag', '{"description": "Valid non-negative LVG H-alpha magnitude error", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'ha_limit', '{"description": "Original H-alpha limit qualifier"}');
SELECT meta.setparams('lv', 'observed', 'ks_mag', '{"description": "LVG adopted Ks apparent magnitude; not necessarily identical to kt", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'e_ks_mag', '{"description": "Valid non-negative LVG Ks magnitude error", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'ks_estimated', '{"description": "LVG indicator of a source-estimated Ks magnitude"}');
SELECT meta.setparams('lv', 'observed', 'hi21_mag', '{"description": "LVG 21-cm equivalent magnitude; not HI mass or integrated flux", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'e_hi21_mag', '{"description": "Valid non-negative LVG 21-cm magnitude error", "unit": "mag"}');
SELECT meta.setparams('lv', 'observed', 'hi21_limit', '{"description": "Original 21-cm magnitude limit qualifier"}');
SELECT meta.setparams('lv', 'observed', 'w50_kms', '{"description": "LVG HI line width at 50% peak; not stellar dispersion", "unit": "km/s"}');
SELECT meta.setparams('lv', 'observed', 'e_w50_kms', '{"description": "Valid non-negative HI W50 uncertainty", "unit": "km/s"}');
SELECT meta.setparams('lv', 'observed', 'loaded_at', '{"description": "Timestamp when adopted row was first inserted"}');

-- Assert EXACT public lv.objects scientific columns, irrespective of physical order.
DO $$
DECLARE
  actual text[];
  expected text[] := ARRAY['pgc','name','ra','dec','e_ra','e_dec','type_name'];
BEGIN
  SELECT array_agg(column_name ORDER BY column_name) INTO actual
  FROM information_schema.columns
  WHERE table_schema = 'lv' AND table_name = 'objects';
  IF actual IS DISTINCT FROM (SELECT array_agg(value ORDER BY value) FROM unnest(expected) AS u(value)) THEN
    RAISE EXCEPTION 'lv.objects not minimal after 0004: %', actual;
  END IF;
END $$;

-- Keep the machine-readable UCDs published in migration 0002.
-- The 5-argument meta.setparams overload updates an individual JSON property.
SELECT meta.setparams('lv', 'observed', 'e_bt', 'ucd', 'stat.error;phot.mag;em.opt.B');
SELECT meta.setparams('lv', 'observed', 'kt', 'ucd', 'phot.mag;em.IR.K');
SELECT meta.setparams('lv', 'observed', 'e_kt', 'ucd', 'stat.error;phot.mag;em.IR.K');
SELECT meta.setparams('lv', 'observed', 'e_a50', 'ucd', 'stat.error;phys.angSize.smajAxis');
SELECT meta.setparams('lv', 'observed', 'e_b50', 'ucd', 'stat.error;phys.angSize.sminAxis');

-- Preserve the scientific presentation labels introduced by PR #22 (migration 0003).
-- ra and dec remain in lv.objects and retain their existing nice metadata.
SELECT meta.setparams('lv', 'observed', 'bt', 'nice', 'B<sub>T</sub>');
SELECT meta.setparams('lv', 'observed', 'kt', 'nice', 'K<sub>T</sub>');
SELECT meta.setparams('lv', 'observed', 'v_hel', 'nice', 'V<sub>hel</sub>');
SELECT meta.setparams('lv', 'observed', 'v_lg', 'nice', 'V<sub>LG</sub>');
SELECT meta.setparams('lv', 'observed', 'a50', 'nice', 'a<sub>50</sub>');
SELECT meta.setparams('lv', 'observed', 'b50', 'nice', 'b<sub>50</sub>');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('bt', 'B<sub>T</sub>'),
      ('kt', 'K<sub>T</sub>'),
      ('v_hel', 'V<sub>hel</sub>'),
      ('v_lg', 'V<sub>LG</sub>'),
      ('a50', 'a<sub>50</sub>'),
      ('b50', 'b<sub>50</sub>')
    ) AS expected(column_name, label)
    LEFT JOIN meta.column_info ci
      ON ci.schema_name = 'lv'
     AND ci.table_name = 'observed'
     AND ci.column_name = expected.column_name
    WHERE ci.param->>'nice' IS DISTINCT FROM expected.label
  ) THEN
    RAISE EXCEPTION '0004: scientific nice labels lost';
  END IF;
END $$;
