import {
  makeSpatialSample,
  decodeSpatialSample,
  spatialSampleLabel,
} from "../src/lib/atlasSpatialSample.ts";
import { describe, expect, test } from "bun:test";
import {
  decodePopulation,
  defaultPopulation,
  matchesPopulation,
  populationCounts,
  populationFlags,
  populationMembership,
  populationPoints,
} from "../src/lib/atlasPopulation.ts";
const membership = populationMembership({
  catalogue_pgcs: [1, 2, 3],
  groups: [{ root_pgc: 1, member_pgcs: [1, 2] }],
});
const points = [
  { object: { pgc: 1, abs_b_mag: -20, theta1: 1, morphology_t: -2 } },
  { object: { pgc: 2, abs_b_mag: -17, theta1: 0, morphology_t: 0 } },
  { object: { pgc: 3, abs_b_mag: -14, theta1: -0.01, morphology_t: 8 } },
  { object: { pgc: 4, abs_b_mag: null, theta1: null, morphology_t: null } },
];
describe("Catalogue population filters", () => {
  test("dwarf boundary inclusive, tidal zero distinct, morphology zero distinct", () => {
    expect(populationFlags(points[1].object, membership)).toEqual({
      dwarf: true,
      root: false,
      member: true,
      field: false,
      negativeTheta: false,
      early: false,
      transition: true,
      late: false,
    });
  });
  test("root overlaps member; field is covered and outside membership", () => {
    expect(populationCounts(points, membership)).toEqual({
      dwarf: 2,
      root: 1,
      member: 2,
      field: 1,
      negativeTheta: 1,
      early: 1,
      transition: 1,
      late: 1,
    });
  });
  test("missing values and uncovered membership never become positive classifications", () => {
    expect(
      Object.values(populationFlags(points[3].object, membership)).some(
        Boolean,
      ),
    ).toBe(false);
    expect(
      matchesPopulation(points[2].object, populationMembership(null), {
        ids: ["field"],
        mode: "any",
      }),
    ).toBe(false);
  });
  test("union and intersection retain unique original points and stable order", () => {
    expect(
      populationPoints(points, membership, {
        ids: ["dwarf", "member"],
        mode: "any",
      }).map((p) => p.object.pgc),
    ).toEqual([1, 2, 3]);
    expect(
      populationPoints(points, membership, {
        ids: ["dwarf", "member"],
        mode: "all",
      }).map((p) => p.object.pgc),
    ).toEqual([2]);
  });
  test("no filter preserves input and null or invalid stored filter fails validation", () => {
    expect(populationPoints(points, membership, defaultPopulation())).toBe(
      points,
    );
    expect(
      decodePopulation({ ids: ["field", "field"], mode: "any" }),
    ).toBeNull();
    expect(decodePopulation({ ids: ["bogus"], mode: "any" })).toBeNull();
    expect(decodePopulation({ ids: ["late", "dwarf"], mode: "all" })).toEqual({
      ids: ["dwarf", "late"],
      mode: "all",
    });
  });
  test("contradictory intersection is empty, not an unfiltered sample", () => {
    expect(
      populationPoints(points, membership, {
        ids: ["member", "field"],
        mode: "all",
      }),
    ).toEqual([]);
  });
});

test("population-only samples preserve criteria and reject unknown policy", () => {
  const sample = makeSpatialSample([1, 2], null, null, "individual", true, {
    ids: ["member"],
    mode: "all",
  });
  expect(sample?.population).toEqual({
    ids: ["member"],
    mode: "all",
    policy: "catalogue_population_v1",
    dwarfAbsoluteBLimit: -17,
  });
  expect(spatialSampleLabel(sample!)).toBe("Populations");
  expect(
    decodeSpatialSample({
      ...sample,
      population: { ...sample?.population, policy: "unknown" },
    }),
  ).toBeNull();
});
