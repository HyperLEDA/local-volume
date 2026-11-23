import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { groupMembershipUrl, type GroupMembership } from "../src/api/groups.ts";
import { validateCollection } from "../src/lib/collectionNavigation.ts";

const membership: GroupMembership = {
  group_id: 27,
  root_pgc: 100,
  name: "Root",
  definition: "published",
  data_status: "validated",
  source_catalog: "ref",
  source_version: "2026",
  source_sha256: null,
  source_description: null,
  member_pgc: 101,
  parent_md_pgc: 100,
  membership_status: "supported",
  source_status: "published",
  hierarchy_depth: 1,
};

describe("#41/#42/#64 group membership routing", () => {
  test("preserves stable published identity rather than satellite or root alone", () => {
    expect(groupMembershipUrl(membership)).toBe(
      "/groups/100?definition=published&group_id=27",
    );
  });
  test("computed physical and suite identities stay definition-specific", () => {
    expect(
      groupMembershipUrl({
        ...membership,
        definition: "physical",
        group_id: -100,
      }),
    ).toBe("/groups/100?definition=physical");
    expect(
      groupMembershipUrl({
        ...membership,
        definition: "suite",
        group_id: -100,
      }),
    ).toBe("/groups/100?definition=suite");
  });
  test("invalid or contradictory membership cannot invent navigation", () => {
    expect(() =>
      groupMembershipUrl({ ...membership, group_id: -100 }),
    ).toThrow();
    expect(() =>
      groupMembershipUrl({ ...membership, definition: "suite", member_pgc: 0 }),
    ).toThrow();
  });
  test("collection navigation preserves legacy identities and validates published group_id", () => {
    const base = {
      v: 1 as const,
      created: Date.now(),
      origin: "group" as const,
      label: "Root Group",
      pgcs: [100, 101],
      scrollY: 0,
    };
    expect(
      validateCollection({
        ...base,
        returnTo: "/groups/100?definition=physical",
        group: { id: -100, rootPgc: 100, definition: "physical" },
      }),
    ).not.toBeNull();
    expect(
      validateCollection({
        ...base,
        returnTo: "/groups/100?definition=suite",
        group: { id: 7, rootPgc: 100, definition: "suite" },
      }),
    ).not.toBeNull();
    expect(
      validateCollection({
        ...base,
        returnTo: "/groups/100?definition=published&group_id=27",
        group: { id: 27, rootPgc: 100, definition: "published" },
      }),
    ).not.toBeNull();
    expect(
      validateCollection({
        ...base,
        returnTo: "/groups/100?definition=published&group_id=99",
        group: { id: 27, rootPgc: 100, definition: "published" },
      }),
    ).toBeNull();
  });
  test("object page integrates the member lookup without assuming a root", () => {
    const page = readFileSync(
      new URL("../src/pages/ObjectPage.tsx", import.meta.url),
      "utf8",
    );
    const links = readFileSync(
      new URL("../src/components/ObjectGroupLinks.tsx", import.meta.url),
      "utf8",
    );
    expect(page).toContain("<ObjectGroupLinks pgc={data.pgc} />");
    expect(links).toContain("groupMembershipUrl(group)");
    expect(links).not.toMatch(/\btitle\s*=/);
    expect(links).toContain('className="object-group-links"');
    expect(links).toContain('className="object-group-chip"');
    expect(links).toContain("DEFINITION_NAMES[group.definition]");
  });
});
