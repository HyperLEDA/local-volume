SELECT
    r.pgc,
    d.design AS name
FROM layer0.records AS r
JOIN layer0.tables AS t ON t.id = r.table_id
JOIN layer2.designations AS d ON d.pgc = r.pgc
WHERE t.table_name = 'nearby_galaxy_catalog_2026-02-22'
  AND r.pgc IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM layer2.designation AS main
    WHERE main.pgc = d.pgc AND main.design = d.design
  );
