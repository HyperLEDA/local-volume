import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchObject,
  fetchObjects,
  nameIncludesPgc,
  parameterRows,
  type CatalogObject,
  type CatalogObjectDetail,
  type ColumnMeta,
} from "../api/objects.ts";
import { AladinMap, type SkyFocus } from "../components/AladinMap.tsx";
import { ObjectCoordinates } from "../components/ObjectCoordinates.tsx";
import { ObservedParameterCards } from "../components/ObservedParameterCards.tsx";
import { objectFovDegrees } from "../lib/objectFov.ts";
import { otherSkyObjects } from "../lib/skyContext.ts";

export function ObjectPage() {
  const { pgc: pgcParam } = useParams<{ pgc: string }>();
  const pgc = Number(pgcParam);
  const [data, setData] = useState<CatalogObjectDetail | null>(null);
  const [schema, setSchema] = useState<Record<string, ColumnMeta> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skyCatalog, setSkyCatalog] = useState<CatalogObject[]>([]);
  const [skyCatalogError, setSkyCatalogError] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(pgc)) {
      setError("Object not found");
      setData(null);
      setSchema(null);
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await fetchObject(pgc);
        if (!cancelled) {
          setData(response.data);
          setSchema(response.schema);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setSchema(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load object",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [pgc]);

  useEffect(() => {
    let cancelled = false;

    async function loadSkyCatalog(): Promise<void> {
      try {
        const objects = await fetchObjects();
        if (!cancelled) {
          setSkyCatalog(objects);
          setSkyCatalogError(false);
        }
      } catch {
        if (!cancelled) {
          setSkyCatalog([]);
          setSkyCatalogError(true);
        }
      }
    }

    void loadSkyCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const contextObjects = useMemo(
    () =>
      otherSkyObjects(
        skyCatalog,
        pgc,
        data !== null &&
          typeof data.ra === "number" &&
          typeof data.dec === "number"
          ? { ra: data.ra, dec: data.dec }
          : null,
        10,
      ),
    [skyCatalog, pgc, data],
  );

  const rows = useMemo(() => {
    if (data === null || schema === null) {
      return [];
    }
    return parameterRows(data, schema);
  }, [data, schema]);

  const mapObjects = useMemo(() => {
    if (data === null) {
      return [];
    }
    return [
      {
        pgc: data.pgc,
        name: data.name,
        ra: data.ra ?? null,
        dec: data.dec ?? null,
        bt: data.bt ?? null,
        b_mag: data.b_mag ?? null,
        ks_mag: data.ks_mag ?? null,
        v_hel: data.v_hel ?? null,
        lvg_v_hel_kms: data.lvg_v_hel_kms ?? null,
        type_name: data.type_name ?? null,
        a26_arcmin: data.a26_arcmin ?? null,
        morphology_t: data.morphology_t ?? null,
        w50_kms: data.w50_kms ?? null,
        names: data.names,
      },
    ];
  }, [data]);

  const focus = useMemo((): SkyFocus | null => {
    if (
      data === null ||
      typeof data.ra !== "number" ||
      typeof data.dec !== "number"
    ) {
      return null;
    }
    return { ra: data.ra, dec: data.dec, requestId: data.pgc };
  }, [data]);

  return (
    <main className="catalog catalog--object">
      {error !== null ? (
        <p className="catalog-status catalog-status-error">{error}</p>
      ) : null}
      {data === null && error === null ? (
        <p className="catalog-status">Loading object…</p>
      ) : null}
      {data !== null ? (
        <>
          <div
            className={
              focus === null
                ? "object-layout object-layout--no-map"
                : "object-layout"
            }
          >
            {focus !== null ? (
              <section className="catalog-sky" aria-label="Sky">
                <AladinMap
                  objects={mapObjects}
                  contextObjects={contextObjects}
                  focus={focus}
                  fov={objectFovDegrees(data)}
                />
                {skyCatalogError ? (
                  <p className="catalog-status" role="status">
                    Other catalog objects could not be loaded.
                  </p>
                ) : null}
              </section>
            ) : null}
            <div className="object-details">
              <section className="object-identity" aria-label="Object">
                <div className="object-title-row">
                  <h2 className="object-title">{data.name}</h2>
                  <a
                    className="object-hyperleda-link"
                    href={`https://leda.sao.ru/object/${data.pgc}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    HyperLEDA
                  </a>
                  {data.type_name?.trim() ? (
                    <span className="object-nature" title="Object type">
                      {data.type_name}
                    </span>
                  ) : null}
                </div>
                {!nameIncludesPgc(data.name, data.pgc) ? (
                  <p className="object-pgc">PGC {data.pgc}</p>
                ) : null}
                {data.names.length > 0 ? (
                  <ul className="object-aliases">
                    {data.names.map((alias) => (
                      <li key={alias}>{alias}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
              <ObjectCoordinates object={data} />
              <ObservedParameterCards rows={rows} />
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
