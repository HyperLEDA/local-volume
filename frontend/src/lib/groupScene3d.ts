import type { GroupDetail, GroupMember } from "../api/groups.ts";
import {
  unitDirection,
  validDistance,
  type DistanceOrigin,
  type Vec3,
} from "./groupGeometry3d.ts";

export type SceneMember = Pick<
  GroupMember,
  | "group_id"
  | "pgc"
  | "name"
  | "parent_md_pgc"
  | "membership_status"
  | "ra"
  | "dec"
  | "dist_mpc"
  | "distance_origin"
  | "distance_method_for_value"
  | "distance_reference_for_value"
  | "distance_lineage_status"
  | "distance_lineage_reason"
  | "distance_provenance_verified"
  | "distance_3d_eligible"
  | "distance_interval_traceable"
  | "distance_interval_verified"
  | "distance_value_review_status"
  | "distance_interval_review_status"
  | "e_distance_minus_mpc"
  | "e_distance_plus_mpc"
  | "morphology_t"
  | "abs_b_mag"
>;

export type SceneGroup = Pick<
  GroupDetail,
  "group_id" | "root_pgc" | "definition"
> & { members: readonly SceneMember[] };

export type PositionKind =
  | "INDIVIDUAL_ADOPTED"
  | "ASSIGNED_PROJECTION"
  | "MODEL_ESTIMATE"
  | "UNCLASSIFIED_ESTIMATE"
  | "DIRECTION_ONLY"
  | "UNAVAILABLE";

export type SceneInterval = {
  lowerKpc: Vec3;
  upperKpc: Vec3;
  minusMpc: number;
  plusMpc: number;
  quality: "VERIFIED" | "CATALOGUE_UNREVIEWED";
};

export type ScenePoint = {
  pgc: number;
  name: string;
  parentPgc: number | null;
  membershipStatus: SceneMember["membership_status"];
  acceptedMember: boolean;
  origin: DistanceOrigin;
  method: string | null;
  reference: string | null;
  lineageReason: string | null;
  valueReview: SceneMember["distance_value_review_status"] | null;
  intervalReview: SceneMember["distance_interval_review_status"] | null;
  adoptedDistanceMpc: number | null;
  raDeg: number | null;
  decDeg: number | null;
  icrsDirection: Vec3 | null;
  morphologyT: number | null;
  absBMag: number | null;
  kind: PositionKind;
  // Never feed these display coordinates to pair separation/depth estimators.
  displayPositionKpc: Vec3 | null;
  // Observer-to-object unit direction in the centre's east/north/LOS basis.
  direction: Vec3 | null;
  interval: SceneInterval | null;
  // Retain the original strict review gate, additionally requiring an eligible centre.
  strictGeometryEligible: boolean;
};

export type SceneCentre = {
  pgc: number;
  name: string;
  distanceMpc: number;
  origin: DistanceOrigin;
  method: string | null;
  reference: string | null;
  lineageReason: string | null;
  valueReview: SceneMember["distance_value_review_status"] | null;
  strictGeometryEligible: boolean;
};

type Frame = { east: Vec3; north: Vec3; los: Vec3; distanceMpc: number };
export type GroupScene = {
  contract: "catalogue_scene_v1";
  groupId: number;
  rootPgc: number;
  definition: SceneGroup["definition"];
  status: "READY" | "CENTRE_UNAVAILABLE" | "INVALID_MEMBERSHIP";
  centre: SceneCentre | null;
  units: "kpc";
  axes: readonly ["east", "north", "outward_los"];
  points: ScenePoint[];
  // A camera framing quantity only, not a measured group/halo radius.
  displayExtentKpc: number | null;
};

const MILKY_WAY_PGC = 5064336;
const RAD = Math.PI / 180;
const axes = ["east", "north", "outward_los"] as const;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pgcValid(pgc: number): boolean {
  return Number.isSafeInteger(pgc) && pgc > 0;
}

function originOf(member: SceneMember): DistanceOrigin {
  const origin = member.distance_origin;
  return origin === "DIRECT_MEASURED" ||
    origin === "GROUP_ASSIGNED" ||
    origin === "MODEL_INFERRED"
    ? origin
    : "UNKNOWN";
}

function accepted(member: SceneMember): boolean {
  return ["root", "computed", "supported"].includes(member.membership_status);
}

function strict(member: SceneMember): boolean {
  return (
    accepted(member) &&
    originOf(member) === "DIRECT_MEASURED" &&
    member.distance_3d_eligible === true &&
    member.distance_provenance_verified === true &&
    member.distance_value_review_status === "VERIFIED"
  );
}

function skyDirection(member: SceneMember): Vec3 | null {
  return finite(member.ra) && finite(member.dec) ? unitDirection(member) : null;
}

function frameFor(member: SceneMember): Frame | null {
  const los = skyDirection(member);
  if (
    los === null ||
    member.ra === null ||
    member.dec === null ||
    !validDistance(member.dist_mpc) ||
    member.pgc === MILKY_WAY_PGC
  )
    return null;
  const a = (member.ra % 360) * RAD;
  const d = member.dec * RAD;
  return {
    east: [-Math.sin(a), Math.cos(a), 0],
    north: [
      -Math.sin(d) * Math.cos(a),
      -Math.sin(d) * Math.sin(a),
      Math.cos(d),
    ],
    los,
    distanceMpc: member.dist_mpc,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function localDirection(frame: Frame, direction: Vec3): Vec3 {
  return [
    dot(direction, frame.east),
    dot(direction, frame.north),
    dot(direction, frame.los),
  ];
}

function finiteVector(vector: Vec3): Vec3 | null {
  return vector.every(Number.isFinite) ? vector : null;
}

function cataloguePosition(
  frame: Frame,
  direction: Vec3,
  distanceMpc: number,
): Vec3 | null {
  return finiteVector([
    1000 * (distanceMpc * direction[0]),
    1000 * (distanceMpc * direction[1]),
    1000 * (distanceMpc * direction[2] - frame.distanceMpc),
  ]);
}

function projectedPosition(frame: Frame, direction: Vec3): Vec3 | null {
  // Orthographic sky projection at the adopted centre distance, NOT a
  // ray-plane intersection, physical depth or an inferred member distance.
  // Do not fold objects on the rear hemisphere into the foreground plane.
  return direction[2] > 0
    ? finiteVector([
        1000 * (frame.distanceMpc * direction[0]),
        1000 * (frame.distanceMpc * direction[1]),
        0,
      ])
    : null;
}

function intervalFor(
  member: SceneMember,
  frame: Frame,
  direction: Vec3,
  distanceMpc: number,
): SceneInterval | null {
  const review = member.distance_interval_review_status;
  const minus = member.e_distance_minus_mpc;
  const plus = member.e_distance_plus_mpc;
  // Unreviewed but exactly traceable catalogue intervals are displayable.
  // Known HOLD/STALE/BLOCKED/UNAVAILABLE intervals are never drawn.
  if (
    originOf(member) !== "DIRECT_MEASURED" ||
    !accepted(member) ||
    member.distance_lineage_status !== "REVIEW_READY" ||
    member.distance_interval_traceable !== true ||
    !finite(minus) ||
    !finite(plus) ||
    minus < 0 ||
    plus < 0 ||
    distanceMpc - minus <= 0 ||
    (review !== "VERIFIED" && review !== "NOT_REVIEWED")
  )
    return null;
  if (
    review === "VERIFIED" &&
    (member.distance_interval_verified !== true || !strict(member))
  )
    return null;
  const valueReview = member.distance_value_review_status;
  if (valueReview !== "VERIFIED" && valueReview !== "NOT_REVIEWED") return null;
  const lower = cataloguePosition(frame, direction, distanceMpc - minus);
  const upper = cataloguePosition(frame, direction, distanceMpc + plus);
  if (lower === null || upper === null) return null;
  return {
    lowerKpc: lower,
    upperKpc: upper,
    minusMpc: minus,
    plusMpc: plus,
    quality: review === "VERIFIED" ? "VERIFIED" : "CATALOGUE_UNREVIEWED",
  };
}

function buildPoint(
  member: SceneMember,
  frame: Frame | null,
  centre: SceneCentre | null,
): ScenePoint {
  const sky = skyDirection(member);
  const direction = frame && sky ? localDirection(frame, sky) : null;
  const origin = originOf(member);
  const distanceMpc = validDistance(member.dist_mpc) ? member.dist_mpc : null;
  let kind: PositionKind = sky === null ? "UNAVAILABLE" : "DIRECTION_ONLY";
  let position: Vec3 | null = null;
  let interval: SceneInterval | null = null;
  if (
    frame &&
    centre &&
    direction &&
    distanceMpc !== null &&
    member.pgc !== MILKY_WAY_PGC
  ) {
    if (origin === "GROUP_ASSIGNED") {
      position = projectedPosition(frame, direction);
      if (position !== null) kind = "ASSIGNED_PROJECTION";
    } else {
      position = cataloguePosition(frame, direction, distanceMpc);
      if (position !== null) {
        kind =
          origin === "DIRECT_MEASURED"
            ? "INDIVIDUAL_ADOPTED"
            : origin === "MODEL_INFERRED"
              ? "MODEL_ESTIMATE"
              : "UNCLASSIFIED_ESTIMATE";
        interval = intervalFor(member, frame, direction, distanceMpc);
      }
    }
    // The selected catalogue centre defines the origin exactly.
    if (member.pgc === centre.pgc && position !== null) position = [0, 0, 0];
  }
  return {
    pgc: member.pgc,
    name: member.name,
    parentPgc: pgcValid(member.parent_md_pgc ?? 0)
      ? member.parent_md_pgc
      : null,
    membershipStatus: member.membership_status,
    acceptedMember: accepted(member),
    origin,
    method: member.distance_method_for_value ?? null,
    reference: member.distance_reference_for_value ?? null,
    lineageReason: member.distance_lineage_reason ?? null,
    valueReview: member.distance_value_review_status ?? null,
    intervalReview: member.distance_interval_review_status ?? null,
    adoptedDistanceMpc: distanceMpc,
    raDeg: finite(member.ra) ? member.ra : null,
    decDeg: finite(member.dec) ? member.dec : null,
    icrsDirection: sky,
    morphologyT: finite(member.morphology_t) ? member.morphology_t : null,
    absBMag: finite(member.abs_b_mag) ? member.abs_b_mag : null,
    kind,
    displayPositionKpc: position,
    direction,
    interval,
    strictGeometryEligible:
      kind === "INDIVIDUAL_ADOPTED" &&
      centre?.strictGeometryEligible === true &&
      strict(member),
  };
}

export function buildGroupScene(group: SceneGroup): GroupScene {
  const ids = new Set(group.members.map((member) => member.pgc));
  const valid =
    Number.isSafeInteger(group.group_id) &&
    group.group_id !== 0 &&
    pgcValid(group.root_pgc) &&
    ["physical", "suite", "published"].includes(group.definition) &&
    ids.size === group.members.length &&
    group.members.every(
      (member) =>
        pgcValid(member.pgc) &&
        member.group_id === group.group_id &&
        ["root", "computed", "supported", "unconfirmed"].includes(
          member.membership_status,
        ),
    );
  const roots = group.members.filter(
    (member) => member.membership_status === "root",
  );
  const root =
    valid && roots.length === 1 && roots[0].pgc === group.root_pgc
      ? roots[0]
      : null;
  const frame = root ? frameFor(root) : null;
  const centre: SceneCentre | null =
    root && frame
      ? {
          pgc: root.pgc,
          name: root.name,
          distanceMpc: frame.distanceMpc,
          origin: originOf(root),
          method: root.distance_method_for_value ?? null,
          reference: root.distance_reference_for_value ?? null,
          lineageReason: root.distance_lineage_reason ?? null,
          valueReview: root.distance_value_review_status ?? null,
          strictGeometryEligible: strict(root),
        }
      : null;
  const points = group.members.map((member) =>
    buildPoint(member, frame, centre),
  );
  let extent: number | null = null;
  for (const point of points) {
    // Interval lengths are intentionally not allowed to change the camera scale.
    if (point.displayPositionKpc !== null) {
      const norm = Math.hypot(...point.displayPositionKpc);
      if (Number.isFinite(norm)) extent = Math.max(extent ?? 0, norm);
    }
  }
  return {
    contract: "catalogue_scene_v1",
    groupId: group.group_id,
    rootPgc: group.root_pgc,
    definition: group.definition,
    status:
      !valid || root === null
        ? "INVALID_MEMBERSHIP"
        : frame === null
          ? "CENTRE_UNAVAILABLE"
          : "READY",
    centre,
    units: "kpc",
    axes,
    points,
    displayExtentKpc: extent,
  };
}
