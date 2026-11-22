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
import { ObjectMeasurementExports } from "../components/ObjectMeasurementExports.tsx";
import { ExternalCatalogLinks } from "../components/ExternalCatalogLinks.tsx";
import { ObservedParameterCards } from "../components/ObservedParameterCards.tsx";
import { PhysicalParametersTable } from "../components/PhysicalParametersTable.tsx";
import { objectFovDecision } from "../lib/objectFov.ts";
import {
  projectedScaleLabel,
  type GalaxyAngularScale,
} from "../lib/galaxyAngularScale.ts";
import { otherSkyObjects } from "../lib/skyContext.ts";
import {
  GALAXY_SURVEYS,
  galaxySurvey,
  type GalaxySurveyKey,
} from "../lib/galaxySurveys.ts";
import "../components/galaxySurveyControls.css";

const SURVEY_BUTTON_LABELS: Record<GalaxySurveyKey, string> = {
  dss2: "DSS2",
  galex: "GALEX",
  "2mass": "2MASS",
  allwise: "AllWISE",
};

export function ObjectPage() {
  const { pgc: pgcParam } = useParams<{ pgc: string }>();
  const pgc = Number(pgcParam);
  const [data, setData] = useState<CatalogObjectDetail | null>(null);
  const [schema, setSchema] = useState<Record<string, ColumnMeta> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skyCatalog, setSkyCatalog] = useState<CatalogObject[]>([]);
  const [skyCatalogError, setSkyCatalogError] = useState(false);
  const [surveyKey, setSurveyKey] = useState<GalaxySurveyKey>("dss2");
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const survey = galaxySurvey(surveyKey);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [comparisonSurveyKey, setComparisonSurveyKey] =
    useState<GalaxySurveyKey>("galex");
  const [comparisonOpacityPercent, setComparisonOpacityPercent] = useState(50);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [angularScale, setAngularScale] = useState<GalaxyAngularScale | null>(
    null,
  );
  useEffect(() => setAngularScale(null), [pgc]);
  const comparisonSurvey = galaxySurvey(comparisonSurveyKey);

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

  const initialFov = data === null ? null : objectFovDecision(data);
  // The detail API does not expose the adopted distance; use the matching
  // canonical PGC from the actual catalogue list. Never invent a distance.
  const scaleDistance =
    data === null
      ? null
      : (skyCatalog.find((row) => row.pgc === data.pgc) ?? null);
  const projectedScale =
    angularScale === null
      ? null
      : projectedScaleLabel(angularScale.arcmin, scaleDistance?.dist ?? null);
  const compactProjectedScale =
    projectedScale?.replace(/ projected$/, "") ?? null;

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
                <div className="galaxy-sky-view">
                  <AladinMap
                    objects={mapObjects}
                    contextObjects={contextObjects}
                    focus={focus}
                    fov={initialFov?.degrees}
                    onDetailScaleChange={setAngularScale}
                    detailSurveyId={survey.hips}
                    onDetailSurveyError={setSurveyError}
                    detailOverlaySurveyId={
                      comparisonEnabled ? comparisonSurvey.hips : null
                    }
                    detailOverlayOpacity={comparisonOpacityPercent / 100}
                    onDetailOverlayError={setComparisonError}
                  />
                  {angularScale !== null && (
                    <div
                      className="galaxy-angular-scale"
                      role="img"
                      aria-label={
                        `Angular scale ${angularScale.angleLabel}` +
                        (projectedScale !== null && scaleDistance !== null
                          ? `, approximately ${projectedScale} at adopted distance ${scaleDistance.dist} Mpc` +
                            (scaleDistance.distance_method
                              ? ` (${scaleDistance.distance_method})`
                              : "")
                          : "")
                      }
                    >
                      <span
                        className="galaxy-angular-scale-ruler"
                        style={{ width: angularScale.pixels }}
                        aria-hidden="true"
                      />
                      <span
                        className="galaxy-angular-scale-label"
                        aria-hidden="true"
                      >
                        {angularScale.angleLabel}
                        {compactProjectedScale !== null
                          ? ` ≈ ${compactProjectedScale}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
                <div className="galaxy-survey-controls">
                  <span
                    className="galaxy-survey-label"
                    id="galaxy-survey-label"
                  >
                    Sky survey
                  </span>
                  <div
                    className="galaxy-survey-choices"
                    role="group"
                    aria-labelledby="galaxy-survey-label"
                  >
                    {GALAXY_SURVEYS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        aria-label={item.label}
                        aria-pressed={surveyKey === item.key}
                        onClick={() => {
                          setSurveyError(null);
                          setSurveyKey(item.key);
                          // Keep the comparison meaningful when the base is changed.
                          if (comparisonSurveyKey === item.key) {
                            setComparisonSurveyKey(
                              item.key === "dss2" ? "galex" : "dss2",
                            );
                          }
                        }}
                      >
                        {SURVEY_BUTTON_LABELS[item.key]}
                      </button>
                    ))}
                  </div>
                  <div className="galaxy-survey-meta">
                    <span>{survey.bands}</span>
                    <span>{survey.source}</span>
                  </div>
                  {surveyError ? <p role="alert">{surveyError}</p> : null}
                  <div className="galaxy-comparison">
                    <label className="galaxy-comparison-toggle">
                      <input
                        type="checkbox"
                        checked={comparisonEnabled}
                        onChange={(event) => {
                          setComparisonError(null);
                          setComparisonEnabled(event.currentTarget.checked);
                        }}
                      />
                      Compare surveys
                    </label>
                    {comparisonEnabled ? (
                      <div className="galaxy-comparison-panel">
                        <span
                          className="galaxy-comparison-heading"
                          id="galaxy-comparison-heading"
                        >
                          Overlay survey
                        </span>
                        <div
                          className="galaxy-survey-choices"
                          role="group"
                          aria-labelledby="galaxy-comparison-heading"
                        >
                          {GALAXY_SURVEYS.filter(
                            (item) => item.key !== surveyKey,
                          ).map((item) => (
                            <button
                              type="button"
                              key={item.key}
                              aria-label={`Overlay: ${item.label}`}
                              aria-pressed={comparisonSurveyKey === item.key}
                              onClick={() => {
                                setComparisonError(null);
                                setComparisonSurveyKey(item.key);
                              }}
                            >
                              {SURVEY_BUTTON_LABELS[item.key]}
                            </button>
                          ))}
                        </div>
                        <label htmlFor="galaxy-comparison-opacity">
                          Overlay opacity
                        </label>
                        <input
                          id="galaxy-comparison-opacity"
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={comparisonOpacityPercent}
                          onChange={(event) =>
                            setComparisonOpacityPercent(
                              Number(event.currentTarget.value),
                            )
                          }
                        />
                        <output htmlFor="galaxy-comparison-opacity">
                          {comparisonOpacityPercent}%
                        </output>
                        <div className="galaxy-survey-meta galaxy-comparison-meta">
                          <span>{comparisonSurvey.bands}</span>
                          <span>{comparisonSurvey.source}</span>
                        </div>
                      </div>
                    ) : null}
                    {comparisonError ? (
                      <p role="alert">{comparisonError}</p>
                    ) : null}
                  </div>
                </div>
                {initialFov?.note ? (
                  <p className="catalog-status" role="status">
                    {initialFov.note}
                  </p>
                ) : null}
                <ExternalCatalogLinks pgc={data.pgc} />
                {skyCatalogError ? (
                  <p className="catalog-status" role="status">
                    Other catalog objects could not be loaded.
                  </p>
                ) : null}
              </section>
            ) : null}
            <div className="object-details">
              <section className="object-identity" aria-label="Object">
                <div
                  className="object-title-row"
                  style={{ alignItems: "center" }}
                >
                  <h2 className="object-title">{data.name}</h2>
                  {data.type_name?.trim() ? (
                    <span
                      className="object-nature"
                      title="Object type"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        alignSelf: "center",
                        minHeight: 23,
                        lineHeight: 1.05,
                        position: "relative",
                        top: -1,
                      }}
                    >
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
              {focus === null ? <ExternalCatalogLinks pgc={data.pgc} /> : null}
              <ObservedParameterCards rows={rows} pgc={pgc} />
              <PhysicalParametersTable pgc={pgc} />
              <ObjectMeasurementExports galaxy={data} observed={rows} />
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
