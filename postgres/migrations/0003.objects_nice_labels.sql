-- depends: 0002.objects_photometry_velocity_geometry
-- Presentation labels are stored alongside column metadata, not in the measurements.
-- meta.setparams(5 args) merges the new key into existing JSON comments.
SELECT meta.setparams('lv', 'objects', 'ra', 'nice', 'α');
SELECT meta.setparams('lv', 'objects', 'dec', 'nice', 'δ');
SELECT meta.setparams('lv', 'objects', 'bt', 'nice', 'B<sub>T</sub>');
SELECT meta.setparams('lv', 'objects', 'kt', 'nice', 'K<sub>T</sub>');
SELECT meta.setparams('lv', 'objects', 'v_hel', 'nice', 'V<sub>hel</sub>');
SELECT meta.setparams('lv', 'objects', 'v_lg', 'nice', 'V<sub>LG</sub>');
SELECT meta.setparams('lv', 'objects', 'a50', 'nice', 'a<sub>50</sub>');
SELECT meta.setparams('lv', 'objects', 'b50', 'nice', 'b<sub>50</sub>');
