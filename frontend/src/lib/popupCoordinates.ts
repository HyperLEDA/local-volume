/** Format ICRS coordinates as a precise J2000-style positional string. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatJ2000Coordinate(
  raDeg: number | null | undefined,
  decDeg: number | null | undefined,
): string | null {
  if (
    raDeg === null ||
    raDeg === undefined ||
    !Number.isFinite(raDeg) ||
    decDeg === null ||
    decDeg === undefined ||
    !Number.isFinite(decDeg) ||
    Math.abs(decDeg) > 90
  ) {
    return null;
  }

  const normalizedRa = ((raDeg % 360) + 360) % 360;
  const raCentiseconds = Math.round(normalizedRa * 24000) % 8640000;
  const hours = Math.floor(raCentiseconds / 360000);
  const minutes = Math.floor((raCentiseconds % 360000) / 6000);
  const seconds = ((raCentiseconds % 6000) / 100).toFixed(2).padStart(5, "0");

  const decTenths = Math.round(Math.abs(decDeg) * 36000);
  const degrees = Math.floor(decTenths / 36000);
  const arcminutes = Math.floor((decTenths % 36000) / 600);
  const arcseconds = ((decTenths % 600) / 10).toFixed(1).padStart(4, "0");
  const sign = decDeg < 0 || Object.is(decDeg, -0) ? "-" : "+";
  return `J${pad2(hours)}${pad2(minutes)}${seconds}${sign}${pad2(degrees)}${pad2(arcminutes)}${arcseconds}`;
}
