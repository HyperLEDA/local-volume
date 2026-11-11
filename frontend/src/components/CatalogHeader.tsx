import { Link } from "react-router-dom";
import saoLogo from "../images/sao.png";
import ledaLogo from "../images/leda.png";
import ledaDarkLogo from "../images/leda-dark.png";

export function CatalogHeader() {
  return (
    <header className="catalog-header">
      <a
        className="catalog-logo catalog-logo--sao"
        href="https://www.sao.ru"
        aria-label="SAO website"
      >
        <img src={saoLogo} alt="SAO" />
      </a>
      <h1>
        <Link to="/">Catalog & Atlas of the LV galaxies</Link>
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
