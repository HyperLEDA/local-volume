import type { AtlasSpatialPoint } from "./atlasSpatialScene.ts";
import type { Vec3 } from "./groupGeometry3d.ts";

export type AtlasIntervalMode = "off" | "selected" | "all";
export type AtlasDistanceInterval = {
  pgc: number;
  lower: Vec3;
  upper: Vec3;
  minusMpc: number;
  plusMpc: number;
  quality: "verified" | "catalogue";
};

/** Match Group Explorer's evidence gates, in the observer-centred frame (Mpc). */
export function atlasDistanceInterval(
  point: AtlasSpatialPoint,
): AtlasDistanceInterval | null {
  const e = point.evidence;
  if (
    !e ||
    e.pgc !== point.object.pgc ||
    point.kind !== "individual" ||
    e.distance_origin !== "DIRECT_MEASURED" ||
    e.distance_lineage_status !== "REVIEW_READY" ||
    e.distance_interval_traceable !== true
  )
    return null;
  const review = e.distance_interval_review_status;
  if (
    (review !== "VERIFIED" && review !== "NOT_REVIEWED") ||
    (e.distance_value_review_status !== "VERIFIED" &&
      e.distance_value_review_status !== "NOT_REVIEWED")
  )
    return null;
  if (
    review === "VERIFIED" &&
    (!point.verified || e.distance_interval_verified !== true)
  )
    return null;
  const d = e.dist_mpc,
    minus = e.e_distance_minus_mpc,
    plus = e.e_distance_plus_mpc;
  if (
    typeof d !== "number" ||
    !Number.isFinite(d) ||
    d <= 0 ||
    typeof minus !== "number" ||
    !Number.isFinite(minus) ||
    minus < 0 ||
    typeof plus !== "number" ||
    !Number.isFinite(plus) ||
    plus < 0 ||
    d - minus <= 0 ||
    !Number.isFinite(d + plus) ||
    (minus === 0 && plus === 0)
  )
    return null;
  if (
    !point.position.every(Number.isFinite) ||
    Math.abs(Math.hypot(...point.position) - d) > 1e-8 * Math.max(1, d)
  )
    return null;
  const lower: Vec3 = [
    (point.position[0] / d) * (d - minus),
    (point.position[1] / d) * (d - minus),
    (point.position[2] / d) * (d - minus),
  ];
  const upper: Vec3 = [
    (point.position[0] / d) * (d + plus),
    (point.position[1] / d) * (d + plus),
    (point.position[2] / d) * (d + plus),
  ];
  if (!lower.every(Number.isFinite) || !upper.every(Number.isFinite))
    return null;
  return {
    pgc: point.object.pgc,
    lower,
    upper,
    minusMpc: minus,
    plusMpc: plus,
    quality: review === "VERIFIED" ? "verified" : "catalogue",
  };
}

/** Only rendered field galaxies and group roots, never hidden group members. */
export function atlasDisplayedIntervals(
  points: readonly AtlasSpatialPoint[],
  displayed: ReadonlySet<number>,
): AtlasDistanceInterval[] {
  return points.flatMap((point) => {
    if (!displayed.has(point.object.pgc)) return [];
    const interval = atlasDistanceInterval(point);
    return interval ? [interval] : [];
  });
}
