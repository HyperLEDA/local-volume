/* Issue #85 v20.2: M104 hero, research editorial and aligned section layout. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchObjects, type CatalogObject } from "../api/objects.ts";
import {
  fetchGroup,
  type GroupDetail,
  type GroupMember,
} from "../api/groups.ts";
import { AboutVelocityFigure } from "../components/AboutVelocityFigure.tsx";
import "../styles/about.css";

// The About illustrations are documented captures of the actual LV LEDA routes.
// They are produced locally by scripts/capture_about_figures.py and displayed as
// static image assets rather than mounting multiple costly live Aladin views.
const CAPTURE_BASE = "/about/captures";

const SCIENCE_CASE_PGC = 42407; // M104, root of the verified image capture; change only with new scientific evidence.
const M104_IMAGE =
  "https://cdn.esahubble.org/archives/images/screen/heic2506a.jpg";
const M104_SOURCE = "https://esahubble.org/images/heic2506a/";

// DOI-linked background literature. Source–claim alignment requires editorial review before release.
const SCIENCE_REFERENCES = [
  {
    id: "ungc",
    author: "Karachentsev et al.",
    year: 2013,
    title: "Updated Nearby Galaxy Catalog",
    doi: "10.1088/0004-6256/145/4/101",
  },
  {
    id: "suites",
    author: "Karachentsev et al.",
    year: 2014,
    title: "Suites of Dwarfs around Nearby Giant Galaxies",
    doi: "10.1088/0004-6256/147/1/13",
  },
  {
    id: "hyperleda",
    author: "Makarov et al.",
    year: 2014,
    title: "HyperLEDA. III. The catalogue of extragalactic distances",
    doi: "10.1051/0004-6361/201423496",
  },
  {
    id: "edd",
    author: "Tully et al.",
    year: 2009,
    title: "The Extragalactic Distance Database",
    doi: "10.1088/0004-6256/138/2/323",
  },
  {
    id: "elves",
    author: "Carlsten et al.",
    year: 2022,
    title: "The Exploration of Local VolumE Satellites Survey",
    doi: "10.3847/1538-4357/ac6fd7",
  },
  {
    id: "lvdb",
    author: "Pace",
    year: 2025,
    title: "The Local Volume Database: a library of observed properties",
    doi: "10.33232/001c.144859",
  },
  {
    id: "cn2004",
    author: "Karachentsev et al.",
    year: 2004,
    title: "A Catalog of Neighboring Galaxies",
    doi: "10.1086/382905",
  },
  {
    id: "mcconnachie",
    author: "McConnachie",
    year: 2012,
    title:
      "The Observed Properties of Dwarf Galaxies in and around the Local Group",
    doi: "10.1088/0004-6256/144/1/4",
  },
  {
    id: "angst",
    author: "Dalcanton et al.",
    year: 2009,
    title: "The ACS Nearby Galaxy Survey Treasury",
    doi: "10.1088/0067-0049/183/1/67",
  },
  {
    id: "weisz",
    author: "Weisz et al.",
    year: 2014,
    title: "The Star Formation Histories of Local Group Dwarf Galaxies. I",
    doi: "10.1088/0004-637X/789/2/147",
  },
  {
    id: "quenching",
    author: "Geha et al.",
    year: 2012,
    title: "A Stellar Mass Threshold for Quenching of Field Galaxies",
    doi: "10.1088/0004-637X/757/1/85",
  },
  {
    id: "smallscale",
    author: "Bullock & Boylan-Kolchin",
    year: 2017,
    title: "Small-Scale Challenges to the ΛCDM Paradigm",
    doi: "10.1146/annurev-astro-091916-055313",
  },
  {
    id: "cosmicflows",
    author: "Tully et al.",
    year: 2016,
    title: "Cosmicflows-3",
    doi: "10.3847/0004-6256/152/2/50",
  },
  {
    id: "weisz2015",
    author: "Weisz et al.",
    year: 2015,
    title:
      "The Star Formation Histories of Local Group Dwarf Galaxies. III: Quenching",
    doi: "10.1088/0004-637X/804/2/136",
  },
  {
    id: "rizzi",
    author: "Rizzi et al.",
    year: 2007,
    title: "Tip of the Red Giant Branch Distances. II. Zero-Point Calibration",
    doi: "10.1086/516566",
  },
  {
    id: "eddcmd",
    author: "Jacobs et al.",
    year: 2009,
    title: "The Extragalactic Distance Database: Color–Magnitude Diagrams",
    doi: "10.1088/0004-6256/138/2/332",
  },
  {
    id: "simon",
    author: "Simon",
    year: 2019,
    title: "The Faintest Dwarf Galaxies",
    doi: "10.1146/annurev-astro-091918-104453",
  },
  {
    id: "groups2011",
    author: "Makarov & Karachentsev",
    year: 2011,
    title: "Galaxy groups and clouds in the local (z ~ 0.01) Universe",
    doi: "10.1111/j.1365-2966.2010.18071.x",
  },
  {
    id: "localflow2009",
    author: "Karachentsev et al.",
    year: 2009,
    title: "The Hubble flow around the Local Group",
    doi: "10.1111/j.1365-2966.2008.14300.x",
  },
  {
    id: "read2016",
    author: "Read et al.",
    year: 2016,
    title: "Dark matter cores all the way down",
    doi: "10.1093/mnras/stw713",
  },

  {
    id: "hecate",
    author: "Kovlakas et al.",
    year: 2021,
    title:
      "The Heraklion Extragalactic Catalogue: a value-added galaxy catalogue for multimessenger astrophysics",
    doi: "10.1093/mnras/stab1799",
  },
  {
    id: "nedlvs",
    author: "Cook et al.",
    year: 2023,
    title:
      "Completeness of the NASA/IPAC Extragalactic Database (NED) Local Volume Sample",
    doi: "10.3847/1538-4365/acdd06",
  },
] as const;

type ScienceReferenceId = (typeof SCIENCE_REFERENCES)[number]["id"];

function ScienceCitation({ id }: { id: ScienceReferenceId }) {
  const source = SCIENCE_REFERENCES.find((reference) => reference.id === id);
  if (!source) return null;
  return (
    <a
      className="about-v11-citation"
      href={`https://doi.org/${source.doi}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.title} · DOI: ${source.doi}`}
    >
      ({source.author}, {source.year})
    </a>
  );
}

type SkyPoint = { pgc: number; x: number; y: number };
type Snapshot = { records: CatalogObject[]; retrievedAt: string };
type TrgbVelocityRow = {
  pgc: number;
  name: string;
  distance: number;
  velocity: number;
  method: string;
};

/** This is a plotted subset, not a claim of Local Volume completeness. */
export function aboutTrgbVelocitySample(
  records: readonly CatalogObject[],
): TrgbVelocityRow[] {
  return records
    .filter(
      (row) =>
        Number.isSafeInteger(row.pgc) &&
        row.pgc > 0 &&
        typeof row.dist === "number" &&
        Number.isFinite(row.dist) &&
        row.dist > 0 &&
        row.dist <= 11 &&
        typeof row.lvg_v_lg_kms === "number" &&
        Number.isFinite(row.lvg_v_lg_kms) &&
        /TRGB/i.test(row.distance_method ?? ""),
    )
    .map((row) => ({
      pgc: row.pgc,
      name: row.name,
      distance: row.dist as number,
      velocity: row.lvg_v_lg_kms as number,
      method: row.distance_method ?? "",
    }))
    .sort((a, b) => a.pgc - b.pgc);
}

export function aboutSampleManifest(
  snapshot: Snapshot,
  rows: readonly TrgbVelocityRow[],
) {
  return {
    dataset: "LV LEDA /api/v1/objects",
    source_release: null,
    note: "The API does not supply a release identifier in this response; retrieval time is not a catalogue version",
    retrieved_at_utc: snapshot.retrievedAt,
    sample:
      "Adopted distance with a TRGB-labelled method, 0 < D <= 11 Mpc, finite Local Group-frame velocity and valid PGC",
    distance_field: "dist",
    distance_unit: "Mpc",
    distance_method_field: "distance_method",
    velocity_field: "lvg_v_lg_kms",
    velocity_unit: "km/s",
    velocity_frame: "Local Group",
    plotted_count: rows.length,
    plotted_pgcs: rows.map((row) => row.pgc),
    uncertainties: "Not represented in the scatter plot",
    selection_function: "Not modelled",
    flow_model: "None fitted",
    excludes: "Null, nonfinite and out-of-range values",
  };
}

// Keep the original rectangular transform as a tested public helper.
const PLOT_LEFT = 36;
const PLOT_RIGHT = 684;
const PLOT_TOP = 22;
const PLOT_BOTTOM = 296;
const SKY_CX = 440;
const SKY_CY = 221;
const SKY_RX = 394;
const SKY_RY = 197;

function validSkyObject(
  row: CatalogObject,
): row is CatalogObject & { ra: number; dec: number } {
  return (
    Number.isSafeInteger(row.pgc) &&
    row.pgc > 0 &&
    typeof row.ra === "number" &&
    Number.isFinite(row.ra) &&
    row.ra >= 0 &&
    row.ra < 360 &&
    typeof row.dec === "number" &&
    Number.isFinite(row.dec) &&
    row.dec >= -90 &&
    row.dec <= 90
  );
}

export function aboutSkyPoints(objects: readonly CatalogObject[]): SkyPoint[] {
  return objects.filter(validSkyObject).map(({ pgc, ra, dec }) => ({
    pgc,
    x: PLOT_LEFT + ((360 - ra) / 360) * (PLOT_RIGHT - PLOT_LEFT),
    y: PLOT_TOP + ((90 - dec) / 180) * (PLOT_BOTTOM - PLOT_TOP),
  }));
}

// Equatorial equal-area Mollweide. The calculation uses observed angles only.
function mollweideCoordinates(
  ra: number,
  dec: number,
): { x: number; y: number } {
  const latitude = (dec * Math.PI) / 180;
  const target = Math.PI * Math.sin(latitude);
  let theta = Math.sign(dec) * (Math.PI / 2);
  if (dec !== 90 && dec !== -90) {
    let low = -Math.PI / 2;
    let high = Math.PI / 2;
    for (let index = 0; index < 38; index += 1) {
      const midpoint = (low + high) / 2;
      if (2 * midpoint + Math.sin(2 * midpoint) < target) low = midpoint;
      else high = midpoint;
    }
    theta = (low + high) / 2;
  }
  const longitude = ((180 - ra) * Math.PI) / 180;
  return {
    x: SKY_CX + SKY_RX * (longitude / Math.PI) * Math.cos(theta),
    y: SKY_CY - SKY_RY * Math.sin(theta),
  };
}

export function aboutMollweidePoints(
  objects: readonly CatalogObject[],
): SkyPoint[] {
  return objects.filter(validSkyObject).map(({ pgc, ra, dec }) => ({
    pgc,
    ...mollweideCoordinates(ra, dec),
  }));
}

function useCatalogue(): { snapshot: Snapshot | null; failed: boolean } {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchObjects()
      .then((records) => {
        if (live) {
          setSnapshot({ records, retrievedAt: new Date().toISOString() });
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  return { snapshot, failed };
}

function useAboutMotion() {
  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".about-v6");
    if (!page) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let observer: IntersectionObserver | undefined = undefined;
    if (!reduceMotion && "IntersectionObserver" in window) {
      page.classList.add("about-v6-motion-ready");
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("about-v6-visible");
              observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -35px 0px" },
      );
      page
        .querySelectorAll(".about-v6-reveal")
        .forEach((element) => observer?.observe(element));
    }
    return () => {
      observer?.disconnect();
      page.classList.remove("about-v6-motion-ready");
    };
  }, []);
}

const ABOUT_CHAPTERS = [
  {
    id: "about-v10-why",
    number: "01",
    label: "Local Volume",
    summary: "Distances and sample definition",
  },
  {
    id: "about-v14-heritage",
    number: "02",
    label: "Lineage",
    summary: "Nearby-galaxy catalogue tradition",
  },
  {
    id: "about-v11-focus",
    number: "03",
    label: "LV LEDA",
    summary: "Linked measurements and groups",
  },
  {
    id: "about-v6-sky",
    number: "04",
    label: "Research example",
    summary: "Atlas, galaxy and environment",
  },
  {
    id: "about-v6-method",
    number: "05",
    label: "Science cases",
    summary: "Testable questions",
  },
  {
    id: "about-v11-future",
    number: "06",
    label: "Development",
    summary: "Open research issues",
  },
] as const;

type AboutChapterId = (typeof ABOUT_CHAPTERS)[number]["id"];

function useActiveAboutChapter(): AboutChapterId {
  const [active, setActive] = useState<AboutChapterId>(ABOUT_CHAPTERS[0].id);
  useEffect(() => {
    let frame = 0;
    function updateChapter() {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const navigator = document.querySelector<HTMLElement>(".about-v17-nav");
        const threshold = navigator
          ? Math.min(
              window.innerHeight * 0.5,
              navigator.getBoundingClientRect().bottom + 24,
            )
          : 160;
        let current: AboutChapterId = ABOUT_CHAPTERS[0].id;
        for (const chapter of ABOUT_CHAPTERS) {
          const section = document.getElementById(chapter.id);
          if (section && section.getBoundingClientRect().top <= threshold)
            current = chapter.id;
        }
        if (
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 8
        ) {
          current = ABOUT_CHAPTERS[ABOUT_CHAPTERS.length - 1].id;
        }
        setActive((previous) => (previous === current ? previous : current));
      });
    }
    updateChapter();
    window.addEventListener("scroll", updateChapter, { passive: true });
    window.addEventListener("resize", updateChapter);
    return () => {
      window.removeEventListener("scroll", updateChapter);
      window.removeEventListener("resize", updateChapter);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);
  return active;
}

function AboutChapterNavigation() {
  const activeId = useActiveAboutChapter();
  return (
    <nav className="about-v17-nav" aria-label="About LV LEDA chapters">
      <a className="about-v17-nav-home" href="#about-v6-top">
        About LV LEDA
      </a>
      <div className="about-v17-nav-items">
        {ABOUT_CHAPTERS.map((chapter) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            aria-current={activeId === chapter.id ? "location" : undefined}
            aria-label={`Chapter ${chapter.number}: ${chapter.label}`}
          >
            <span>{chapter.number}</span>
            {chapter.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** About uses the same publication JPEG and point inspector as Group Page.
 * Detailed sample provenance is retained in Data & methods, not in reader-facing prose. */
function LocalFlowFigure({
  snapshot,
  failed,
}: {
  snapshot: Snapshot | null;
  failed: boolean;
}) {
  const rows = useMemo(
    () => (snapshot ? aboutTrgbVelocitySample(snapshot.records) : []),
    [snapshot],
  );
  const methods = useMemo(
    () => (snapshot ? aboutSampleManifest(snapshot, rows) : null),
    [snapshot, rows],
  );
  return (
    <AboutVelocityFigure
      rows={rows}
      methods={methods}
      loading={!snapshot && !failed}
      failed={failed}
    />
  );
}

/** Documented high-resolution capture of a real LV LEDA interface section.
 * No synthetic screenshots, no iframe, no second live Aladin instance. */
function InterfaceCapture({
  src,
  label,
  alt,
  route,
  description,
  className,
}: {
  src: string;
  label: string;
  alt: string;
  route: string;
  description: string;
  className?: string;
}) {
  const [available, setAvailable] = useState(true);
  return (
    <figure
      className={`about-v14-interface-capture${className ? ` ${className}` : ""}`}
    >
      <div className="about-v14-capture-head">
        <span className="about-v6-overline">{label}</span>
        <Link to={route}>Open in LV LEDA ↗</Link>
      </div>
      {available ? (
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open full-resolution figure: ${alt}`}
          className="about-v14-capture-image-link"
        >
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setAvailable(false)}
          />
        </a>
      ) : (
        <div className="about-v14-capture-unavailable" role="status">
          <p>
            Scientific interface figure is being prepared from the working LV
            LEDA view
          </p>
          <Link to={route}>View the original interface ↗</Link>
        </div>
      )}
      <figcaption>{description}</figcaption>
    </figure>
  );
}

function LiveAtlasExample() {
  return (
    <InterfaceCapture
      src={`${CAPTURE_BASE}/atlas-sky.webp`}
      label="LV LEDA · SCIENTIFIC ATLAS"
      alt="High-resolution capture of the real LV LEDA Scientific Atlas with its all-sky Aladin map and galaxy markers"
      route="/"
      description="The LV LEDA sky atlas places the nearby-galaxy catalogue on the sky and links it to individual records and nearby systems."
    />
  );
}

export type AboutHierarchyLink = { parent: number; child: number };
/** Use only explicit source parent-MD edges; do not infer links from angular proximity. */
export function aboutHierarchyLinks(
  members: readonly Pick<GroupMember, "pgc" | "parent_md_pgc">[],
): AboutHierarchyLink[] {
  const ids = new Set(members.map((member) => member.pgc));
  return members
    .filter(
      (member) =>
        typeof member.parent_md_pgc === "number" &&
        ids.has(member.parent_md_pgc) &&
        member.parent_md_pgc !== member.pgc,
    )
    .map((member) => ({
      parent: member.parent_md_pgc as number,
      child: member.pgc,
    }));
}

type GroupCaptureMeta = {
  root_pgc: number;
  name: string;
  member_count: number;
  captured_at: string;
  source_catalog: string;
  source_version: string;
  source_sha256?: string | null;
  subgroup_count?: number;
  parent_md_links?: number;
};

export function aboutGroupCaptureMatches(
  meta: GroupCaptureMeta,
  group: GroupDetail,
): boolean {
  if (
    group.definition !== "suite" ||
    group.root_pgc !== meta.root_pgc ||
    group.source_catalog !== meta.source_catalog ||
    group.source_version !== meta.source_version ||
    group.member_count !== meta.member_count
  )
    return false;
  if (meta.source_sha256 && meta.source_sha256 !== group.source_sha256)
    return false;
  if (
    meta.subgroup_count !== undefined &&
    meta.subgroup_count !== group.subgroup_count
  )
    return false;
  if (
    meta.parent_md_links !== undefined &&
    meta.parent_md_links !== aboutHierarchyLinks(group.members).length
  )
    return false;
  return true;
}

type CaseCaptureMeta = {
  root_pgc: number;
  route: string;
  source_group_capture: string;
  captured_at: string;
  width_px: number;
  height_px: number;
  sha256: string;
};
function MatchedGalaxyCase() {
  const [item, setItem] = useState<{
    meta: GroupCaptureMeta;
    caseMeta: CaseCaptureMeta;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const options: RequestInit = {
        cache: "no-store",
        signal: controller.signal,
      };
      const [groupResponse, galaxyResponse] = await Promise.all([
        fetch(`${CAPTURE_BASE}/group-suite.json`, options),
        fetch(`${CAPTURE_BASE}/galaxy-case.json`, options),
      ]);
      if (!groupResponse.ok || !galaxyResponse.ok)
        throw new Error("Source captures unavailable");
      const meta = (await groupResponse.json()) as GroupCaptureMeta;
      const caseMeta = (await galaxyResponse.json()) as CaseCaptureMeta;
      if (
        meta.root_pgc !== SCIENCE_CASE_PGC ||
        caseMeta.root_pgc !== meta.root_pgc ||
        caseMeta.route !== `/object/${meta.root_pgc}` ||
        caseMeta.source_group_capture !== meta.captured_at
      )
        throw new Error(
          "Galaxy image and group refer to different source snapshots",
        );
      if (!controller.signal.aborted) setItem({ meta, caseMeta });
    })().catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, []);
  if (!item)
    return (
      <div className="about-v17-case-fallback" role="status">
        <p>
          {error
            ? "A matching galaxy image is not available"
            : "Checking the matched galaxy and group images…"}
        </p>
        <Link to="/groups">Open the group catalogue ↗</Link>
      </div>
    );
  const { meta } = item;
  return (
    <InterfaceCapture
      src={`${CAPTURE_BASE}/galaxy-case.webp`}
      label={`GALAXY RECORD · ${meta.name.toUpperCase()} · PGC ${meta.root_pgc}`}
      alt={`Real Galaxy Page for ${meta.name}, PGC ${meta.root_pgc}, with its catalogue parameter tables`}
      route={`/object/${meta.root_pgc}`}
      description="Individual observations and adopted physical quantities for M104, the Main Disturber of the illustrated suite."
    />
  );
}

function GroupHierarchyFigure({
  group,
  meta,
}: {
  group: GroupDetail | null;
  meta: GroupCaptureMeta;
}) {
  const matched = group !== null && aboutGroupCaptureMatches(meta, group);
  const root = matched
    ? group.members.find((member) => member.pgc === meta.root_pgc)
    : null;
  return (
    <div className="about-v18-group-story">
      <div className="about-v18-group-visual">
        <InterfaceCapture
          className="about-v18-group-capture"
          src={`${CAPTURE_BASE}/group-sky.webp`}
          label={`MAIN DISTURBER SUITE · ${meta.name.toUpperCase()} · PGC ${meta.root_pgc}`}
          alt={`Captured LV LEDA sky map of ${meta.name}, showing selected suite members and explicit parent–Main Disturber connections`}
          route={`/groups/${meta.root_pgc}?definition=suite`}
          description="The projected arrangement and Main Disturber connections of galaxies assigned to the M104 suite."
        />
      </div>
      <aside
        className="about-v18-group-notes"
        aria-label="Interpretation of the M104 suite map"
      >
        <h3>How to read this map</h3>
        <p>
          Markers locate catalogue members on the sky. Lines trace the recorded
          Main Disturber assignments that define the hierarchy
        </p>
        {matched ? (
          <>
            <dl>
              <div>
                <dt>Main galaxy</dt>
                <dd>
                  <Link to={`/object/${meta.root_pgc}`}>
                    {meta.name} · PGC {meta.root_pgc}
                  </Link>
                </dd>
              </div>
              {typeof root?.dist_mpc === "number" && (
                <div>
                  <dt>Adopted distance</dt>
                  <dd>
                    {root.dist_mpc.toFixed(2)} Mpc
                    {root.distance_method ? ` · ${root.distance_method}` : ""}
                  </dd>
                </div>
              )}
              {typeof root?.lvg_v_lg_kms === "number" && (
                <div>
                  <dt>
                    V<sub>LG</sub>
                  </dt>
                  <dd>{root.lvg_v_lg_kms.toFixed(0)} km/s</dd>
                </div>
              )}
              <div>
                <dt>Group definition</dt>
                <dd>Main Disturber suite</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="about-v18-evidence-warning" role="status">
            Open the Group Page to inspect the current membership and
            measurements
          </p>
        )}
        <p>
          Membership follows the adopted tidal prescription and the available
          donor census. The map displays the hierarchy used for suite analysis
          in LV LEDA. <ScienceCitation id="suites" />
        </p>
        <Link to={`/groups/${meta.root_pgc}?definition=suite`}>
          Inspect current suite and membership ↗
        </Link>
      </aside>
    </div>
  );
}

function GroupHierarchyCaseStudy() {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [metadata, setMetadata] = useState<GroupCaptureMeta | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const response = await fetch(`${CAPTURE_BASE}/group-suite.json`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Group figure metadata unavailable");
      const meta = (await response.json()) as GroupCaptureMeta;
      if (
        meta.root_pgc !== SCIENCE_CASE_PGC ||
        !meta.source_catalog ||
        !meta.source_version ||
        !meta.captured_at ||
        !Number.isSafeInteger(meta.member_count)
      )
        throw new Error("Invalid capture metadata");
      if (!controller.signal.aborted) setMetadata(meta);
      // The snapshot itself may be shown even if the live API cannot be queried.
      const detail = await fetchGroup(meta.root_pgc, "suite");
      if (!controller.signal.aborted && aboutGroupCaptureMatches(meta, detail))
        setGroup(detail);
    })().catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => {
      controller.abort();
    };
  }, []);
  return (
    <div className="about-v12-group-case">
      {metadata ? (
        <GroupHierarchyFigure group={group} meta={metadata} />
      ) : (
        <div className="about-v14-group-fallback" role="status">
          <p>
            {error
              ? "The group illustration is temporarily unavailable."
              : "Preparing the group illustration…"}
          </p>
          <Link to="/groups">Browse LV LEDA groups ↗</Link>
        </div>
      )}
    </div>
  );
}

export function AboutPage() {
  const { snapshot, failed } = useCatalogue();

  useAboutMotion();
  return (
    <main className="catalog about-v6 about-v8 about-v10 about-v11 about-v12 about-v14 about-v15 about-v17 about-v18 about-v20 about-v21">
      <article>
        <header id="about-v6-top" className="about-v6-hero about-v6-reveal">
          <div className="about-v6-hero-content">
            <p className="about-v6-overline">SAO RAS · LEDA</p>
            <h1>
              <span className="about-v6-project-name">LV LEDA</span>
              <em>The Local Volume organised for research</em>
            </h1>
            <p className="about-v6-hero-lead">
              LV LEDA compiles adopted distances, radial velocities, optical and
              H I measurements, and environmental assignments for galaxies of
              the Local Volume. The PGC identifier connects each atlas entry
              with its measurements and neighbouring systems
            </p>
            <p className="about-v6-hero-context">
              Explore the catalogue’s scientific foundations, inspect a worked
              example and examine the questions that nearby galaxies can help
              answer
            </p>
            <div className="about-v6-hero-actions">
              <a href="#about-v10-why" className="about-v6-primary-link">
                Start with the science <span aria-hidden="true">↓</span>
              </a>
              <Link to="/" className="about-v6-plain-link">
                Open the Scientific Atlas <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className="about-v6-hero-foot">
              <span>About the project</span>
              <Link to="#about-v14-heritage">Scientific lineage ↗</Link>
            </div>
          </div>
          <figure className="about-v6-hero-observation">
            <img
              src={M104_IMAGE}
              alt="Hubble Space Telescope image of Messier 104, the Sombrero Galaxy"
              loading="eager"
              decoding="async"
            />
            <figcaption>
              <span className="about-v6-overline">
                HUBBLE OBSERVATION · 2025
              </span>
              <strong>Messier 104</strong>
              <span>Sombrero Galaxy · NGC 4594 · PGC 42407</span>
              <small>
                ESA/Hubble &amp; NASA, K. Noll ·{" "}
                <a href={M104_SOURCE} target="_blank" rel="noopener noreferrer">
                  Image and credits ↗
                </a>
              </small>
            </figcaption>
          </figure>
        </header>
        <AboutChapterNavigation />

        <section
          id="about-v10-why"
          className="about-v6-section about-v10-why about-v13-why about-v6-reveal"
          aria-labelledby="about-v10-why-heading"
        >
          <div className="about-v10-premise">
            <span className="about-v6-overline">01 / THE LOCAL VOLUME</span>
            <h2 id="about-v10-why-heading">
              Distances, dwarf populations and local structure
            </h2>
            <p>
              Resolved-star measurements provide redshift-independent distances
              and reconstructed stellar-population histories; the resulting
              near-field galaxy census spans isolated dwarfs, satellites and
              richer associations. TRGB distances and the distance-method
              distribution are essential inputs to membership and local-flow
              analyses. <ScienceCitation id="angst" />{" "}
              <ScienceCitation id="rizzi" /> <ScienceCitation id="eddcmd" />{" "}
              <ScienceCitation id="mcconnachie" />
            </p>
            <p>
              The Updated Nearby Galaxy Catalog established a common sample of
              nearby systems, combining photometry, H I, velocities, distances
              and tidal indices. LV LEDA makes those galaxy level relations
              accessible in a connected working catalogue.{" "}
              <ScienceCitation id="ungc" /> <ScienceCitation id="suites" />
            </p>
          </div>
          <aside
            className="about-v21-census"
            aria-label="Current catalogue size"
          >
            <div className="about-v21-census-number">
              <span className="about-v21-census-kicker">CURRENT CATALOGUE</span>
              <strong>
                {snapshot
                  ? snapshot.records.length.toLocaleString("en-GB")
                  : failed
                    ? "—"
                    : "…"}
              </strong>
              <span>galaxies</span>
            </div>
            <div className="about-v21-census-description">
              <h3>Catalogue coverage</h3>
              <p>
                LV LEDA links galaxy identifiers with distances, velocities,
                photometry and environmental measurements
              </p>
              <p>
                Research selections can be constructed using the available
                distance indicators and observations
              </p>
            </div>
          </aside>
          <div className="about-v13-why-observations">
            <LocalFlowFigure snapshot={snapshot} failed={failed} />
            <aside className="about-v13-why-method">
              <h3>Tracing the local Hubble flow</h3>
              <p>
                Why do nearby galaxies at similar distances sometimes have
                different radial velocities? This diagram compares TRGB-based
                distances with velocities in the Local Group frame for a
                selected sample within 11 Mpc. The overall distance–velocity
                trend traces nearby cosmic expansion, while its scatter draws
                attention to the dynamics of galaxies and their surroundings.{" "}
                <ScienceCitation id="localflow2009" />{" "}
                <ScienceCitation id="cosmicflows" />
              </p>
              <p>
                The distribution helps identify candidates for peculiar-motion
                studies, examine possible group associations and investigate how
                nearby structures shape the local velocity field
              </p>
            </aside>
          </div>
        </section>

        <section
          className="about-v14-heritage about-v6-reveal"
          id="about-v14-heritage"
          aria-labelledby="about-v14-heritage-heading"
        >
          <div className="about-v14-heritage-heading">
            <span className="about-v6-overline">02 / SCIENTIFIC LINEAGE</span>
            <h2 id="about-v14-heritage-heading">
              A history of nearby-galaxy catalogues
            </h2>
            <p>
              LV LEDA builds on the Catalog of Neighboring Galaxies, the Updated
              Nearby Galaxy Catalog and published studies of Main Disturber
              suites. HyperLEDA and the Extragalactic Distance Database
              established important foundations for galaxy identification and
              distance measurements. LV LEDA combines these traditions in a
              catalogue centred on nearby systems.{" "}
              <ScienceCitation id="cn2004" /> <ScienceCitation id="ungc" />{" "}
              <ScienceCitation id="hyperleda" /> <ScienceCitation id="edd" />
            </p>
          </div>
          <div className="about-v14-heritage-sequence">
            <article>
              <span>CATALOGUE FOUNDATION</span>
              <h3>The nearby-galaxy census</h3>
              <p>
                The <i>Catalog of Neighboring Galaxies</i> and the{" "}
                <i>Updated Nearby Galaxy Catalog</i> established connected
                samples of nearby objects, measured properties and environmental
                descriptors. <ScienceCitation id="cn2004" />{" "}
                <ScienceCitation id="ungc" />
              </p>
            </article>
            <article>
              <span>PARAMETER AND DISTANCE HERITAGE</span>
              <h3>HyperLEDA and EDD</h3>
              <p>
                Standardized galaxy identification, heterogeneous measurements
                and independently determined distances are central to HyperLEDA
                and the Extragalactic Distance Database. LV LEDA combines that
                catalogue tradition with a dedicated view of galaxies in the
                Local Volume. <ScienceCitation id="hyperleda" />{" "}
                <ScienceCitation id="edd" /> <ScienceCitation id="eddcmd" />
              </p>
            </article>
            <article>
              <span>GROUPS AND POPULATIONS</span>
              <h3>Comparative satellite samples</h3>
              <p>
                The Main Disturber framework, nearby satellite surveys and
                studies of resolved stellar populations support comparisons of
                satellite populations, star formation histories and their host
                galaxies. <ScienceCitation id="suites" />{" "}
                <ScienceCitation id="angst" /> <ScienceCitation id="elves" />
              </p>
            </article>
          </div>
        </section>
        <section
          className="about-v6-section about-v11-focus about-v6-reveal"
          id="about-v11-focus"
          aria-labelledby="about-v11-focus-heading"
        >
          <div className="about-v11-focus-header">
            <span className="about-v6-overline">
              03 / LV LEDA IN THE RESEARCH LANDSCAPE
            </span>
            <h2 id="about-v11-focus-heading">
              Where LV LEDA fits among nearby galaxy resources
            </h2>
            <p>
              The PGC identifier connects a sky selection with the galaxy’s
              adopted photometry, distance, Main Disturber assignment and group
              membership. Explicit parent to Main Disturber links define the
              suite hierarchy, while physical groups use a separate membership
              criterion. LV LEDA provides both definitions for comparative
              studies of satellite populations and galaxy dynamics.{" "}
              <ScienceCitation id="ungc" /> <ScienceCitation id="suites" />
            </p>
          </div>
          <div
            className="about-v11-science-chain"
            aria-label="Research workflow in the current LV LEDA"
          >
            <div>
              <span>01 / SAMPLE</span>
              <strong>Sky region and catalogue selection</strong>
              <p>
                Positions, distance, radial velocity, morphology, H I and
                available environmental filters
              </p>
              <Link to="/">Scientific Atlas ↗</Link>
            </div>
            <div>
              <span>02 / GALAXY</span>
              <strong>PGC-linked measurements</strong>
              <p>
                Adopted quantities, observed values, errors and qualifiers in an
                individual record
              </p>
              <a href="#about-v6-object">M104 · matched galaxy record ↓</a>
            </div>
            <div>
              <span>03 / ENVIRONMENT</span>
              <strong>Groups and Main Disturbers</strong>
              <p>
                Membership, neighbouring systems and tidal diagnostics in the
                same nearby-galaxy domain
              </p>
              <Link to="/groups">Groups ↗</Link>
            </div>
          </div>
          <div className="about-v11-landscape about-v18-landscape">
            <div className="about-v11-landscape-head">
              <h3>Scientific data foundations</h3>
              <p>
                Each resource emphasizes a different part of extragalactic
                research: the galaxy census, compiled measurements, independent
                distances or population surveys
              </p>
            </div>
            <div className="about-v11-landscape-rows">
              <div>
                <strong>Nearby-galaxy census and environment</strong>
                <p>
                  The Updated Nearby Galaxy Catalog provides a nearby-galaxy
                  census with distances and tidal descriptors.{" "}
                  <ScienceCitation id="ungc" /> <ScienceCitation id="suites" />
                </p>
                <span>
                  LV LEDA: inspect a PGC selection together with the assigned
                  Main Disturber and explicit MD-suite hierarchy.
                </span>
              </div>
              <div>
                <strong>Identification and distances</strong>
                <p>
                  HyperLEDA compiles galaxy parameters across the extragalactic
                  domain; EDD supports distance measurements and comparisons.{" "}
                  <ScienceCitation id="hyperleda" />{" "}
                  <ScienceCitation id="edd" /> <ScienceCitation id="eddcmd" />
                </p>
                <span>
                  LV LEDA: examine adopted distances beside observed properties
                  and environmental assignments, retaining the source
                  qualifications.
                </span>
              </div>
              <div>
                <strong>Complementary nearby-Universe samples</strong>
                <p>
                  LVDB focuses on nearby dwarfs and stellar systems; HECATE
                  offers a multiwavelength nearby-galaxy compilation; NED-LVS
                  provides a much larger distance-based sample with completeness
                  analysis. <ScienceCitation id="lvdb" />{" "}
                  <ScienceCitation id="hecate" />{" "}
                  <ScienceCitation id="nedlvs" />
                </p>
                <span>
                  LV LEDA: a Local Volume-focused PGC → galaxy → group workflow.
                  Selection completeness must be evaluated independently.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="about-v6-section about-v6-catalogue-section about-v12-real-atlas about-v6-reveal"
          id="about-v6-sky"
          aria-labelledby="about-v6-sky-heading"
        >
          <nav
            className="about-v18-research-nav"
            aria-label="Steps in the M104 research example"
          >
            <a href="#about-v6-sky">01 · All-sky catalogue</a>
            <a href="#about-v6-object">02 · Galaxy M104</a>
            <a href="#about-v6-environment">03 · MD suite</a>
          </nav>
          <div className="about-v6-section-heading">
            <div>
              <span className="about-v6-overline">
                04A / CATALOGUE SELECTION
              </span>
              <h2 id="about-v6-sky-heading">
                Atlas selection and measured properties
              </h2>
            </div>
            <p>
              The Atlas displays the positions of galaxies and supports
              selections by distance, velocity, morphology and available
              environmental measurements. Each PGC identifier links the sky view
              to an individual galaxy record and the groups catalogue
            </p>
          </div>
          <LiveAtlasExample />
          <div className="about-v18-case-transition">
            <strong>M104 as a worked example</strong>
            <p>
              The Atlas shows the sky distribution of nearby galaxies. M104 (PGC
              42407) illustrates how an identified galaxy connects to its
              measurements and to the members of its Main Disturber suite
            </p>
            <a href="#about-v6-object">Examine the galaxy record ↓</a>
          </div>
          <p className="about-v12-atlas-science">
            The all-sky view illustrates the nearby-galaxy catalogue described
            by <ScienceCitation id="ungc" /> and <ScienceCitation id="cn2004" />
            . Comparing galaxy populations also requires knowledge of
            observational coverage
          </p>
        </section>

        <section
          className="about-v6-section about-v6-object-section about-v6-reveal"
          id="about-v6-object"
          aria-labelledby="about-v6-object-heading"
        >
          <div className="about-v6-section-heading">
            <div>
              <span className="about-v6-overline">04B / INDIVIDUAL GALAXY</span>
              <h2 id="about-v6-object-heading">Messier 104 in LV LEDA</h2>
            </div>
            <p>
              M104 (NGC 4594, PGC 42407) anchors the example shown here. Its
              galaxy record brings together sky position, photometry, adopted
              distance, velocity and derived physical parameters. The same
              identifier connects the individual record with the Main Disturber
              hierarchy illustrated below
            </p>
          </div>
          <div className="about-v17-galaxy-figure">
            <MatchedGalaxyCase />
          </div>
        </section>

        <section
          className="about-v6-section about-v6-environment-section about-v13-group-section about-v6-reveal"
          id="about-v6-environment"
          aria-labelledby="about-v6-environment-heading"
        >
          <div className="about-v6-environment-copy">
            <span className="about-v6-overline">04C / GROUP HIERARCHIES</span>
            <h2 id="about-v6-environment-heading">
              Main Disturbers and satellite systems
            </h2>
            <p>
              A Main Disturber suite groups galaxies according to their assigned
              tidal influence. Parent and Main Disturber relations form a
              hierarchy that can be inspected on the sky. Physical groups
              provide a separate membership definition for dynamical studies.{" "}
              <ScienceCitation id="suites" />{" "}
              <ScienceCitation id="groups2011" />
            </p>
            <p>
              The Group Page presents member galaxies, their measured properties
              and the complete hierarchy
            </p>
            <Link className="about-v6-primary-link" to="/groups">
              Explore nearby groups <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <GroupHierarchyCaseStudy />
        </section>

        <section
          className="about-v6-section about-v10-impact about-v13-problems about-v6-reveal"
          id="about-v6-method"
          aria-labelledby="about-v6-method-heading"
        >
          <div className="about-v10-impact-heading">
            <span className="about-v6-overline">05 / SCIENTIFIC QUESTIONS</span>
            <h2 id="about-v6-method-heading">
              Four problems in Local Volume astronomy
            </h2>
            <p>
              The catalogue supports studies of satellite luminosity functions,
              gas and star formation in dwarf galaxies, group dynamics and the
              local velocity field. Each problem calls for a defined sample and
              a treatment of the relevant measurement uncertainties
            </p>
          </div>
          <div className="about-v13-problem-list">
            <article className="about-v13-problem">
              <span>01 / LOW-MASS HALO OCCUPATION</span>
              <h3>Which dark-matter haloes host observable dwarfs?</h3>
              <p>
                The abundance and luminosity distributions of satellites differ
                among host galaxies. Nearby dwarf populations can be compared
                with ΛCDM predictions to investigate halo occupation and the
                efficiency of galaxy formation at low luminosities.{" "}
                <ScienceCitation id="smallscale" />{" "}
                <ScienceCitation id="elves" /> <ScienceCitation id="simon" />
              </p>
              <p className="about-v13-problem-data">
                <b>Analysis</b> Compare distance qualified satellite luminosity
                distributions for selected host PGCs. <b>Required evidence</b>{" "}
                Survey depth, footprints and detection completeness for each
                host
              </p>
            </article>
            <article className="about-v13-problem">
              <span>02 / DWARF-GALAXY TRANSFORMATION</span>
              <h3>How is star formation suppressed in low-mass galaxies?</h3>
              <p>
                The near-absence of quenched dwarfs in the low-mass field and
                the diverse histories of Local Group satellites motivate tests
                of environmental versus internal regulation. H I, morphology,
                Hα, FUV and distance measurements provide complementary
                constraints; they sample different physical conditions and
                timescales. <ScienceCitation id="quenching" />{" "}
                <ScienceCitation id="weisz" />{" "}
                <ScienceCitation id="weisz2015" />
              </p>
              <p className="about-v13-problem-data">
                <b>Analysis</b> Compare H I measurements, upper limits, FUV, Hα
                and morphology for dwarfs in the field and around nearby hosts.{" "}
                <b>Required evidence</b> Matched distance ranges and the
                sensitivity of each tracer
              </p>
            </article>
            <article className="about-v13-problem">
              <span>03 / GROUP MEMBERSHIP AND MASS</span>
              <h3>Which apparent associations are genuine galaxy systems?</h3>
              <p>
                Projected proximity, radial velocities and adopted distances
                constrain membership in different ways. MD suites and physical
                groups should be compared as distinct definitions before
                interpreting satellite statistics, dispersions or dynamical
                masses. <ScienceCitation id="suites" />{" "}
                <ScienceCitation id="groups2011" />{" "}
                <ScienceCitation id="ungc" />
              </p>
              <p className="about-v13-problem-data">
                <b>Analysis</b> Compare Main Disturber suites with physical
                groups using adopted distances and V<sub>LG</sub>.{" "}
                <b>Required evidence</b> Explicit membership criteria and
                velocity dispersion uncertainties for dynamical mass estimates
              </p>
            </article>
            <article className="about-v13-problem">
              <span>04 / LOCAL DYNAMICS</span>
              <h3>What do nearby deviations from the Hubble flow trace?</h3>
              <p>
                Redshift independent distances and velocities expressed in one
                reference frame reveal deviations from the smooth Hubble
                expansion. Quantitative flow analysis combines these
                measurements with a specified velocity model, distance
                uncertainties and the survey selection function.{" "}
                <ScienceCitation id="localflow2009" />{" "}
                <ScienceCitation id="cosmicflows" />{" "}
                <ScienceCitation id="edd" />
              </p>
              <p className="about-v13-problem-data">
                <b>Analysis</b> Export a sample with independent distances and
                Local Group velocities for a specified flow model.{" "}
                <b>Required evidence</b> Distance uncertainties, sample
                selection and a consistent velocity reference frame
              </p>
            </article>
          </div>
        </section>

        <section
          className="about-v6-section about-v11-future about-v6-reveal"
          id="about-v11-future"
          aria-labelledby="about-v11-future-heading"
        >
          <div className="about-v11-future-heading">
            <span className="about-v6-overline">
              06 / SCIENTIFIC DEVELOPMENT · OPEN ISSUES
            </span>
            <h2 id="about-v11-future-heading">Scientific development</h2>
            <p>
              The{" "}
              <a
                href="https://github.com/HyperLEDA/local-volume/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                development roadmap
              </a>{" "}
              covers catalogue improvements, scientific analysis, new
              observational resources and measurement provenance
            </p>
          </div>
          <div className="about-v11-roadmap-grid">
            <article>
              <span>ANALYSIS &amp; SAMPLES</span>
              <h3>Reproducible population studies</h3>
              <p>
                Link a fixed PGC sample to scientific diagrams, tables and
                exports, then validate cross-catalogue revisions and population
                workflows
              </p>
              <div className="about-v11-issue-links">
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/78"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Analysis ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/79"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Catalogue quality ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/83"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Galaxy populations ↗
                </a>
              </div>
            </article>
            <article>
              <span>SELECTION FUNCTIONS &amp; OBSERVATIONS</span>
              <h3>Connect the census to survey coverage</h3>
              <p>
                Measure survey footprints, masked area and published depth, with
                links to original image, spectroscopic and H I observation
                products
              </p>
              <div className="about-v11-issue-links">
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Survey coverage ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/81"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Observations ↗
                </a>
              </div>
            </article>
            <article>
              <span>DISTANCES &amp; SPATIAL STRUCTURE</span>
              <h3>Examine the geometry of nearby systems</h3>
              <p>
                Compare independent distance indicators and develop
                scientifically qualified group and supergalactic-space views
              </p>
              <div className="about-v11-issue-links">
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/82"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Distance methods ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/44"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Spatial structure ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/87"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Spatial atlas ↗
                </a>
              </div>
            </article>
            <article>
              <span>SCIENTIFIC EVIDENCE</span>
              <h3>Trace measurements and editorial decisions</h3>
              <p>
                Audit individual source measurements, define the reviewed
                evidence model and expose a read-only measurement history at the
                parameter level
              </p>
              <div className="about-v11-issue-links">
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/90"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Measurement evidence ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/93"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Measurement sources ↗
                </a>
                <a
                  href="https://github.com/HyperLEDA/local-volume/issues/95"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Catalogue history ↗
                </a>
              </div>
            </article>
          </div>
          <p className="about-v11-roadmap-foot">
            <a
              href="https://github.com/HyperLEDA/local-volume/issues/85"
              target="_blank"
              rel="noopener noreferrer"
            >
              About LV LEDA development ↗
            </a>
          </p>
        </section>

        <section
          className="about-v10-explore"
          aria-labelledby="about-v10-explore-heading"
        >
          <div>
            <span className="about-v6-overline">EXPLORE LV LEDA</span>
            <h2 id="about-v10-explore-heading">Explore LV LEDA</h2>
            <p>
              Open the Scientific Atlas, examine the M104 galaxy record or
              explore nearby groups
            </p>
          </div>
          <nav
            className="about-v11-open-science"
            aria-label="Open working LV LEDA scientific tools"
          >
            <Link to="/">
              <span>01</span>
              <strong>Scientific Atlas</strong>
              <small>All-sky catalogue, PGC selections and export</small>
              <b aria-hidden="true">↗</b>
            </Link>
            <Link to="/object/42407">
              <span>02</span>
              <strong>Galaxy record</strong>
              <small>Messier 104 · PGC 42407</small>
              <b aria-hidden="true">↗</b>
            </Link>
            <Link to="/groups">
              <span>03</span>
              <strong>Nearby groups</strong>
              <small>Membership, main disturbers and diagnostics</small>
              <b aria-hidden="true">↗</b>
            </Link>
          </nav>
        </section>
        <footer className="about-v6-footer">
          <div>
            <span className="about-v6-overline">
              LV LEDA · SCIENTIFIC RESOURCES
            </span>
            <p>
              Cite the catalogue selection, adopted distance indicators and
              primary measurement references in scientific work
            </p>
          </div>
          <nav aria-label="Scientific resources">
            <Link to="/documents">Scientific Handbook ↗</Link>
            <Link to="/publications">Publications ↗</Link>
            <Link to="/acknowledgements">Acknowledgements ↗</Link>
          </nav>
        </footer>
      </article>
    </main>
  );
}
