import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { groupPopupRoute } from "../src/lib/groupBrowsing.ts";

const members = [{ pgc: 100 }, { pgc: 900 }, { pgc: 400 }];

describe("Group Aladin popup navigation", () => {
  test("passes a real member to the group's context saver", () => {
    const opened: number[] = [];
    const route = groupPopupRoute("/object/900", members, (pgc) => {
      opened.push(pgc);
      return `/object/${pgc}?nav=group-context`;
    });
    expect(route).toBe("/object/900?nav=group-context");
    expect(opened).toEqual([900]);
  });

  test("keeps unrelated galaxy and invalid URLs independent", () => {
    const opened: number[] = [];
    for (const route of [
      "/object/901",
      "/object/0009",
      "/objects/100",
      "/object/-1",
      "/object/100?extra=x",
    ]) {
      expect(
        groupPopupRoute(route, members, (pgc) => {
          opened.push(pgc);
          return `/object/${pgc}?nav=group-context`;
        }),
      ).toBe(route);
    }
    expect(opened).toEqual([]);
  });

  test("retains the original route when no context is available", () => {
    expect(groupPopupRoute("/object/100", members)).toBe("/object/100");
    expect(groupPopupRoute("/object/400", members, () => null)).toBe(
      "/object/400",
    );
  });

  test("the group sky map and member list both pass selection context", () => {
    const skyMap = readFileSync(
      new URL("../src/components/GroupSkyMap.tsx", import.meta.url),
      "utf8",
    );
    const groupPage = readFileSync(
      new URL("../src/pages/GroupPage.tsx", import.meta.url),
      "utf8",
    );
    expect(skyMap).toContain("groupPopupRoute(");
    expect(groupPage).toContain("onMemberNavigate={(pgc)");
    expect(groupPage).toContain("saveGroupNavigation()");
    expect(groupPage).toContain("group.members.map");
  });
});
