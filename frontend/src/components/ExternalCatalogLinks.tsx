import { externalCatalogLinks } from "../lib/externalCatalogs.ts";

export function ExternalCatalogLinks({ pgc }: { pgc: number }) {
  const links = externalCatalogLinks(pgc);
  if (!links) return null;
  return (
    <div
      className="object-external-catalogs"
      aria-label="External catalogue identifier searches"
    >
      <span className="object-external-label">External catalogues</span>
      <div className="object-external-links">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.name} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}
