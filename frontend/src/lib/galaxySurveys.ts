/** Curated CDS HiPS composites for object inspection; availability varies by sky position. */
export const GALAXY_SURVEYS = [
  {
    key: "dss2",
    label: "DSS2 · Optical",
    hips: "https://skies.esac.esa.int/DSSColor",
    bands: "Photographic optical color composite",
    source: "Digitized Sky Survey / ESA Sky",
  },
  {
    key: "galex",
    label: "GALEX GR6 AIS · UV",
    hips: "P/GALEXGR6/AIS/color",
    bands: "FUV / NUV color composite",
    source: "GALEX GR6 AIS / CDS HiPS",
  },
  {
    key: "2mass",
    label: "2MASS · Near-IR",
    hips: "P/2MASS/color",
    bands: "J / H / Ks color composite",
    source: "Two Micron All Sky Survey / CDS HiPS",
  },
  {
    key: "allwise",
    label: "AllWISE · Mid-IR",
    hips: "P/allWISE/color",
    bands: "W4 / W2 / W1 color composite",
    source: "AllWISE / CDS HiPS",
  },
] as const;

export type GalaxySurveyKey = (typeof GALAXY_SURVEYS)[number]["key"];

export function galaxySurvey(key: GalaxySurveyKey) {
  return GALAXY_SURVEYS.find((item) => item.key === key)!;
}

export function isGalaxySurveyKey(value: string): value is GalaxySurveyKey {
  return GALAXY_SURVEYS.some((item) => item.key === value);
}
