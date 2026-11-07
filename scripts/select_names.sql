WITH catalog_pgcs AS (
    SELECT DISTINCT r.pgc
    FROM layer0.records AS r
    JOIN layer0.tables AS t ON t.id = r.table_id
    WHERE t.table_name = 'nearby_galaxy_catalog_2026-09-03'
      AND r.pgc IS NOT NULL
)
SELECT DISTINCT
    c.pgc,
    d.design AS name
FROM catalog_pgcs AS c
JOIN layer0.records AS r ON r.pgc = c.pgc
JOIN designation.data AS d ON d.record_id = r.id
WHERE NOT EXISTS (
    SELECT 1
    FROM layer2.designation AS main
    WHERE main.pgc = c.pgc AND main.design = d.design
);
