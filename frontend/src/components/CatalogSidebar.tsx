import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  loadGroupsPage,
  loadPublicationsPage,
  loadAcknowledgementsPage,
  loadDocumentsPage,
  preloadPage,
} from "../pageLoaders.ts";

type Theme = "light" | "dark";
type NavIcon =
  "atlas" | "groups" | "documents" | "publications" | "acknowledgements";
type NavItem = {
  to: string;
  label: string;
  active: boolean;
  icon: NavIcon;
  preload?: () => Promise<unknown>;
};
export function parseSavedTheme(value: string | null): Theme {
  return value === "light" ? "light" : "dark";
}

function NavigationIcon({
  name,
}: {
  name: NavIcon | "theme-sun" | "theme-moon";
}) {
  // Identical geometry and stroke language for each navigation glyph.
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      {...common}
    >
      {name === "atlas" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4.5" ry="9" />
          <path d="M3 12h18M5.4 6.5h13.2M5.4 17.5h13.2" />
        </>
      ) : name === "groups" ? (
        <>
          <circle cx="5" cy="12" r="2.3" />
          <circle cx="18.5" cy="5" r="2.3" />
          <circle cx="18.5" cy="19" r="2.3" />
          <path d="M7.3 11 16.2 6.1M7.3 13 16.2 17.9M18.5 7.3v9.4" />
        </>
      ) : name === "documents" ? (
        <>
          <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5M8.5 12h7M8.5 16h7" />
        </>
      ) : name === "publications" ? (
        <>
          <path d="M12 6.5c-2.3-1.7-5.3-1.9-9-1v13c3.7-.9 6.7-.7 9 1 2.3-1.7 5.3-1.9 9-1v-13c-3.7-.9-6.7-.7-9 1Z" />
          <path d="M12 6.5v13" />
        </>
      ) : name === "acknowledgements" ? (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      ) : name === "theme-sun" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <>
          <path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1a8.5 8.5 0 1 0 10 10Z" />
        </>
      )}
    </svg>
  );
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return parseSavedTheme(window.localStorage.getItem("lv-theme"));
  } catch {
    return "dark";
  }
}

export function CatalogSidebar() {
  const { pathname } = useLocation();
  const atlasActive = pathname === "/" || pathname.startsWith("/object/");
  const groupsActive =
    pathname === "/groups" || pathname.startsWith("/groups/");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [expanded, setExpanded] = useState(false);
  const sidebar = useRef<HTMLElement | null>(null);
  const suppressFocusOpen = useRef(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("lv-theme", theme);
    } catch {
      /* optional */
    }
  }, [theme]);
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);
  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: PointerEvent) {
      if (!sidebar.current?.contains(event.target as Node)) setExpanded(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [expanded]);

  const scientific: NavItem[] = [
    {
      to: "/",
      label: "Atlas",
      active: atlasActive,
      icon: "atlas" as const,
      preload: undefined,
    },
    {
      to: "/groups",
      label: "Groups",
      active: groupsActive,
      icon: "groups" as const,
      preload: loadGroupsPage,
    },
  ];
  const supporting: NavItem[] = [
    {
      to: "/publications",
      label: "Publications",
      active: pathname === "/publications",
      icon: "publications" as const,
      preload: loadPublicationsPage,
    },
    {
      to: "/documents",
      label: "Documents",
      active: pathname === "/documents",
      icon: "documents" as const,
      preload: loadDocumentsPage,
    },
    {
      to: "/acknowledgements",
      label: "Acknowledgements",
      active: pathname === "/acknowledgements",
      icon: "acknowledgements" as const,
      preload: loadAcknowledgementsPage,
    },
  ];
  function railLink(item: NavItem) {
    return (
      <Link
        key={item.to}
        to={item.to}
        className="catalog-nav-link"
        aria-label={item.label}
        aria-current={item.active ? "page" : undefined}
        onMouseEnter={() => {
          if (item.preload) void preloadPage(item.preload);
        }}
        onFocus={() => {
          if (item.preload) void preloadPage(item.preload);
        }}
        onTouchStart={() => {
          if (item.preload) void preloadPage(item.preload);
        }}
      >
        <NavigationIcon name={item.icon} />
        <span className="catalog-nav-tooltip" aria-hidden="true">
          {item.label}
        </span>
      </Link>
    );
  }
  return (
    <aside
      ref={sidebar}
      className={`catalog-sidebar scientific-sidebar${expanded ? " is-expanded" : ""}`}
      aria-label="Site navigation"
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches)
          setExpanded(true);
      }}
      onMouseLeave={() => {
        const preview = sidebar.current?.querySelector(
          ".scientific-sidebar-flyout",
        );
        if (!preview?.contains(document.activeElement)) setExpanded(false);
      }}
      onFocus={(event) => {
        if (suppressFocusOpen.current) {
          suppressFocusOpen.current = false;
          return;
        }
        if (event.target.closest(".catalog-nav-link")) setExpanded(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setExpanded(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.preventDefault();
          setExpanded(false);
          if (
            event.target instanceof Element &&
            event.target.closest(".scientific-sidebar-flyout")
          ) {
            suppressFocusOpen.current = true;
            sidebar.current
              ?.querySelector<HTMLElement>(".catalog-nav-link")
              ?.focus();
          }
        }
      }}
    >
      <nav className="catalog-nav" aria-label="Primary navigation">
        {scientific.map(railLink)}
      </nav>
      <nav
        className="catalog-nav catalog-nav--footer"
        aria-label="Secondary navigation"
      >
        {supporting.map(railLink)}
        <button
          type="button"
          className="catalog-nav-link catalog-theme-toggle"
          aria-label={
            theme === "light" ? "Switch to dark theme" : "Switch to light theme"
          }
          aria-pressed={theme === "dark"}
          onClick={() =>
            setTheme((current) => (current === "light" ? "dark" : "light"))
          }
        >
          <NavigationIcon
            name={theme === "light" ? "theme-moon" : "theme-sun"}
          />
          <span className="catalog-nav-tooltip" aria-hidden="true">
            {theme === "light" ? "Dark theme" : "Light theme"}
          </span>
        </button>
      </nav>
      <button
        type="button"
        className="scientific-mobile-more"
        aria-label="More navigation destinations"
        aria-expanded={expanded}
        aria-controls="scientific-sidebar-flyout"
        onClick={() => setExpanded((was) => !was)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </svg>
        <span>More</span>
      </button>
      <div
        className="scientific-sidebar-flyout"
        id="scientific-sidebar-flyout"
        aria-label="Navigation preview"
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="scientific-sidebar-flyout-heading">Explore LV LEDA</div>
        <nav
          className="scientific-sidebar-cards"
          aria-label="Scientific sections"
        >
          <Link
            to="/"
            className="scientific-sidebar-card"
            aria-current={atlasActive ? "page" : undefined}
          >
            <span className="scientific-sidebar-card-text">
              <strong>Scientific Atlas</strong>
              <small>Objects and sky selection</small>
            </span>
            <img
              loading="lazy"
              decoding="async"
              src="https://cdn.esahubble.org/archives/images/screen/heic0710a.jpg"
              alt=""
            />
          </Link>
          <Link
            to="/groups"
            className="scientific-sidebar-card"
            aria-current={groupsActive ? "page" : undefined}
          >
            <span className="scientific-sidebar-card-text">
              <strong>Groups</strong>
              <small>Membership and environment</small>
            </span>
            <img
              loading="lazy"
              decoding="async"
              src="https://cdn.esahubble.org/archives/images/screen/heic0801i.jpg"
              alt=""
            />
          </Link>
        </nav>
        <div className="scientific-sidebar-credits">
          <span>Images:</span>
          <span>M81 (HST): NASA/ESA/STScI</span>
          <span>M81/M82: NASA/ESA/Z. Levay/R. Gendler</span>
        </div>
        <nav className="scientific-sidebar-secondary" aria-label="Resources">
          {supporting.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={item.active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() =>
              setTheme((current) => (current === "light" ? "dark" : "light"))
            }
          >
            {theme === "light" ? "Dark theme" : "Light theme"}
          </button>
        </nav>
      </div>
    </aside>
  );
}
