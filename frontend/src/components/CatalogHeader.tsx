import { Link, useLocation } from "react-router-dom";
import {
  collectionNeighbors,
  loadCollection,
  markCollectionReturn,
} from "../lib/collectionNavigation.ts";
import { groupBrowseNeighbors, loadGroupBrowse } from "../lib/groupBrowsing.ts";
import saoLogo from "../images/sao.png";
import ledaLogo from "../images/leda.png";
import ledaDarkLogo from "../images/leda-dark.png";

type HeaderContext = {
  backHref: string;
  backLabel: string;
  scrollY: number | null;
  index: number | null;
  total: number | null;
  previousHref: string | null;
  nextHref: string | null;
};

function galaxyHref(id: number, token: string): string {
  return `/object/${id}?nav=${encodeURIComponent(token)}`;
}

function groupHref(
  id: number,
  definition: "physical" | "suite",
  token: string,
): string {
  return `/groups/${id}?definition=${definition}&browse=${encodeURIComponent(token)}`;
}

/** Resolve context from one short URL token, with safe direct-URL fallbacks. */
export function resolveHeaderContext(
  pathname: string,
  search: string,
): HeaderContext | null {
  const objectMatch = /^\/object\/([1-9]\d*)\/?$/.exec(pathname);
  const groupMatch = /^\/groups\/([1-9]\d*)\/?$/.exec(pathname);
  const params = new URLSearchParams(search);
  if (objectMatch) {
    const pgc = Number(objectMatch[1]);
    const token = params.get("nav");
    if (!Number.isSafeInteger(pgc)) return null;
    const context = loadCollection(token);
    const neighbors = collectionNeighbors(context, pgc);
    if (!context || !neighbors || !token) return null;
    const navigationToken: string = token;
    return {
      backHref: context.returnTo,
      backLabel: `Back to ${context.label}`,
      scrollY: context.scrollY,
      index: neighbors.index,
      total: context.pgcs.length,
      previousHref:
        neighbors.previous === null
          ? null
          : galaxyHref(neighbors.previous, navigationToken),
      nextHref:
        neighbors.next === null
          ? null
          : galaxyHref(neighbors.next, navigationToken),
    };
  }
  if (groupMatch) {
    const rootPgc = Number(groupMatch[1]);
    if (!Number.isSafeInteger(rootPgc)) return null;
    const definition =
      params.get("definition") === "suite" ? "suite" : "physical";
    const token = params.get("browse");
    const context = loadGroupBrowse(token);
    const neighbors = groupBrowseNeighbors(context, rootPgc, definition);
    if (!context || !neighbors || !token) {
      return {
        backHref: `/groups?definition=${definition}`,
        backLabel: "Back to Groups",
        scrollY: null,
        index: null,
        total: null,
        previousHref: null,
        nextHref: null,
      };
    }
    const browseToken: string = token;
    return {
      backHref: context.returnTo,
      backLabel: "Back to Groups",
      scrollY: context.scrollY,
      index: neighbors.index,
      total: context.entries.length,
      previousHref:
        neighbors.previous === null
          ? null
          : groupHref(neighbors.previous, definition, browseToken),
      nextHref:
        neighbors.next === null
          ? null
          : groupHref(neighbors.next, definition, browseToken),
    };
  }
  return null;
}

function NeighborLink({
  href,
  direction,
}: {
  href: string | null;
  direction: "previous" | "next";
}) {
  const label = direction === "previous" ? "Previous" : "Next";
  const arrow = direction === "previous" ? "←" : "→";
  const text =
    direction === "previous" ? (
      <>
        {arrow} <span className="catalog-header-action-text">{label}</span>
      </>
    ) : (
      <>
        <span className="catalog-header-action-text">{label}</span> {arrow}
      </>
    );
  if (href === null) {
    return (
      <button type="button" disabled aria-label={label}>
        {text}
      </button>
    );
  }
  return (
    <Link
      to={href}
      aria-label={label}
      rel={direction === "previous" ? "prev" : "next"}
    >
      {text}
    </Link>
  );
}

export function CatalogHeader() {
  const { pathname, search } = useLocation();
  const atlasActive = pathname === "/" || pathname.startsWith("/object/");
  const groupsActive =
    pathname === "/groups" || pathname.startsWith("/groups/");
  const documentsActive = pathname === "/documents";
  const acknowledgementsActive = pathname === "/acknowledgements";
  const context = resolveHeaderContext(pathname, search);

  return (
    <header
      className={`catalog-header catalog-header--unified${context ? " catalog-header--contextual" : ""}`}
    >
      <div className="catalog-header-edge catalog-header-edge--left">
        {context && (
          <Link
            to={context.backHref}
            aria-label={context.backLabel}
            title={context.backLabel}
            className="catalog-header-context-back"
            onClick={() => {
              if (context.scrollY !== null)
                markCollectionReturn(context.scrollY);
            }}
          >
            ←{" "}
            <span className="catalog-header-action-text">
              {context.backLabel}
            </span>
          </Link>
        )}
        <nav
          className="catalog-header-quicknav catalog-header-quicknav--left"
          aria-label="Main sections"
        >
          <Link to="/" aria-current={atlasActive ? "page" : undefined}>
            Atlas
          </Link>
          <Link to="/groups" aria-current={groupsActive ? "page" : undefined}>
            Groups
          </Link>
        </nav>
      </div>
      <div className="catalog-header-identity">
        <a
          className="catalog-logo catalog-logo--sao"
          href="https://www.sao.ru"
          aria-label="SAO website"
        >
          <img src={saoLogo} alt="SAO" />
        </a>
        <h1 className="catalog-header-title--atlas">
          <Link to="/">
            <span className="catalog-title-main">LV LEDA</span>
            <span className="catalog-title-subtitle">
              Galaxies of the Nearby Universe
            </span>
          </Link>
        </h1>
        <a
          className="catalog-logo catalog-logo--leda"
          href="https://leda.sao.ru/"
          aria-label="LEDA website"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img className="leda-logo-light" src={ledaLogo} alt="LEDA" />
          <img
            className="leda-logo-dark"
            src={ledaDarkLogo}
            alt=""
            aria-hidden="true"
          />
        </a>
      </div>
      <div className="catalog-header-edge catalog-header-edge--right">
        <nav
          className="catalog-header-quicknav catalog-header-quicknav--right"
          aria-label="Reference sections"
        >
          <Link
            to="/documents"
            aria-current={documentsActive ? "page" : undefined}
          >
            Documents
          </Link>
          <Link
            to="/acknowledgements"
            aria-current={acknowledgementsActive ? "page" : undefined}
          >
            Acknowledgements
          </Link>
        </nav>
        {context && context.index !== null && context.total !== null && (
          <nav
            className="catalog-header-context-steps"
            aria-label="Collection navigation"
          >
            <span className="catalog-header-context-position">
              {context.index + 1} / {context.total}
            </span>
            <NeighborLink href={context.previousHref} direction="previous" />
            <NeighborLink href={context.nextHref} direction="next" />
          </nav>
        )}
      </div>
    </header>
  );
}
