/** Sky-plane connection to a catalogued Main Disturber (ICRS, degrees).
 * Great-circle interpolation prevents a false straight chord across AIT maps.
 */
export type IcrsPoint = { ra: number; dec: number };
export type IcrsVertex = [number, number];
const RAD = Math.PI / 180;

export function hasSkyPosition(
  object: { ra?: number | null; dec?: number | null } | null | undefined,
): object is { ra: number; dec: number } {
  return (
    object !== null &&
    object !== undefined &&
    typeof object.ra === "number" &&
    Number.isFinite(object.ra) &&
    typeof object.dec === "number" &&
    Number.isFinite(object.dec) &&
    object.dec >= -90 &&
    object.dec <= 90
  );
}

/** At most 91 vertices, sampled every <=2 degrees; antipodal arcs are undefined. */
export function greatCircleVertices(a: IcrsPoint, b: IcrsPoint): IcrsVertex[] {
  if (!hasSkyPosition(a) || !hasSkyPosition(b)) return [];
  function vector(p: IcrsPoint): [number, number, number] {
    const ra = p.ra * RAD;
    const dec = p.dec * RAD;
    return [
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
    ];
  }
  const u = vector(a),
    v = vector(b);
  const dot = Math.min(
    1,
    Math.max(-1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]),
  );
  const omega = Math.acos(dot);
  if (omega < 3e-8 || Math.PI - omega < 1e-7) return [];
  const steps = Math.max(2, Math.min(90, Math.ceil(omega / (2 * RAD))));
  const sine = Math.sin(omega);
  const result: IcrsVertex[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const p = Math.sin((1 - t) * omega) / sine;
    const q = Math.sin(t * omega) / sine;
    const x = p * u[0] + q * v[0],
      y = p * u[1] + q * v[1],
      z = p * u[2] + q * v[2];
    const ra = (((Math.atan2(y, x) / RAD) % 360) + 360) % 360;
    const dec = Math.atan2(z, Math.hypot(x, y)) / RAD;
    result.push([ra, dec]);
  }
  return result;
}

/** Split when a projection has a discontinuity (e.g. at an all-sky edge). */
export function visibleGreatCircleSegments(
  vertices: readonly IcrsVertex[],
  project: (ra: number, dec: number) => number[] | null | undefined,
  mapWidth: number,
): IcrsVertex[][] {
  if (!Number.isFinite(mapWidth) || mapWidth <= 0) return [];
  const result: IcrsVertex[][] = [];
  let segment: IcrsVertex[] = [];
  let previous: number[] | null = null;
  function flush(): void {
    if (segment.length >= 2) result.push(segment);
    segment = [];
  }
  for (const p of vertices) {
    const screen = project(p[0], p[1]);
    if (!screen || !Number.isFinite(screen[0]) || !Number.isFinite(screen[1])) {
      flush();
      previous = null;
      continue;
    }
    if (
      previous &&
      Math.hypot(screen[0] - previous[0], screen[1] - previous[1]) >
        mapWidth * 0.48
    )
      flush();
    segment.push(p);
    previous = screen;
  }
  flush();
  return result;
}
