/**
 * A scale indicator evaluated at the map centre using live Aladin pix2world
 * coordinates. It is a local angular reference, not a calibrated image PSF.
 */
export type SkyPixelConverter = {
  getSize(): number[];
  pix2world(x: number, y: number): number[] | null;
};

export type GalaxyAngularScale = Readonly<{
  arcmin: number;
  pixels: number;
  angleLabel: string;
}>;

const DEG = Math.PI / 180;

export function greatCircleDegrees(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  if (![ra1, dec1, ra2, dec2].every(Number.isFinite)) return NaN;
  const phi1 = dec1 * DEG;
  const phi2 = dec2 * DEG;
  const delta = (ra2 - ra1) * DEG;
  const a =
    Math.sin((phi2 - phi1) / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(delta / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))))) / DEG;
}

/** Choose a 1/2/5 × power-of-ten angular reference within ~100 CSS px. */
function niceArcmin(maximum: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  for (const n of [10, 5, 2, 1]) {
    const length = n * magnitude;
    if (length <= maximum * (1 + 1e-10)) return length;
  }
  return magnitude;
}

export function getGalaxyAngularScale(
  view: SkyPixelConverter,
): GalaxyAngularScale | null {
  const [width, height] = view.getSize();
  if (![width, height].every(Number.isFinite) || width < 150 || height < 50)
    return null;
  const samplePx = Math.min(110, width / 4);
  const left = view.pix2world(width / 2 - samplePx / 2, height / 2);
  const right = view.pix2world(width / 2 + samplePx / 2, height / 2);
  if (!left || !right || left.length < 2 || right.length < 2) return null;
  const measuredDeg = greatCircleDegrees(left[0], left[1], right[0], right[1]);
  if (!Number.isFinite(measuredDeg) || measuredDeg <= 0 || measuredDeg > 120)
    return null;
  const targetArcmin = measuredDeg * 60;
  const arcmin = niceArcmin(targetArcmin);
  const pixels = (arcmin / targetArcmin) * samplePx;
  if (!Number.isFinite(pixels) || pixels < 4 || pixels > width / 2) return null;
  const angleLabel =
    arcmin >= 60
      ? `${Number((arcmin / 60).toPrecision(3))}°`
      : arcmin >= 1
        ? `${arcmin}′`
        : `${Number((arcmin * 60).toPrecision(3))}″`;
  return { arcmin, pixels, angleLabel };
}

/** A small-angle transverse size at adopted distance; not a 3-D separation. */
export function projectedScaleLabel(
  arcmin: number,
  distanceMpc: number | null,
): string | null {
  if (
    typeof distanceMpc !== "number" ||
    !Number.isFinite(distanceMpc) ||
    distanceMpc <= 0 ||
    !Number.isFinite(arcmin) ||
    arcmin <= 0 ||
    arcmin > 600
  )
    return null;
  const theta = (arcmin / 60) * DEG;
  // Chord in the plane perpendicular to the line of sight at the adopted D.
  const kpc = 2 * distanceMpc * 1000 * Math.tan(theta / 2);
  if (!Number.isFinite(kpc) || kpc <= 0) return null;
  if (kpc < 1) return `${Number((kpc * 1000).toPrecision(3))} pc projected`;
  return `${Number(kpc.toPrecision(3))} kpc projected`;
}
