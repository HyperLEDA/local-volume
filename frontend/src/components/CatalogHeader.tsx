import { Link, useLocation } from "react-router-dom";
import saoLogo from "../images/sao.png";
import ledaLogo from "../images/leda.png";
import ledaDarkLogo from "../images/leda-dark.png";

export function CatalogHeader() {
  const pathname = useLocation().pathname;
  const isOverview = pathname === "/";
  const isGroupDetail = /^\/groups\/\d+\/?$/.test(pathname);
  return (
    <header className={`catalog-header${isGroupDetail ? " catalog-header--group" : ""}`}>
      {isGroupDetail && (
        <Link className="catalog-header-back" to="/groups">← Groups</Link>
      )}
      <a
        className="catalog-logo catalog-logo--sao"
        href="https://www.sao.ru"
        aria-label="SAO website"
      >
        <img src={saoLogo} alt="SAO" />
      </a>
      <h1 className={isOverview ? "catalog-header-title--atlas" : undefined}>
        <Link to="/">
          {isOverview ? (
            <>
              <span className="catalog-title-main">LV LEDA</span>
              <span className="catalog-title-subtitle">
                Galaxies of the Nearby Universe
              </span>
            </>
          ) : (
            "Catalog & Atlas of the LV galaxies"
          )}
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
    </header>
  );
}
