import { parseSkyCoordinates, type SkyCoordinates } from "./skySearch.ts";

// JHHMMSS.ss±DDMMSS.s and JHHMM±DDMM are positional ICRS designations.
// They are interpreted as coordinates only when the entire query matches.
export function parseJCoordinates(query: string): SkyCoordinates | null {
  const compact = query.trim().replace(/\s+/g, "");
  const full =
    /^J(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([+-])(\d{2})(\d{2})(\d{2}(?:\.\d+)?)$/i.exec(
      compact,
    );
  const short =
    full === null
      ? /^J(\d{2})(\d{2})([+-])(\d{2})(\d{2})$/i.exec(compact)
      : null;
  if (full === null && short === null) return null;
  const h = Number((full ?? short)?.[1]);
  const m = Number((full ?? short)?.[2]);
  const s = full === null ? 0 : Number(full[3]);
  const sign = full === null ? short?.[3] : full[4];
  const d = Number(full === null ? short?.[4] : full[5]);
  const dm = Number(full === null ? short?.[5] : full[6]);
  const ds = full === null ? 0 : Number(full[7]);
  if (
    ![h, m, s, d, dm, ds].every(Number.isFinite) ||
    h >= 24 ||
    m >= 60 ||
    s >= 60 ||
    d > 90 ||
    dm >= 60 ||
    ds >= 60 ||
    (d === 90 && (dm > 0 || ds > 0))
  )
    return null;
  const ra = 15 * (h + m / 60 + s / 3600);
  const dec = (sign === "-" ? -1 : 1) * (d + dm / 60 + ds / 3600);
  return { ra, dec };
}

export function parseAtlasCoordinates(query: string): SkyCoordinates | null {
  return parseJCoordinates(query) ?? parseSkyCoordinates(query);
}

/** 30 arcminutes: a reproducible, practical initial cone around a pointed position. */
export const DEFAULT_CONE_RADIUS_ARCMIN = 30;
