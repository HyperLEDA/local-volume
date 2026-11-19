import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  groupBrowseNeighbors,
  groupListUrl,
  readGroupListState,
  validateGroupBrowse,
} from "../src/lib/groupBrowsing.ts";

function sample() {
  return {
    v: 1 as const,
    created: Date.now(),
    definition: "suite" as const,
    returnTo: "/groups?definition=suite&sort=name&q=Leo&limit=48",
    scrollY: 810,
    entries: [
      { groupId: 25, rootPgc: 800 },
      { groupId: 30, rootPgc: 100 },
      { groupId: 41, rootPgc: 700 },
    ],
  };
}

describe("Groups catalogue context and member traversal", () => {
  test("restores search, sort, definition and loaded count from the Groups URL", () => {
    const original = {
      definition: "suite" as const,
      sort: "name" as const,
      query: "Leo",
      limit: 48,
    };
    expect(
      readGroupListState(
        new URL(groupListUrl(original), "https://lv.test").search,
      ),
    ).toEqual(original);
    expect(
      readGroupListState("?definition=invalid&sort=invalid&limit=-1"),
    ).toEqual({
      definition: "physical",
      sort: "members",
      query: "",
      limit: 24,
    });
  });

  test("traverses the displayed group order without wrapping", () => {
    const snapshot = validateGroupBrowse(sample());
    expect(snapshot).not.toBeNull();
    expect(groupBrowseNeighbors(snapshot, 800, "suite")).toEqual({
      index: 0,
      previous: null,
      next: 100,
    });
    expect(groupBrowseNeighbors(snapshot, 100, "suite")).toEqual({
      index: 1,
      previous: 800,
      next: 700,
    });
    expect(groupBrowseNeighbors(snapshot, 700, "suite")).toEqual({
      index: 2,
      previous: 100,
      next: null,
    });
  });

  test("never mixes group definitions or guesses an unknown group", () => {
    const snapshot = validateGroupBrowse(sample());
    expect(groupBrowseNeighbors(snapshot, 100, "physical")).toBeNull();
    expect(groupBrowseNeighbors(snapshot, 999, "suite")).toBeNull();
    expect(
      validateGroupBrowse({
        ...sample(),
        returnTo: "https://elsewhere.example/groups",
      }),
    ).toBeNull();
    expect(
      validateGroupBrowse({ ...sample(), definition: "physical" }),
    ).toBeNull();
    expect(
      validateGroupBrowse({
        ...sample(),
        entries: [
          { groupId: 25, rootPgc: 800 },
          { groupId: 99, rootPgc: 800 },
        ],
      }),
    ).toBeNull();
    expect(
      validateGroupBrowse({
        ...sample(),
        created: Date.now() - 13 * 3600 * 1000,
      }),
    ).toBeNull();
  });

  test("group-member snapshot returns to the exact group definition and gallery token", () => {
    const src = readFileSync(
      new URL("../src/pages/GroupPage.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain('browseToken = searchParams.get("browse")');
    expect(src).toContain("returnTo: `/groups/");
    expect(src).toContain("browseToken ?");
    expect(src).toContain("group.group_id");
    expect(src).toContain("group.members.map");
  });
});
