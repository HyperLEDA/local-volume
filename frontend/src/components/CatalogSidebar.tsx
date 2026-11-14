import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Theme = "light" | "dark";

export function parseSavedTheme(value: string | null): Theme {
  return value === "light" ? "light" : "dark";
}

function AtlasIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

function PublicationsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 6.5c-2.3-1.7-5.3-1.9-9-1v13c3.7-.9 6.7-.7 9 1 2.3-1.7 5.3-1.9 9-1v-13c-3.7-.9-6.7-.7-9 1Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === "light" ? (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1a8.5 8.5 0 1 0 10 10Z" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function initialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }
  try {
    return parseSavedTheme(window.localStorage.getItem("lv-theme"));
  } catch {
    return "dark";
  }
}

export function CatalogSidebar() {
  const { pathname } = useLocation();
  const atlasActive = pathname === "/" || pathname.startsWith("/object/");
  const publicationsActive = pathname === "/publications";
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("lv-theme", theme);
    } catch {
      // Storage may be blocked; the current session still supports switching.
    }
  }, [theme]);

  return (
    <aside className="catalog-sidebar" aria-label="Site navigation">
      <nav className="catalog-nav" aria-label="Primary navigation">
        <Link
          to="/"
          className="catalog-nav-link"
          aria-label="Atlas"
          aria-current={atlasActive ? "page" : undefined}
        >
          <AtlasIcon />
          <span className="catalog-nav-tooltip" aria-hidden="true">
            Atlas
          </span>
        </Link>
      </nav>
      <nav
        className="catalog-nav catalog-nav--footer"
        aria-label="Secondary navigation"
      >
        <Link
          to="/publications"
          className="catalog-nav-link"
          aria-label="Publications"
          aria-current={publicationsActive ? "page" : undefined}
        >
          <PublicationsIcon />
          <span className="catalog-nav-tooltip" aria-hidden="true">
            Publications
          </span>
        </Link>
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
          <ThemeIcon theme={theme} />
          <span className="catalog-nav-tooltip" aria-hidden="true">
            {theme === "light" ? "Dark theme" : "Light theme"}
          </span>
        </button>
      </nav>
    </aside>
  );
}
