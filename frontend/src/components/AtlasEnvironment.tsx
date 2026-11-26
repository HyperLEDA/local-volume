import { Fragment } from "react";
import type { NominalEnvironmentResult } from "../lib/spatialEnvironment.ts";

export default function AtlasEnvironment({
  result,
  names,
}: {
  result: NominalEnvironmentResult;
  names: ReadonlyMap<number, string>;
}) {
  return (
    <details className="lv-spatial-details">
      <summary>Neighbours ({result.within.length})</summary>
      <p className="lv-spatial-help">
        Nominal positions; {result.eligibleCount} eligible galaxies before
        spatial and population filters. No completeness correction or propagated
        distance errors.
      </p>
      {result.boundaryClipped ? (
        <p className="lv-spatial-help">
          Search sphere crosses the 11 Mpc boundary; no edge correction.
        </p>
      ) : null}
      <dl className="lv-spatial-data">
        {result.within.slice(0, 10).map((point) => (
          <Fragment key={point.pgc}>
            <dt>{names.get(point.pgc) ?? `PGC ${point.pgc}`}</dt>
            <dd>
              {point.separationMpc.toPrecision(3)} Mpc
              {point.verified ? "" : " *"}
            </dd>
          </Fragment>
        ))}
      </dl>
      {result.within.length > 10 ? (
        <p className="lv-spatial-help">Showing 10 of {result.within.length}.</p>
      ) : null}
      <p className="lv-spatial-help">
        * One or both distances not independently verified. Vpec, LG = VLG − H₀D
        (radial residual, not a space velocity).{" "}
        {result.targetVerified
          ? "Verified target distance."
          : "Target distance not independently verified."}
      </p>
    </details>
  );
}
