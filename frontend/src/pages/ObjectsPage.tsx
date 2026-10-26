import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchObjects,
  matchesQuery,
  type CatalogObject,
} from "../api/objects.ts";
import { AladinMap, type SkyFocus } from "../components/AladinMap.tsx";
import { ObjectCard } from "../components/ObjectCard.tsx";
import saoLogo from "../images/sao.png";

export function ObjectsPage() {
  const [query, setQuery] = useState("");
  const [objects, setObjects] = useState<CatalogObject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<SkyFocus | null>(null);
  const focusRequestId = useRef(0);

  function locate(object: CatalogObject): void {
    if (object.ra === null || object.dec === null) {
      return;
    }
    focusRequestId.current += 1;
    setFocus({
      ra: object.ra,
      dec: object.dec,
      requestId: focusRequestId.current,
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const rows = await fetchObjects();
        if (!cancelled) {
          setObjects(rows);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load objects",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (objects === null) {
      return [];
    }
    return objects.filter((object) => matchesQuery(object, query));
  }, [objects, query]);

  return (
    <main className="catalog">
      <header className="catalog-header">
        <h1>Catalog & Atlas of the LV galaxies</h1>
        <a className="catalog-logo" href="https://www.sao.ru">
          <img src={saoLogo} alt="SAO" />
        </a>
      </header>
      <input
        className="catalog-search"
        type="search"
        value={query}
        placeholder="Filter by PGC or name…"
        aria-label="Filter objects"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {error !== null ? (
        <p className="catalog-status catalog-status-error">{error}</p>
      ) : null}
      {objects === null && error === null ? (
        <p className="catalog-status">Loading catalog…</p>
      ) : null}
      {objects !== null ? (
        <>
          <section className="catalog-sky" aria-label="Sky">
            <AladinMap objects={filtered} focus={focus} />
          </section>
          <section className="catalog-list" aria-label="Objects">
            <p className="catalog-count">
              {filtered.length} of {objects.length}
            </p>
            {filtered.length === 0 ? (
              <p className="catalog-status">No objects match “{query}”.</p>
            ) : (
              <div className="object-grid">
                {filtered.map((object) => (
                  <ObjectCard
                    key={object.pgc}
                    object={object}
                    onLocate={locate}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
