import { describe, expect, test } from "bun:test";
import {
  validateCollection,
  collectionNeighbors,
  validPgc,
} from "../src/lib/collectionNavigation.ts";
import { externalCatalogLinks } from "../src/lib/externalCatalogs.ts";

const atlas = {
  v: 1 as const,
  origin: "atlas" as const,
  label: "Atlas",
  returnTo: "/?atlas=%7B%22v%22%3A1%7D",
  pgcs: [31, 12, 900],
  scrollY: 1380,
  created: Date.now(),
};

describe("collection-specific navigation", () => {
  test("follows exact displayed order, with no wrapping or duplicate current object", () => {
    const context = validateCollection(atlas);
    expect(collectionNeighbors(context, 31)).toEqual({
      index: 0,
      previous: null,
      next: 12,
    });
    expect(collectionNeighbors(context, 12)).toEqual({
      index: 1,
      previous: 31,
      next: 900,
    });
    expect(collectionNeighbors(context, 900)).toEqual({
      index: 2,
      previous: 12,
      next: null,
    });
    expect(collectionNeighbors(context, 99)).toBeNull();
  });
  test("single and expired snapshot have safe boundaries", () => {
    expect(
      collectionNeighbors(validateCollection({ ...atlas, pgcs: [31] }), 31),
    ).toEqual({
      index: 0,
      previous: null,
      next: null,
    });
    expect(
      validateCollection({ ...atlas, created: Date.now() - 13 * 3600_000 }),
    ).toBeNull();
    expect(validateCollection({ ...atlas, pgcs: [] })).toBeNull();
    expect(validateCollection({ ...atlas, pgcs: [31, 31] })).toBeNull();
  });
  test("rejects external redirects, malformed groups, conflicting definitions and bad PGC", () => {
    expect(
      validateCollection({ ...atlas, returnTo: "https://evil.example/" }),
    ).toBeNull();
    expect(validateCollection({ ...atlas, returnTo: "/object/31" })).toBeNull();
    expect(validateCollection({ ...atlas, pgcs: [31, "12"] })).toBeNull();
    expect(validPgc(0)).toBe(false);
    expect(
      validateCollection({
        ...atlas,
        origin: "group",
        label: "M81 Group",
        returnTo: "/groups/123?definition=physical",
        group: { id: 7, rootPgc: 123, definition: "suite" },
      }),
    ).toBeNull();
    expect(
      validateCollection({
        ...atlas,
        origin: "group",
        label: "M81 Group",
        returnTo: "/groups/123?definition=suite",
        group: { id: 7, rootPgc: 123, definition: "suite" },
      }),
    ).not.toBeNull();
  });
  test("external services search identifier, not a claimed crossmatch", () => {
    expect(externalCatalogLinks(-1)).toBeNull();
    expect(externalCatalogLinks(29146)).toEqual([
      { name: "LEDA", url: "https://leda.sao.ru/object/29146" },
      {
        name: "NED",
        url: "https://ned.ipac.caltech.edu/byname?objname=PGC%2029146",
      },
      {
        name: "SIMBAD",
        url: "https://simbad.cds.unistra.fr/simbad/sim-id?Ident=PGC%2029146",
      },
    ]);
  });
});
