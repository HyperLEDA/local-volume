-- depends: 0010.lv_physical_precomputed
-- Local pilot: new group entities only. No changes to objects, observed or physical.
DO $$
BEGIN
  IF to_regclass('lv.objects') IS NULL OR to_regclass('lv.physical') IS NULL
     OR to_regclass('lv.observed') IS NULL THEN
    RAISE EXCEPTION '0011 requires existing lv objects/observed/physical';
  END IF;
  IF to_regclass('lv.groups') IS NOT NULL OR to_regclass('lv.group_members') IS NOT NULL THEN
    RAISE EXCEPTION 'Existing groups schema detected; stop for manual review';
  END IF;
END $$;

CREATE TABLE lv.groups (
    group_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    root_pgc integer NOT NULL REFERENCES lv.objects (pgc) ON DELETE RESTRICT,
    definition text NOT NULL CHECK (definition IN ('physical', 'suite', 'published')),
    data_status text NOT NULL CHECK (data_status IN ('pilot', 'validated')),
    source_catalog text NOT NULL,
    source_version text NOT NULL,
    source_sha256 text CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[0-9a-f]{64}$'),
    source_description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (root_pgc, definition, source_catalog, source_version)
);

CREATE TABLE lv.group_members (
    group_id bigint NOT NULL REFERENCES lv.groups (group_id) ON DELETE CASCADE,
    member_pgc integer NOT NULL REFERENCES lv.objects (pgc) ON DELETE RESTRICT,
    parent_md_pgc integer REFERENCES lv.objects (pgc) ON DELETE RESTRICT,
    hierarchy_depth integer NOT NULL CHECK (hierarchy_depth BETWEEN 0 AND 100),
    membership_status text NOT NULL CHECK (membership_status IN ('root', 'supported', 'unconfirmed')),
    source_status text NOT NULL,
    theta1_source double precision,
    PRIMARY KEY (group_id, member_pgc),
    CONSTRAINT group_member_parent_not_self CHECK (parent_md_pgc IS NULL OR parent_md_pgc <> member_pgc),
    CONSTRAINT group_member_root_consistency CHECK (
        (hierarchy_depth = 0 AND parent_md_pgc IS NULL AND membership_status = 'root') OR
        (hierarchy_depth > 0 AND parent_md_pgc IS NOT NULL AND membership_status <> 'root')
    ),
    CONSTRAINT group_member_parent_same_group FOREIGN KEY (group_id, parent_md_pgc)
      REFERENCES lv.group_members (group_id, member_pgc) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX group_members_parent_idx ON lv.group_members (group_id, parent_md_pgc);

SELECT meta.setparams('lv', 'groups', '{"description":"Versioned group definitions anchored on resolved Main Disturber PGC. Physical, suite and published definitions remain distinct; pilot groups are not validated catalog memberships."}');
SELECT meta.setparams('lv', 'groups', 'root_pgc', '{"description":"Canonical PGC of the group root Main Disturber","ucd":"meta.id"}');
SELECT meta.setparams('lv', 'groups', 'definition', '{"description":"Group selection semantics: physical, suite, or published"}');
SELECT meta.setparams('lv', 'groups', 'data_status', '{"description":"Scientific review status of group membership: pilot or validated"}');
SELECT meta.setparams('lv', 'groups', 'source_catalog', '{"description":"Source lineage identifier for this definition"}');
SELECT meta.setparams('lv', 'groups', 'source_version', '{"description":"Immutable source version/snapshot identifier"}');
SELECT meta.setparams('lv', 'groups', 'source_sha256', '{"description":"Hash of the frozen original input when available"}');
SELECT meta.setparams('lv', 'group_members', '{"description":"Directed, versioned group membership. Each member points to its immediate parent MD; candidate status is explicit. No identity resolution is performed by this table."}');
SELECT meta.setparams('lv', 'group_members', 'member_pgc', '{"description":"Resolved canonical PGC of group member","ucd":"meta.id"}');
SELECT meta.setparams('lv', 'group_members', 'parent_md_pgc', '{"description":"Immediate parent Main Disturber PGC, null for root; not necessarily group root","ucd":"meta.id"}');
SELECT meta.setparams('lv', 'group_members', 'membership_status', '{"description":"Root, supported, or unconfirmed membership in the present source definition"}');
SELECT meta.setparams('lv', 'group_members', 'source_status', '{"description":"Original status string from versioned source; not a standardized measured quality flag"}');
SELECT meta.setparams('lv', 'group_members', 'theta1_source', '{"description":"Theta1 value copied from versioned membership source; distinct from live lv.physical.theta1"}');
