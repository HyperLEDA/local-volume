SELECT
    r.pgc,
    d.design AS name,
    i.ra,
    i.e_ra,
    i.dec,
    i.e_dec,
    bt.mag AS bt,
    bt.e_mag AS e_bt,
    kt.mag AS kt,
    kt.e_mag AS e_kt,
    v_hel.v AS v_hel,
    v_hel.e_v AS e_v_hel,
    v_lg.v AS v_lg,
    v_lg.e_v AS e_v_lg,
    geom.a AS a50,
    geom.e_a AS e_a50,
    geom.b AS b50,
    geom.e_b AS e_b50,
    n.type_name
FROM layer0.records AS r
JOIN layer0.tables AS t ON t.id = r.table_id
LEFT JOIN layer2.designation AS d ON d.pgc = r.pgc
LEFT JOIN layer2.icrs AS i ON i.pgc = r.pgc
LEFT JOIN layer2.nature AS n ON n.pgc = r.pgc
LEFT JOIN layer2.velocity AS v_hel
    ON v_hel.pgc = r.pgc AND v_hel.apex = 'heliocentric'
LEFT JOIN layer2.velocity AS v_lg
    ON v_lg.pgc = r.pgc AND v_lg.apex = 'local_group'
LEFT JOIN (
    SELECT
        pgc,
        AVG(mag) AS mag,
        AVG(e_mag) AS e_mag
    FROM layer2.photometry_total
    WHERE band = 'B'
    GROUP BY pgc
) AS bt ON bt.pgc = r.pgc
LEFT JOIN (
    SELECT
        pgc,
        AVG(mag) AS mag,
        AVG(e_mag) AS e_mag
    FROM layer2.photometry_total
    WHERE band = 'K'
    GROUP BY pgc
) AS kt ON kt.pgc = r.pgc
LEFT JOIN (
    SELECT
        rec.pgc,
        AVG(e.a) AS a,
        AVG(e.e_a) AS e_a,
        AVG(e.b) AS b,
        AVG(e.e_b) AS e_b
    FROM photometry.ellipse AS e
    JOIN layer0.records AS rec ON rec.id = e.record_id
    WHERE e.level = 50
      AND rec.pgc IS NOT NULL
    GROUP BY rec.pgc
) AS geom ON geom.pgc = r.pgc
WHERE t.table_name = 'nearby_galaxy_catalog_2026-09-03'
  AND r.pgc IS NOT NULL;
