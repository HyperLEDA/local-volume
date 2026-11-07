ALTER TABLE lv.objects RENAME COLUMN cz TO v_hel;
ALTER TABLE lv.objects RENAME COLUMN e_cz TO e_v_hel;

ALTER TABLE lv.objects
    ADD COLUMN bt real,
    ADD COLUMN e_bt real,
    ADD COLUMN kt real,
    ADD COLUMN e_kt real,
    ADD COLUMN v_lg double precision,
    ADD COLUMN e_v_lg real,
    ADD COLUMN a50 real,
    ADD COLUMN e_a50 real,
    ADD COLUMN b50 real,
    ADD COLUMN e_b50 real;

SELECT meta.setparams('lv', 'objects', 'bt', '{"description": "Mean total B magnitude", "unit": "mag", "ucd": "phot.mag;em.opt.B"}');
SELECT meta.setparams('lv', 'objects', 'e_bt', '{"description": "Mean total B magnitude error", "unit": "mag", "ucd": "stat.error;phot.mag;em.opt.B"}');
SELECT meta.setparams('lv', 'objects', 'kt', '{"description": "Mean total K magnitude", "unit": "mag", "ucd": "phot.mag;em.IR.K"}');
SELECT meta.setparams('lv', 'objects', 'e_kt', '{"description": "Mean total K magnitude error", "unit": "mag", "ucd": "stat.error;phot.mag;em.IR.K"}');
SELECT meta.setparams('lv', 'objects', 'v_hel', '{"description": "Heliocentric velocity", "unit": "km/s"}');
SELECT meta.setparams('lv', 'objects', 'e_v_hel', '{"description": "Heliocentric velocity error", "unit": "km/s"}');
SELECT meta.setparams('lv', 'objects', 'v_lg', '{"description": "Local Group velocity", "unit": "km/s"}');
SELECT meta.setparams('lv', 'objects', 'e_v_lg', '{"description": "Local Group velocity error", "unit": "km/s"}');
SELECT meta.setparams('lv', 'objects', 'a50', '{"description": "Mean semi-major axis at 50% enclosed flux", "unit": "arcsec", "ucd": "phys.angSize.smajAxis"}');
SELECT meta.setparams('lv', 'objects', 'e_a50', '{"description": "Mean semi-major axis error at 50% enclosed flux", "unit": "arcsec", "ucd": "stat.error;phys.angSize.smajAxis"}');
SELECT meta.setparams('lv', 'objects', 'b50', '{"description": "Mean semi-minor axis at 50% enclosed flux", "unit": "arcsec", "ucd": "phys.angSize.sminAxis"}');
SELECT meta.setparams('lv', 'objects', 'e_b50', '{"description": "Mean semi-minor axis error at 50% enclosed flux", "unit": "arcsec", "ucd": "stat.error;phys.angSize.sminAxis"}');
