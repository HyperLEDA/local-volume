-- depends: 0014.lv_group_preview_variants
-- A valid 512x512 WebP may be smaller than 4 KiB.
-- Keep the database limit aligned with validate_webp(): 30-byte minimum
-- for supported headers and an unchanged maximum of 5 MiB.
-- No catalogue values, group memberships or existing images are modified.
DO $$
DECLARE
    old_constraint text;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO old_constraint
    FROM pg_constraint AS c
    JOIN pg_class AS t ON t.oid = c.conrelid
    JOIN pg_namespace AS n ON n.oid = t.relnamespace
    WHERE n.nspname = 'lv'
      AND t.relname = 'group_previews'
      AND c.conname = 'group_previews_image_webp_check'
      AND c.contype = 'c';

    IF old_constraint IS NULL OR position('4096' in old_constraint) = 0 THEN
        RAISE EXCEPTION '0015: unexpected group_previews WebP constraint: %', old_constraint;
    END IF;
END $$;

ALTER TABLE lv.group_previews
    DROP CONSTRAINT group_previews_image_webp_check;

ALTER TABLE lv.group_previews
    ADD CONSTRAINT group_previews_image_webp_check
    CHECK (octet_length(image_webp) BETWEEN 30 AND 5242880);
