/** A deliberately small bridge to the existing Aladin instance. */
export type AtlasCamera = {
  getRaDec(): number[];
  getFov(): number[];
  getSize(): number[];
  gotoRaDec(ra: number, dec: number): void;
  setFoV(fov: number): void;
};

export type AtlasCameraSnapshot = Readonly<{
  ra: number;
  dec: number;
  fov: number;
}>;

export function captureAtlasCamera(
  view: AtlasCamera | null,
): AtlasCameraSnapshot | null {
  if (!view) return null;
  const [ra, dec] = view.getRaDec();
  const [fov] = view.getFov();
  return [ra, dec, fov].every((n) => Number.isFinite(n)) &&
    dec >= -90 && dec <= 90 && fov > 0 && fov <= 360
    ? { ra, dec, fov }
    : null;
}

/** Restore the equatorial centre and horizontal angular field, not pixel zoom. */
export function restoreAtlasCamera(
  view: AtlasCamera | null,
  snapshot: AtlasCameraSnapshot | null,
): boolean {
  if (!view || !snapshot) return false;
  const current = captureAtlasCamera(view);
  if (!current) return false;
  const deltaRa = Math.abs(((current.ra - snapshot.ra + 540) % 360) - 180);
  if (deltaRa > 1e-5 || Math.abs(current.dec - snapshot.dec) > 1e-5) {
    view.gotoRaDec(snapshot.ra, snapshot.dec);
  }
  if (Math.abs(current.fov - snapshot.fov) > Math.max(1e-4, snapshot.fov * 1e-4)) {
    view.setFoV(snapshot.fov);
  }
  return true;
}
