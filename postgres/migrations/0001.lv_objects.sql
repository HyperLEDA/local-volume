-- depends:

CREATE SCHEMA IF NOT EXISTS meta;
COMMENT ON SCHEMA meta IS 'Some views and functions for convenient metadata management';

CREATE OR REPLACE VIEW meta.column_info AS
SELECT
  n.nspname::text AS schema_name,
  c.relname::text AS table_name,
  a.attname::text AS column_name,
  CASE
    WHEN d.description IS JSON THEN d.description::json
    ELSE json_build_object('description', d.description)
  END AS param
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_class c
  ON c.relnamespace = n.oid
 AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
JOIN pg_catalog.pg_attribute a
  ON a.attrelid = c.oid
 AND a.attnum > 0
 AND NOT a.attisdropped
LEFT JOIN pg_catalog.pg_description d
  ON d.objoid = c.oid
 AND d.objsubid = a.attnum
 AND d.classoid = 'pg_catalog.pg_class'::regclass
WHERE n.nspname <> 'pg_catalog'
  AND n.nspname <> 'information_schema'
  AND n.nspname !~ 'pg_toast'
;

COMMENT ON VIEW meta.column_info IS 'Column Metadata';
COMMENT ON COLUMN meta.column_info.schema_name IS 'Schema name';
COMMENT ON COLUMN meta.column_info.table_name IS 'Table name';
COMMENT ON COLUMN meta.column_info.column_name IS 'Column name';
COMMENT ON COLUMN meta.column_info.param IS 'Metadata in JSON format';

CREATE OR REPLACE VIEW meta.table_info AS
SELECT
  n.nspname::text AS schema_name,
  c.relname::text AS table_name,
  CASE
    WHEN d.description IS JSON THEN d.description::json
    ELSE json_build_object('description', d.description)
  END AS param
FROM pg_catalog.pg_namespace n
JOIN pg_catalog.pg_class c
  ON c.relnamespace = n.oid
 AND c.relkind IN ('r', 'v', 'm', 'f', 'p')
LEFT JOIN pg_catalog.pg_description d
  ON d.objoid = c.oid
 AND d.objsubid = 0
 AND d.classoid = 'pg_catalog.pg_class'::regclass
WHERE n.nspname <> 'pg_catalog'
  AND n.nspname <> 'information_schema'
  AND n.nspname !~ 'pg_toast'
;

COMMENT ON VIEW meta.table_info IS 'Table Metadata';
COMMENT ON COLUMN meta.table_info.schema_name IS 'Schema name';
COMMENT ON COLUMN meta.table_info.table_name IS 'Table name';
COMMENT ON COLUMN meta.table_info.param IS 'Metadata in JSON format';

CREATE OR REPLACE VIEW meta.schema_info AS
SELECT
  n.nspname::text AS schema_name,
  CASE
    WHEN d.description IS JSON THEN d.description::json
    ELSE json_build_object('description', d.description)
  END AS param
FROM pg_catalog.pg_namespace n
LEFT JOIN pg_catalog.pg_description d
  ON d.objoid = n.oid
 AND d.objsubid = 0
 AND d.classoid = 'pg_catalog.pg_namespace'::regclass
WHERE n.nspname <> 'pg_catalog'
  AND n.nspname <> 'information_schema'
  AND n.nspname !~ 'pg_toast'
;

COMMENT ON VIEW meta.schema_info IS 'Schema Metadata';
COMMENT ON COLUMN meta.schema_info.schema_name IS 'Schema name';
COMMENT ON COLUMN meta.schema_info.param IS 'Metadata in JSON format';

CREATE OR REPLACE FUNCTION
  meta.setparams(schema_name text, table_name text, column_name text, param json)
RETURNS void
AS $$
  DECLARE
    str_comment text := param::text;
  BEGIN
    EXECUTE format('COMMENT ON COLUMN %I.%I.%I IS %L', schema_name, table_name, column_name, str_comment);
  END;
$$ LANGUAGE plpgsql COST 100 VOLATILE STRICT PARALLEL UNSAFE;

CREATE OR REPLACE FUNCTION
  meta.setparams(schema_name text, table_name text, param json)
RETURNS void
AS $$
  DECLARE
    str_comment text := param::text;
    TabType char;
  BEGIN
    SELECT c.relkind INTO TabType
    FROM
      pg_catalog.pg_class AS c
      LEFT JOIN pg_catalog.pg_namespace AS n ON (n.oid = c.relnamespace)
    WHERE
          n.nspname = schema_name
      AND c.relname = table_name
    ;

    CASE WHEN TabType = 'r' THEN EXECUTE format('COMMENT ON TABLE %I.%I IS %L', schema_name, table_name, str_comment);
         WHEN TabType = 'v' THEN EXECUTE format('COMMENT ON VIEW %I.%I IS %L', schema_name, table_name, str_comment);
         WHEN TabType = 'm' THEN EXECUTE format('COMMENT ON MATERIALIZED VIEW %I.%I IS %L', schema_name, table_name, str_comment);
    ELSE
    END CASE;
  END;
$$ LANGUAGE plpgsql COST 100 VOLATILE STRICT PARALLEL UNSAFE;

CREATE OR REPLACE FUNCTION
  meta.setparams(schema_name text, param json)
RETURNS void
AS $$
  DECLARE
    str_comment text := param::text;
  BEGIN
    EXECUTE format('COMMENT ON SCHEMA %I IS %L', schema_name, str_comment);
  END;
$$ LANGUAGE plpgsql COST 100 VOLATILE STRICT PARALLEL UNSAFE;

CREATE OR REPLACE FUNCTION meta.setparams(
  p_schema text,
  p_table text,
  p_column text,
  p_key text,
  p_value text
)
RETURNS void
AS $$
DECLARE
  tab_oid oid;
  col_ord int;
  current_comment text;
  new_param jsonb;
BEGIN
  tab_oid := (quote_ident(p_schema) || '.' || quote_ident(p_table))::regclass;
  SELECT c.ordinal_position INTO col_ord
  FROM information_schema.columns c
  WHERE c.table_schema = p_schema
    AND c.table_name = p_table
    AND c.column_name = p_column;
  IF col_ord IS NULL THEN
    RAISE EXCEPTION 'column %.%.% does not exist', p_schema, p_table, p_column;
  END IF;

  current_comment := pg_catalog.col_description(tab_oid, col_ord);
  IF current_comment IS NULL THEN
    new_param := '{}'::jsonb;
  ELSIF current_comment ~ '^\s*\{' THEN
    BEGIN
      new_param := current_comment::jsonb;
    EXCEPTION WHEN OTHERS THEN
      new_param := jsonb_build_object('description', current_comment);
    END;
  ELSE
    new_param := jsonb_build_object('description', current_comment);
  END IF;
  new_param := new_param || jsonb_build_object(p_key, p_value);

  EXECUTE format(
    'COMMENT ON COLUMN %I.%I.%I IS %L',
    p_schema, p_table, p_column,
    new_param::text
  );
END;
$$ LANGUAGE plpgsql COST 100 VOLATILE STRICT PARALLEL UNSAFE;

CREATE SCHEMA IF NOT EXISTS lv;
SELECT meta.setparams('lv', '{"description": "Local Volume catalog"}');

CREATE TABLE lv.objects (
    pgc integer PRIMARY KEY,
    name text NOT NULL,
    ra double precision,
    e_ra real,
    dec double precision,
    e_dec real,
    cz double precision,
    e_cz real,
    type_name text
);

SELECT meta.setparams('lv', 'objects', '{"description": "Summary of information about Local Volume objects"}');
SELECT meta.setparams('lv', 'objects', 'pgc', '{"description": "PGC identifier", "ucd": "meta.id;meta.main"}');
SELECT meta.setparams('lv', 'objects', 'name', '{"description": "Main designation", "ucd": "meta.id"}');
SELECT meta.setparams('lv', 'objects', 'ra', '{"description": "Right ascension (ICRS)", "unit": "deg", "ucd": "pos.eq.ra;meta.main"}');
SELECT meta.setparams('lv', 'objects', 'e_ra', '{"description": "Right ascension error", "unit": "deg", "ucd": "stat.error;pos.eq.ra"}');
SELECT meta.setparams('lv', 'objects', 'dec', '{"description": "Declination (ICRS)", "unit": "deg", "ucd": "pos.eq.dec;meta.main"}');
SELECT meta.setparams('lv', 'objects', 'e_dec', '{"description": "Declination error", "unit": "deg", "ucd": "stat.error;pos.eq.dec"}');
SELECT meta.setparams('lv', 'objects', 'cz', '{"description": "Heliocentric redshift (cz)", "unit": "km/s"}');
SELECT meta.setparams('lv', 'objects', 'e_cz', '{"description": "Redshift measurement error", "unit": "km/s"}');
SELECT meta.setparams('lv', 'objects', 'type_name', '{"description": "Object type code", "ucd": "src.class"}');

CREATE TABLE lv.names (
    pgc integer NOT NULL REFERENCES lv.objects (pgc),
    name text NOT NULL,
    PRIMARY KEY (pgc, name)
);

SELECT meta.setparams('lv', 'names', '{"description": "Additional names for Local Volume objects"}');
SELECT meta.setparams('lv', 'names', 'pgc', '{"description": "PGC identifier", "ucd": "meta.id"}');
SELECT meta.setparams('lv', 'names', 'name', '{"description": "Additional name", "ucd": "meta.id"}');
