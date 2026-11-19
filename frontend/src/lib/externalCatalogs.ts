import { validPgc } from "./collectionNavigation.ts";

/** External object-identifier searches are not validated crossmatches. */
export function externalCatalogLinks(pgc: number) {
  if (!validPgc(pgc)) return null;
  const ident = encodeURIComponent(`PGC ${pgc}`);
  return [
    { name: "LEDA", url: `https://leda.sao.ru/object/${pgc}` },
    {
      name: "NED",
      url: `https://ned.ipac.caltech.edu/byname?objname=${ident}`,
    },
    {
      name: "SIMBAD",
      url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${ident}`,
    },
  ] as const;
}
