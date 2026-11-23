import type { GroupMember } from "../api/groups.ts";

/** One hierarchy substructure. Its members are explicit descendants, never sky-nearest guesses. */
export type GroupSubgroup = {
  mdPgc: number;
  mdName: string;
  memberPgcs: number[];
  positions: { ra: number; dec: number }[];
};

function hasCoordinates(
  member: GroupMember,
): member is GroupMember & { ra: number; dec: number } {
  return (
    typeof member.ra === "number" &&
    Number.isFinite(member.ra) &&
    typeof member.dec === "number" &&
    Number.isFinite(member.dec) &&
    member.dec >= -90 &&
    member.dec <= 90
  );
}

/**
 * Actual nested membership under each MD, excluding the top-level root.
 * Reject incomplete coordinates and cycles; a drawn footprint must include every
 * hierarchy member, rather than misleadingly enclosing a convenient subset.
 */
export function groupSubgroups(
  members: readonly GroupMember[],
  rootPgc: number,
): GroupSubgroup[] {
  const byPgc = new Map(members.map((member) => [member.pgc, member]));
  const children = new Map<number, number[]>();
  for (const member of members) {
    if (
      member.parent_md_pgc === null ||
      member.parent_md_pgc === member.pgc ||
      !byPgc.has(member.parent_md_pgc)
    )
      continue;
    const adjacent = children.get(member.parent_md_pgc) ?? [];
    adjacent.push(member.pgc);
    children.set(member.parent_md_pgc, adjacent);
  }

  function isRootConnected(startPgc: number): boolean {
    const ancestors = new Set<number>();
    let current: number | null = startPgc;
    while (current !== null && current !== rootPgc) {
      if (ancestors.has(current)) return false;
      ancestors.add(current);
      current = byPgc.get(current)?.parent_md_pgc ?? null;
    }
    return current === rootPgc;
  }

  const groups: GroupSubgroup[] = [];
  for (const [mdPgc, descendants] of children) {
    if (
      mdPgc === rootPgc ||
      descendants.length === 0 ||
      !isRootConnected(mdPgc)
    )
      continue;
    const root = byPgc.get(mdPgc);
    if (!root) continue;
    const visited = new Set<number>();
    const stack = [mdPgc];
    const membersInSubgroup: GroupMember[] = [];
    let valid = true;
    while (stack.length > 0) {
      const pgc = stack.pop()!;
      if (visited.has(pgc)) {
        valid = false;
        break;
      }
      visited.add(pgc);
      const member = byPgc.get(pgc);
      if (!member || !hasCoordinates(member)) {
        valid = false;
        break;
      }
      membersInSubgroup.push(member);
      stack.push(...(children.get(pgc) ?? []));
    }
    if (!valid || membersInSubgroup.length < 2) continue;
    groups.push({
      mdPgc,
      mdName: root.name,
      memberPgcs: membersInSubgroup.map((member) => member.pgc),
      positions: membersInSubgroup.map((member) => ({
        ra: member.ra!,
        dec: member.dec!,
      })),
    });
  }
  return groups.sort((a, b) => a.mdPgc - b.mdPgc);
}

export type ScreenPoint = { x: number; y: number };
export type ScreenFootprint = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

/** UI-only outline around the observed sky positions, never a physical group radius. */
export function subgroupScreenFootprint(
  positions: readonly { ra: number; dec: number }[],
  project: (ra: number, dec: number) => readonly number[] | null | undefined,
  width: number,
  height: number,
): ScreenFootprint | null {
  if (
    positions.length < 2 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const points: ScreenPoint[] = [];
  for (const p of positions) {
    const projected = project(p.ra, p.dec);
    if (
      !projected ||
      !Number.isFinite(projected[0]) ||
      !Number.isFinite(projected[1])
    )
      return null;
    const x = projected[0],
      y = projected[1];
    if (
      x < -width * 0.1 ||
      x > width * 1.1 ||
      y < -height * 0.1 ||
      y > height * 1.1
    )
      return null;
    points.push({ x, y });
  }
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const xlo = Math.min(...xs),
    xhi = Math.max(...xs);
  const ylo = Math.min(...ys),
    yhi = Math.max(...ys);
  // A bounding ellipse (not an enclosure at a physical radius). Screen-space
  // margin ensures that markers do not touch the outline at close separation.
  const cx = (xlo + xhi) / 2,
    cy = (ylo + yhi) / 2;
  const rx = Math.max(13, (xhi - xlo) * 0.77 + 10);
  const ry = Math.max(13, (yhi - ylo) * 0.77 + 10);
  if (!Number.isFinite(rx + ry + cx + cy)) return null;
  return { cx, cy, rx, ry };
}
