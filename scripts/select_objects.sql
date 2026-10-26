SELECT
    r.pgc,
    d.design AS name,
    i.ra,
    i.e_ra,
    i.dec,
    i.e_dec,
    c.cz,
    c.e_cz,
    n.type_name
FROM layer0.records AS r
JOIN layer0.tables AS t ON t.id = r.table_id
LEFT JOIN layer2.designation AS d ON d.pgc = r.pgc
LEFT JOIN layer2.icrs AS i ON i.pgc = r.pgc
LEFT JOIN layer2.cz AS c ON c.pgc = r.pgc
LEFT JOIN layer2.nature AS n ON n.pgc = r.pgc
WHERE t.table_name = 'nearby_galaxy_catalog_2026-02-22'
  AND r.pgc IS NOT NULL;
