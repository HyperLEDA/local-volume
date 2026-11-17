-- depends: 0013.lv_physical_uncertainties
-- Store two independently cacheable 512x512 WebP variants per group:
-- hierarchy (full MD sky graph) and portrait (close-up of root galaxy).
-- Existing thumbnails are retained verbatim as the hierarchy variant.
-- This migration does not touch lv.objects, lv.observed or lv.physical.
DO $$
BEGIN
    IF to_regclass('lv.group_previews') IS NULL THEN
        RAISE EXCEPTION '0014 requires lv.group_previews from 0012';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'lv' AND table_name = 'group_previews'
          AND column_name = 'variant'
    ) THEN
        RAISE EXCEPTION '0014 preview variant column already exists: check yoyo migration state';
    END IF;
END $$;

ALTER TABLE lv.group_previews
    ADD COLUMN variant text NOT NULL DEFAULT 'hierarchy'
    CHECK (variant IN ('hierarchy', 'portrait'));

ALTER TABLE lv.group_previews DROP CONSTRAINT group_previews_pkey;
ALTER TABLE lv.group_previews
    ADD CONSTRAINT group_previews_pkey PRIMARY KEY (root_pgc, definition, variant);

SELECT meta.setparams('lv', 'group_previews', 'variant',
    '{"description":"Stored image mode: hierarchy is DSS2 with group markers/MD links; portrait is a close-up of the central galaxy using the individual object FoV rule."}');
