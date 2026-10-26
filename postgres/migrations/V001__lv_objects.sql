/* pgmigrate-encoding: utf-8 */
CREATE SCHEMA IF NOT EXISTS lv;

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
