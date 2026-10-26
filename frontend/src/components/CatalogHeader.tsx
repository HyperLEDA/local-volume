import { Link } from "react-router-dom";
import saoLogo from "../images/sao.png";

type CatalogHeaderProps = {
  titleLinksHome?: boolean;
};

export function CatalogHeader({ titleLinksHome = false }: CatalogHeaderProps) {
  const title = "Catalog & Atlas of the LV galaxies";

  return (
    <header className="catalog-header">
      <h1>{titleLinksHome ? <Link to="/">{title}</Link> : title}</h1>
      <a className="catalog-logo" href="https://www.sao.ru">
        <img src={saoLogo} alt="SAO" />
      </a>
    </header>
  );
}
