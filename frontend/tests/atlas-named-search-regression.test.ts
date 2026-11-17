import assert from "node:assert/strict";
import test from "node:test";
import { findAtlasNamedTarget } from "../src/lib/atlasNamedSearch.ts";

type Galaxy = {
  pgc: number;
  name: string;
  names: string[];
  ra: number | null;
  dec: number | null;
};

const galaxies: Galaxy[] = [
  { pgc: 10, name: "NGC 10", names: ["ESO 10", "Карлик 10"], ra: 0, dec: -90 },
  { pgc: 20, name: "NGC 20", names: ["ESO 20"], ra: 360, dec: 90 },
  { pgc: 30, name: "UGC 30", names: ["NGC 10 companion"], ra: 2, dec: 3 },
  { pgc: 40, name: "NGC 40", names: ["LEDA 40"], ra: null, dec: 0 },
  { pgc: 50, name: "PGC 50", names: ["ESO 50"], ra: 361, dec: 0 },
  { pgc: 60, name: "PGC 60", names: ["ESO 60"], ra: 25, dec: 91 },
];

test("exact matches take precedence over earlier and later partial matches", () => {
  assert.equal(findAtlasNamedTarget(galaxies, "nGc 10")?.pgc, 10);
  assert.equal(findAtlasNamedTarget(galaxies, "NGC 10 companion")?.pgc, 30);
  assert.equal(findAtlasNamedTarget(galaxies, "eso 20")?.pgc, 20);
  assert.equal(findAtlasNamedTarget(galaxies, "  КарЛИК 10 ")?.pgc, 10);
});

test("ambiguous exact and partial aliases never select arbitrarily", () => {
  const duplicate = [
    ...galaxies,
    { pgc: 70, name: "NGC 70", names: ["ESO 10"], ra: 70, dec: 0 },
  ];
  assert.equal(findAtlasNamedTarget(duplicate, "ESO 10"), null);
  assert.equal(findAtlasNamedTarget(galaxies, "NGC"), null);
  assert.equal(findAtlasNamedTarget(galaxies, "ESO"), null);
});

test("coordinate validation and number matching retain their current policy", () => {
  assert.equal(findAtlasNamedTarget(galaxies, "pgc 00020")?.pgc, 20);
  assert.equal(findAtlasNamedTarget(galaxies, "40"), null);
  assert.equal(findAtlasNamedTarget(galaxies, "PGC 50"), null);
  assert.equal(findAtlasNamedTarget(galaxies, "PGC 60"), null);
  assert.equal(findAtlasNamedTarget(galaxies, "  "), null);
  assert.equal(findAtlasNamedTarget(galaxies, "absent"), null);
});

test("source array and individual galaxy records are not mutated", () => {
  const before = structuredClone(galaxies);
  findAtlasNamedTarget(galaxies, "eso");
  findAtlasNamedTarget(galaxies, "20");
  assert.deepEqual(galaxies, before);
});

// Historic behavior is the compatibility oracle for this allocation-free rewrite.
function historicNamedSearch(
  objects: readonly Galaxy[],
  query: string,
): Galaxy | null {
  function normalize(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
  }
  const search = normalize(query);
  if (!search) return null;
  const positioned = objects.filter(
    (object) =>
      typeof object.ra === "number" &&
      Number.isFinite(object.ra) &&
      object.ra >= 0 &&
      object.ra <= 360 &&
      typeof object.dec === "number" &&
      Number.isFinite(object.dec) &&
      object.dec >= -90 &&
      object.dec <= 90,
  );
  const identifier = /^(?:pgc\s*)?0*(\d+)$/i.exec(search);
  const exact = positioned.filter(
    (object) =>
      (identifier !== null && object.pgc === Number(identifier[1])) ||
      normalize(object.name) === search ||
      object.names.some((name) => normalize(name) === search),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const partial = positioned.filter(
    (object) =>
      normalize(object.name).includes(search) ||
      String(object.pgc).includes(search) ||
      object.names.some((name) => normalize(name).includes(search)),
  );
  return partial.length === 1 ? partial[0] : null;
}

test("matches the original algorithm across deterministic generated catalogues", () => {
  let state = 0x12345678;
  function random(): number {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  const words = ["NGC", "UGC", "ESO", "PGC", "Карлик", "dwarf"];
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const sample: Galaxy[] = [];
    for (let i = 0; i < 24; i += 1) {
      const pgc = Math.floor(random() * 45);
      const word = words[Math.floor(random() * words.length)];
      const alias = words[Math.floor(random() * words.length)];
      const option = Math.floor(random() * 6);
      sample.push({
        pgc,
        name: `${word} ${pgc}`,
        names: [`${alias} ${Math.floor(random() * 45)}`],
        ra: [0, 360, 361, NaN, null, random() * 360][option],
        dec: [-90, 90, 91, NaN, null, random() * 180 - 90][option],
      });
    }
    for (const query of [
      "",
      "  ",
      "NGC",
      "pgc 0004",
      "Карлик",
      "ESO 4",
      "UGC",
      "0",
      "36",
      "dwarf 12",
      "not found",
    ]) {
      assert.equal(
        findAtlasNamedTarget(sample, query),
        historicNamedSearch(sample, query),
        `Failed for iteration ${iteration}, query ${JSON.stringify(query)}`,
      );
    }
  }
});
