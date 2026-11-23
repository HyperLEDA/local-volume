-- Milestone 02 read-only schema and provenance inventory.
-- Run only against an approved, read-only PostgreSQL connection.
-- This is an audit, not a migration or an updater.
SELECT table_schema, table_name, ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'lv'
  AND table_name IN ('groups', 'group_members', 'objects', 'observed', 'physical', 'physical_refresh_state')
ORDER BY table_name, ordinal_position;

SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.conrelid IN ('lv.groups'::regclass, 'lv.group_members'::regclass)
ORDER BY con.conrelid::regclass::text, con.conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'lv' AND tablename IN ('groups', 'group_members')
ORDER BY tablename, indexname;

SELECT definition, data_status, source_catalog, source_version, COUNT(*) AS groups
FROM lv.groups
GROUP BY definition, data_status, source_catalog, source_version
ORDER BY definition, source_catalog, source_version;

SELECT root_pgc, COUNT(*) AS published_definitions,
       ARRAY_AGG(group_id ORDER BY group_id) AS group_ids
FROM lv.groups
WHERE definition = 'published'
GROUP BY root_pgc
HAVING COUNT(*) > 1
ORDER BY published_definitions DESC, root_pgc;

SELECT membership_status, source_status, COUNT(*) AS members
FROM lv.group_members
GROUP BY membership_status, source_status
ORDER BY membership_status, source_status;

SELECT distance_method, COUNT(*) AS galaxies,
       COUNT(*) FILTER (WHERE dist IS NOT NULL AND dist > 0) AS positive_distances,
       COUNT(*) FILTER (WHERE distance_reference IS NOT NULL) AS with_reference
FROM lv.observed
GROUP BY distance_method
ORDER BY galaxies DESC, distance_method;

SELECT source_revision, applied_revision, formula_version
FROM lv.physical_refresh_state
WHERE singleton IS TRUE;
