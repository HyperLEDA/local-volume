-- depends: 0011.lv_groups
-- Derived group thumbnails are binary image assets; they are NOT member records.
-- No read/write or transformation of lv.objects, lv.observed, or lv.physical.
DO $$
BEGIN
    IF to_regclass('lv.objects') IS NULL OR to_regclass('lv.physical_refresh_state') IS NULL THEN
        RAISE EXCEPTION '0012 requires the current LV catalogue';
    END IF;
    IF to_regclass('lv.group_previews') IS NOT NULL THEN
        RAISE EXCEPTION 'lv.group_previews already exists: review schema before applying';
    END IF;
END $$;

CREATE TABLE lv.group_previews (
    root_pgc integer NOT NULL REFERENCES lv.objects(pgc) ON DELETE CASCADE,
    definition text NOT NULL CHECK (definition IN ('physical', 'suite')),
    source_revision bigint NOT NULL CHECK (source_revision > 0),
    formula_version text NOT NULL,
    render_version text NOT NULL,
    image_webp bytea NOT NULL CHECK (octet_length(image_webp) BETWEEN 4096 AND 5242880),
    image_sha256 text NOT NULL CHECK (image_sha256 ~ '^[0-9a-f]{64}$'),
    image_width integer NOT NULL CHECK (image_width = 512),
    image_height integer NOT NULL CHECK (image_height = 512),
    survey text NOT NULL CHECK (survey = 'DSS2 Color'),
    projection text NOT NULL CHECK (projection = 'SIN'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (root_pgc, definition)
);

SELECT meta.setparams('lv','group_previews',
 '{"description":"Stored 512-pixel WebP SIN/DSS2 Color group sky thumbnails with rendered catalogue markers and directed MD links. Images are cache artifacts keyed by current physical revision, formula and renderer version; not astronomical measurements."}');
SELECT meta.setparams('lv','group_previews','root_pgc',
 '{"description":"Canonical PGC of the derived group root", "ucd":"meta.id"}');
SELECT meta.setparams('lv','group_previews','image_webp',
 '{"description":"Complete rendered square preview image in WebP, including sky, galaxy markers and main-disturber relations"}');
SELECT meta.setparams('lv','group_previews','source_revision',
 '{"description":"lv.physical applied revision at rendering; mismatches invalidate the cached thumbnail"}');
