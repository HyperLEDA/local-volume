import { describe, expect, test } from "bun:test";
import { fetchObjects, SPATIAL_DISTANCE_CONTRACT } from "../src/api/objects.ts";

const originalFetch = globalThis.fetch;
const data = {
  pgc: [12, 34],
  name: ["A", "B"],
  ra: [1, 2],
  dec: [3, 4],
  dist: [4, null],
  names: [[], []],
};
const review = {
  distance_provenance_verified: false,
  distance_3d_eligible: false,
  distance_interval_traceable: false,
  distance_interval_verified: false,
  distance_value_review_status: "NOT_REVIEWED",
  distance_interval_review_status: "NOT_REVIEWED",
};
const spatial = [
  {
    ...review,
    pgc: 12,
    dist_mpc: 4.2,
    distance_origin: "DIRECT_MEASURED",
    distance_lineage_status: "REVIEW_READY",
    distance_lineage_reason: "source_row_review_required",
  },
  {
    ...review,
    pgc: 34,
    distance_origin: "UNKNOWN",
    distance_lineage_status: "HOLD",
    distance_lineage_reason: "missing_or_invalid_distance",
  },
];
function mock(payload: unknown) {
  globalThis.fetch = () => Promise.resolve(Response.json(payload));
}

describe("additive Atlas distance contract", () => {
  test("legacy distance and order survive while audited data stays separate", async () => {
    mock({
      data,
      distance_contract: SPATIAL_DISTANCE_CONTRACT,
      spatial_distances: spatial,
    });
    try {
      const [first, second] = await Promise.all([
        fetchObjects(),
        fetchObjects(),
      ]);
      expect(first.map((x) => x.pgc)).toEqual([12, 34]);
      expect(first[0].dist).toBe(4);
      expect(first[0].spatial_distance?.dist_mpc).toBe(4.2);
      expect(first[0].spatial_distance?.distance_3d_eligible).toBe(false);
      expect(first[0].spatial_distance).not.toBe(second[0].spatial_distance);
      expect(first[1].dist).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
  test("old, unknown-version, reordered or partial payload fails closed for spatial only", async () => {
    async function check(payload: unknown) {
      mock(payload);
      const rows = await fetchObjects();
      expect(rows.map((x) => x.spatial_distance)).toEqual([null, null]);
      expect(rows[0].dist).toBe(4);
    }

    try {
      await check({ data });
      await check({
        data,
        distance_contract: "future",
        spatial_distances: spatial,
      });
      await check({
        data,
        distance_contract: SPATIAL_DISTANCE_CONTRACT,
        spatial_distances: [...spatial].reverse(),
      });
      await check({
        data,
        distance_contract: SPATIAL_DISTANCE_CONTRACT,
        spatial_distances: spatial.slice(0, 1),
      });
      await check({
        data,
        distance_contract: SPATIAL_DISTANCE_CONTRACT,
        spatial_distances: [
          { ...spatial[0], distance_3d_eligible: true },
          spatial[1],
        ],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
