/* Milestone 02 / Stage 03d: immutable sky-anchored subgroup footprints.
 * A subgroup's boundary is computed ONCE in a canonical orthographic plane.
 * Aladin projects its celestial polygons during its own rendering cycle.
 * This is a catalogue-membership illustration, never a physical boundary.
 */
import type { GroupDetail } from "../api/groups.ts";
import { groupSubgroups } from "./groupSubgroups.ts";
import {
  buildSubgroupRegion,
  type PixelGalaxy,
} from "./groupSubgroupRegion.ts";

const DEG = Math.PI / 180;
const SIZE = 800;
const CENTER = SIZE / 2;
const CANONICAL_RADIUS = 260;
const MAX_SKY_VERTICES = 1200;

type SkyPoint = readonly [number, number];
type Ortho = { east: number; north: number; visible: boolean };

type Basis = {
  center: readonly [number, number, number];
  east: readonly [number, number, number];
  north: readonly [number, number, number];
};

export type CelestialSubgroup = {
  pgc: number;
  name: string;
  memberPgcs: number[];
  polygons: SkyPoint[][];
  containsSky: (ra: number, dec: number) => boolean;
};

function basis(ra: number, dec: number): Basis {
  const alpha = ra * DEG;
  const delta = dec * DEG;
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);
  const cd = Math.cos(delta);
  const sd = Math.sin(delta);
  return {
    center: [cd * ca, cd * sa, sd],
    east: [-sa, ca, 0],
    north: [-sd * ca, -sd * sa, cd],
  };
}

function dot(a: readonly number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function unit(ra: number, dec: number): readonly [number, number, number] {
  const a = ra * DEG;
  const d = dec * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}
function project(ra: number, dec: number, b: Basis): Ortho {
  const u = unit(ra, dec);
  return {
    east: dot(u, b.east),
    north: dot(u, b.north),
    visible: dot(u, b.center) > 0,
  };
}
function inverse(
  x: number,
  y: number,
  b: Basis,
  scale: number,
): SkyPoint | null {
  const east = (x - CENTER) / scale;
  const north = (CENTER - y) / scale;
  const radius2 = east * east + north * north;
  if (radius2 >= 1) return null;
  const forward = Math.sqrt(1 - radius2);
  const u: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    u[k] = forward * b.center[k] + east * b.east[k] + north * b.north[k];
  }
  const ra = (((Math.atan2(u[1], u[0]) / DEG) % 360) + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, u[2]))) / DEG;
  return [ra, dec];
}

/** Build all MD-subgroups without consulting camera scale, current cursor or frame. */
export function buildCelestialSubgroups(
  group: GroupDetail,
): CelestialSubgroup[] {
  const root = group.members.find((m) => m.pgc === group.root_pgc);
  if (!root || root.ra === null || root.dec === null) return [];
  const b = basis(root.ra, root.dec);
  const projected = group.members.flatMap((member) => {
    if (member.ra === null || member.dec === null) return [];
    if (!Number.isFinite(member.ra) || !Number.isFinite(member.dec)) return [];
    const p = project(member.ra, member.dec, b);
    return p.visible ? [{ pgc: member.pgc, east: p.east, north: p.north }] : [];
  });
  if (projected.length < 2) return [];
  const maxExtent = Math.max(
    0.000001,
    ...projected.flatMap((p) => [Math.abs(p.east), Math.abs(p.north)]),
  );
  const scale = CANONICAL_RADIUS / maxExtent;
  const points: PixelGalaxy[] = projected.map((p) => ({
    pgc: p.pgc,
    x: CENTER + p.east * scale,
    y: CENTER - p.north * scale,
  }));
  const byPgc = new Map(points.map((p) => [p.pgc, p]));
  const memberByPgc = new Map(group.members.map((m) => [m.pgc, m]));
  const result: CelestialSubgroup[] = [];
  for (const subgroup of groupSubgroups(group.members, group.root_pgc)) {
    const subset = subgroup.memberPgcs.map((pgc) => byPgc.get(pgc));
    if (subset.some((p) => p === undefined)) continue;
    const memberSet = new Set(subgroup.memberPgcs);
    const connections = subgroup.memberPgcs.flatMap((pgc) => {
      const parent = memberByPgc.get(pgc)?.parent_md_pgc;
      return parent !== null && parent !== undefined && memberSet.has(parent)
        ? [{ fromPgc: pgc, toPgc: parent }]
        : [];
    });
    const region = buildSubgroupRegion(
      subset as PixelGalaxy[],
      connections,
      points.filter((p) => !memberSet.has(p.pgc)),
      SIZE,
      SIZE,
    );
    if (!region) continue;
    const polygons: SkyPoint[][] = [];
    let valid = true;
    for (const ring of region.rings) {
      // Drop redundant neighbouring samples while keeping sky-native shape.
      const step = Math.max(1, Math.ceil(ring.length / MAX_SKY_VERTICES));
      const vertices: SkyPoint[] = [];
      for (let i = 0; i < ring.length; i += step) {
        const p = inverse(ring[i].x, ring[i].y, b, scale);
        if (!p) {
          valid = false;
          break;
        }
        vertices.push(p);
      }
      if (!valid || vertices.length < 3) {
        valid = false;
        break;
      }
      polygons.push(vertices);
    }
    if (!valid || !polygons.length) continue;
    result.push({
      pgc: subgroup.mdPgc,
      name: subgroup.mdName,
      memberPgcs: [...subgroup.memberPgcs],
      polygons,
      containsSky(ra: number, dec: number): boolean {
        if (!Number.isFinite(ra) || !Number.isFinite(dec)) return false;
        const p = project(ra, dec, b);
        return (
          p.visible &&
          region.contains(CENTER + p.east * scale, CENTER - p.north * scale)
        );
      },
    });
  }
  result.sort(
    (a, b) => a.memberPgcs.length - b.memberPgcs.length || a.pgc - b.pgc,
  );
  return result;
}
