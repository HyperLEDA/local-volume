ALTER TABLE lv.objects
    ADD COLUMN dist double precision
    CHECK (dist IS NULL OR dist > 0);

SELECT meta.setparams(
    'lv', 'objects', 'dist',
    '{"description": "Adopted distance", "unit": "Mpc", "ucd": "pos.distance"}'
);
