import { expect, test } from "bun:test";
import {
  buildGroupScene,
  type SceneGroup,
  type SceneMember,
} from "../src/lib/groupScene3d.ts";
import { groupCenteredKpc } from "../src/lib/groupGeometry3d.ts";

function member(pgc: number, changes: Partial<SceneMember> = {}): SceneMember {
  return {
    group_id: -1,
    pgc,
    name: `PGC ${pgc}`,
    parent_md_pgc: pgc === 1 ? null : 1,
    membership_status: pgc === 1 ? "root" : "computed",
    ra: 0,
    dec: 0,
    dist_mpc: 4,
    distance_origin: "DIRECT_MEASURED",
    distance_method_for_value: "TRGB",
    distance_reference_for_value: "source",
    distance_lineage_status: "REVIEW_READY",
    distance_value_review_status: "NOT_REVIEWED",
    distance_interval_review_status: "NOT_REVIEWED",
    distance_provenance_verified: false,
    distance_3d_eligible: false,
    distance_interval_traceable: true,
    distance_interval_verified: false,
    e_distance_minus_mpc: 0.2,
    e_distance_plus_mpc: 0.3,
    morphology_t: -3,
    abs_b_mag: -12,
    ...changes,
  };
}

function group(...members: SceneMember[]): SceneGroup {
  return { group_id: -1, root_pgc: 1, definition: "physical", members };
}

const verified = {
  distance_value_review_status: "VERIFIED" as const,
  distance_interval_review_status: "VERIFIED" as const,
  distance_3d_eligible: true,
  distance_provenance_verified: true,
  distance_interval_verified: true,
};

function checkVec(
  actual: readonly number[] | null,
  expected: readonly number[],
) {
  expect(actual).not.toBeNull();
  expected.forEach((value, i) => expect(actual![i]).toBeCloseTo(value, 8));
}

test("adopted catalogue distance unlocks display, not strict science", () => {
  const scene = buildGroupScene(group(member(1), member(2, { dist_mpc: 5 })));
  expect(scene.status).toBe("READY");
  expect(scene.centre?.strictGeometryEligible).toBe(false);
  checkVec(scene.points[0].displayPositionKpc, [0, 0, 0]);
  checkVec(scene.points[1].displayPositionKpc, [0, 0, 1000]);
  expect(scene.points[1].kind).toBe("INDIVIDUAL_ADOPTED");
  expect(scene.points[1].strictGeometryEligible).toBe(false);
});

test("east north outward LOS matches existing exact spherical geometry across RA wrap and poles", () => {
  for (const [ra, dec, ra2, dec2] of [
    [359, 15, 2, 16],
    [135, 89.5, 335, 88.7],
    [42, -36, 230, 80],
    [0, 0, 90, 0],
  ]) {
    const scene = buildGroupScene(
      group(
        member(1, { ra, dec }),
        member(2, { ra: ra2, dec: dec2, dist_mpc: 5 }),
      ),
    );
    const expected = groupCenteredKpc(
      { ra, dec, distanceMpc: 4, distanceOrigin: "DIRECT_MEASURED" },
      { ra: ra2, dec: dec2, distanceMpc: 5, distanceOrigin: "DIRECT_MEASURED" },
    );
    expect(expected).not.toBeNull();
    checkVec(scene.points[1].displayPositionKpc, expected!);
    const psiDot =
      Math.cos((dec * Math.PI) / 180) *
        Math.cos((dec2 * Math.PI) / 180) *
        Math.cos(((ra - ra2) * Math.PI) / 180) +
      Math.sin((dec * Math.PI) / 180) * Math.sin((dec2 * Math.PI) / 180);
    expect(Math.hypot(...scene.points[1].displayPositionKpc!)).toBeCloseTo(
      1000 * Math.sqrt(4 * 4 + 5 * 5 - 2 * 4 * 5 * psiDot),
      8,
    );
  }
});

test("assigned distance does not create observed depth even when its adopted value differs", () => {
  const scene = buildGroupScene(
    group(
      member(1),
      member(2, {
        ra: 30,
        dist_mpc: 19,
        distance_origin: "GROUP_ASSIGNED",
        ...verified,
      }),
    ),
  );
  const p = scene.points[1];
  expect(p.kind).toBe("ASSIGNED_PROJECTION");
  checkVec(p.displayPositionKpc, [2000, 0, 0]);
  expect(p.adoptedDistanceMpc).toBe(19);
  expect(p.interval).toBeNull();
  expect(p.strictGeometryEligible).toBe(false);
});

test("rear hemisphere assigned objects remain direction-only", () => {
  const scene = buildGroupScene(
    group(
      member(1),
      member(2, {
        ra: 180,
        distance_origin: "GROUP_ASSIGNED",
      }),
    ),
  );
  expect(scene.points[1].kind).toBe("DIRECTION_ONLY");
  expect(scene.points[1].displayPositionKpc).toBeNull();
  checkVec(scene.points[1].direction, [0, 0, -1]);
});

test("model and unclassified estimates retain adopted D and never acquire strict eligibility", () => {
  const scene = buildGroupScene(
    group(
      member(1, verified),
      member(2, {
        dist_mpc: 6,
        distance_origin: "MODEL_INFERRED",
        ...verified,
      }),
      member(3, { dist_mpc: 3, distance_origin: "UNKNOWN", ...verified }),
    ),
  );
  expect(scene.points[1].kind).toBe("MODEL_ESTIMATE");
  expect(scene.points[2].kind).toBe("UNCLASSIFIED_ESTIMATE");
  checkVec(scene.points[1].displayPositionKpc, [0, 0, 2000]);
  checkVec(scene.points[2].displayPositionKpc, [0, 0, -1000]);
  for (const p of scene.points.slice(1)) {
    expect(p.strictGeometryEligible).toBe(false);
    expect(p.interval).toBeNull();
  }
});

test("missing and invalid distances keep ICRS directions, not false positions", () => {
  const scene = buildGroupScene(
    group(
      member(1),
      member(2, { dist_mpc: null }),
      member(3, { dist_mpc: 0 }),
      member(4, { dist_mpc: Infinity }),
      member(5, { ra: null }),
      member(6, { dec: 91 }),
      member(5064336),
    ),
  );
  expect(scene.points.map((p) => p.kind)).toEqual([
    "INDIVIDUAL_ADOPTED",
    "DIRECTION_ONLY",
    "DIRECTION_ONLY",
    "DIRECTION_ONLY",
    "UNAVAILABLE",
    "UNAVAILABLE",
    "DIRECTION_ONLY",
  ]);
  expect(
    scene.points.slice(1).every((p) => p.displayPositionKpc === null),
  ).toBe(true);
  expect(scene.points[1].icrsDirection).not.toBeNull();
});

test("centre may be adopted but unverified, never silently substituted", () => {
  const scene = buildGroupScene(
    group(
      member(1, { distance_origin: "MODEL_INFERRED" }),
      member(2, verified),
    ),
  );
  expect(scene.status).toBe("READY");
  expect(scene.centre?.origin).toBe("MODEL_INFERRED");
  expect(scene.points[1].strictGeometryEligible).toBe(false);
  const blocked = buildGroupScene(
    group(member(1, { dist_mpc: null }), member(2, verified)),
  );
  expect(blocked.status).toBe("CENTRE_UNAVAILABLE");
  expect(blocked.centre).toBeNull();
  expect(blocked.points).toHaveLength(2);
  expect(blocked.points[1].icrsDirection).not.toBeNull();
  expect(blocked.points[1].displayPositionKpc).toBeNull();
});

test("member and centre must both pass the old review gate; candidates are not accepted", () => {
  const scene = buildGroupScene(
    group(
      member(1, verified),
      member(2, verified),
      member(3, { ...verified, membership_status: "unconfirmed" }),
      member(4, { ...verified, distance_value_review_status: "STALE" }),
    ),
  );
  expect(scene.points.map((p) => p.strictGeometryEligible)).toEqual([
    true,
    true,
    false,
    false,
  ]);
  expect(scene.points[2].acceptedMember).toBe(false);
  expect(scene.points[2].interval).toBeNull();
  expect(scene.points[2].displayPositionKpc).not.toBeNull();
});

test("asymmetric intervals follow each member's own observer ray, not centre LOS", () => {
  const scene = buildGroupScene(group(member(1), member(2, { ra: 90 })));
  const p = scene.points[1];
  expect(p.interval?.quality).toBe("CATALOGUE_UNREVIEWED");
  checkVec(p.displayPositionKpc, [4000, 0, -4000]);
  checkVec(p.interval!.lowerKpc, [3800, 0, -4000]);
  checkVec(p.interval!.upperKpc, [4300, 0, -4000]);
  expect(scene.displayExtentKpc).toBeCloseTo(Math.hypot(4000, 4000), 8);
});

test("known problematic, untraceable, nonpositive lower and missing intervals are suppressed", () => {
  const scene = buildGroupScene(
    group(
      member(1, verified),
      member(2, verified),
      member(3, { ...verified, distance_interval_review_status: "HOLD" }),
      member(4, { distance_interval_review_status: "STALE" }),
      member(5, { distance_interval_traceable: false }),
      member(6, { e_distance_minus_mpc: 4 }),
      member(7, { e_distance_plus_mpc: null }),
      member(8, {
        distance_interval_review_status: "VERIFIED",
        distance_interval_verified: false,
      }),
      member(9, { distance_interval_review_status: "BLOCKED" }),
      member(10, { distance_interval_review_status: "UNAVAILABLE" }),
    ),
  );
  expect(scene.points[1].interval?.quality).toBe("VERIFIED");
  expect(scene.points.slice(2).every((p) => p.interval === null)).toBe(true);
  expect(scene.points.every((p) => p.displayPositionKpc !== null)).toBe(true);
});

test("invalid or duplicate membership cannot create a scene, but entries are preserved", () => {
  for (const input of [
    group(member(1), member(2), member(2)),
    group(member(1), member(2, { group_id: -6 })),
    group(member(2)),
    group(member(1), member(2, { membership_status: "root" })),
  ]) {
    const scene = buildGroupScene(input);
    expect(scene.status).toBe("INVALID_MEMBERSHIP");
    expect(scene.points).toHaveLength(input.members.length);
    expect(scene.points.every((p) => p.displayPositionKpc === null)).toBe(true);
  }
});

test("photometry, morphology and membership identity are retained without invented fallback values", () => {
  const input = group(
    member(1),
    member(2, { parent_md_pgc: 1, abs_b_mag: null, morphology_t: 0 }),
  );
  const before = JSON.stringify(input);
  const scene = buildGroupScene(input);
  expect(scene.points[1].absBMag).toBeNull();
  expect(scene.points[1].morphologyT).toBe(0);
  expect(scene.points[1].parentPgc).toBe(1);
  expect(JSON.stringify(input)).toBe(before);
  expect(scene.axes).toEqual(["east", "north", "outward_los"]);
  expect(scene.units).toBe("kpc");
});

test("MW centre uses full-sphere translated catalogue vectors, without projected assigned satellites", () => {
  const mw = 5064336;
  const centre = member(mw, {
    group_id: -mw,
    parent_md_pgc: null,
    membership_status: "root",
    dist_mpc: 0.008,
    distance_origin: "UNKNOWN",
  });
  const satellite = member(2, {
    group_id: -mw,
    parent_md_pgc: mw,
    ra: 180,
    dist_mpc: 0.05,
    e_distance_minus_mpc: null,
    e_distance_plus_mpc: null,
  });
  const assigned = member(3, {
    group_id: -mw,
    parent_md_pgc: mw,
    ra: 30,
    dist_mpc: 0.05,
    distance_origin: "GROUP_ASSIGNED",
  });
  const scene = buildGroupScene({
    group_id: -mw,
    root_pgc: mw,
    definition: "physical",
    members: [centre, satellite, assigned],
  });
  expect(scene.status).toBe("READY");
  checkVec(scene.points[0].displayPositionKpc, [0, 0, 0]);
  checkVec(scene.points[1].displayPositionKpc, [0, 0, -58]);
  expect(scene.points[2].displayPositionKpc).toBeNull();
  expect(scene.points[2].kind).toBe("DIRECTION_ONLY");
  expect(scene.points[1].strictGeometryEligible).toBe(false);
  expect(scene.displayExtentKpc).toBeCloseTo(58, 8);
  expect(
    buildGroupScene({
      group_id: -mw,
      root_pgc: mw,
      definition: "physical",
      members: [{ ...centre, distance_origin: "GROUP_ASSIGNED" }, satellite],
    }).status,
  ).toBe("CENTRE_UNAVAILABLE");
});
