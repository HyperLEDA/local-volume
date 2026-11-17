import { useEffect, useState } from "react";
import type { AdoptedPhysicalErrorSource } from "../lib/observedUncertainty.ts";
import { observedUncertainty } from "../lib/observedUncertainty.ts";
import type { ParameterRow } from "../api/objects.ts";
import { formatUncertainty } from "../api/objects.ts";
import {
  groupObservedParameters,
  type DisplayParameter,
} from "../lib/observedParameters.ts";
import { ParameterLabel } from "./ParameterLabel.tsx";

type ObservedParameterCardsProps = { rows: ParameterRow[]; pgc: number };

const COLUMNS = 3;
const GRID_COLUMNS = 6;

function displayValue(row: ParameterRow): string {
  return row.value;
}

/** Every populated row fills the available width. */
function splitRows(rows: DisplayParameter[]): DisplayParameter[][] {
  const result: DisplayParameter[][] = [];
  for (let start = 0; start < rows.length; start += COLUMNS) {
    result.push(rows.slice(start, start + COLUMNS));
  }
  return result;
}

/** Scientific help is UI-only: database metadata and values are unchanged. */
const PARAMETER_HELP: Readonly<Record<string, string>> = {
  a26_arcmin: "Holmberg angular diameter along the galaxy's major axis",
  axis_ratio: "Ratio of the apparent minor axis to the major axis (b/a)",
  morphology_t: "Numerical de Vaucouleurs morphological type",
  dwarf_morphology: "Morphological classification of the dwarf galaxy",
  dwarf_sb_class: "Surface-brightness class of the dwarf galaxy",
  b_mag: "Integrated apparent magnitude in the B band",
  ks_mag: "Integrated apparent magnitude in the near-infrared Ks band",
  a_b_galactic_mag: "Foreground Milky Way extinction in the B band",
  ha_mag: "Apparent magnitude of the galaxy's H-alpha emission",
  ha_limit: "Limit qualifier for the H-alpha magnitude",
  fuv_mag:
    "Far-ultraviolet magnitude. A leading > denotes a lower limit in magnitude",
  lvg_v_hel_kms: "Heliocentric line-of-sight velocity",
  lvg_v_lg_kms: "Line-of-sight velocity in the Local Group rest frame",
  mu: "True distance modulus, (m−M)₀",
  dist: "Adopted galaxy distance in megaparsecs",
  distance_method: "Method used to derive the adopted distance",
  hi21_mag: "Equivalent magnitude of neutral-hydrogen 21-cm emission",
  hi21_limit: "Limit qualifier for H I 21-cm magnitude",
  w50_kms: "H I 21-cm line width at 50% of peak flux",
};

function ObservedReading({ row, physical }: {
  row: DisplayParameter;
  physical: AdoptedPhysicalErrorSource | null;
}) {
  const derived = observedUncertainty(row, physical);
  const isDerived = derived !== null;
  return (
    <div className={`parameter-block-reading${isDerived ? " observed-reading--with-error" : ""}${derived?.kind === "asymmetric" ? " observed-reading--asymmetric" : ""}`}>
      <span className="parameter-block-value">{displayValue(row)}</span>
      {derived?.kind === "symmetric" ? (
        <span className="parameter-block-error observed-error-symmetric">± {derived.sigma}</span>
      ) : null}
      {derived?.kind === "asymmetric" ? (
        <span className="parameter-block-error observed-error-stack"
          aria-label={`upper error +${derived.plus}, lower error −${derived.minus}`}>
          <span>+{derived.plus}</span>
          <span>−{derived.minus}</span>
        </span>
      ) : null}
      {!isDerived && row.errorUnit !== null && row.unit ? (
        <span className="parameter-block-unit">{row.unit}</span>
      ) : null}
      {!isDerived && row.error !== null && row.error.trim() !== "" ? (
        <span className="parameter-block-error">
          {formatUncertainty(row.error)}
          {row.errorUnit !== null ? ` ${row.errorUnit}` : ""}
        </span>
      ) : null}
      {row.unit && (isDerived || row.errorUnit === null) ? (
        <span className="parameter-block-unit">{row.unit}</span>
      ) : null}
    </div>
  );
}

export function ObservedParameterCards({ rows, pgc }: ObservedParameterCardsProps) {
  const [physical, setPhysical] = useState<AdoptedPhysicalErrorSource | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setPhysical(null);
    async function loadErrorSource(): Promise<void> {
      try {
        const response = await fetch(`/api/v1/object/${pgc}/physical`, { signal: controller.signal });
        if (!response.ok) return;
        const result = (await response.json()) as { data: AdoptedPhysicalErrorSource };
        if (!controller.signal.aborted && result.data.physical_status === "ready") {
          setPhysical(result.data);
        }
      } catch {
        // Missing physical generation is not evidence for any uncertainty.
      }
    }
    void loadErrorSource();
    return () => controller.abort();
  }, [pgc]);
  const ksEstimated =
    rows
      .find((row) => row.name === "ks_estimated")
      ?.value.trim()
      .toLowerCase() === "true";
  // The boolean is an attribute of Ks photometry, not an independent measurement.
  // Retain thematic boundaries for layout, without displaying their names.
  const groups = groupObservedParameters(rows)
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => row.name !== "ks_estimated"),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    <section className="object-params" aria-label="Observed Properties">
      {/* Table caption replaces standalone heading. */}
      {groups.length === 0 ? (
        <>
          <h3 className="object-section-heading">Observed Properties</h3>
          <p className="object-params-empty">
            No observed parameters available.
          </p>
        </>
      ) : (
        <table className="parameter-matrix">
          <caption className="parameter-matrix-caption">
            Observed Properties
          </caption>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          {groups.map((group) => (
            <tbody className="parameter-group" key={group.title}>
              {splitRows(group.rows).map((cells, index) => (
                <tr
                  className="parameter-data-row"
                  key={`${group.title}-${index}`}
                >
                  {cells.map((row) => (
                    <td
                      className="parameter-cell"
                      key={row.name}
                      colSpan={GRID_COLUMNS / cells.length}
                    >
                      <div className="parameter-block">
                        <div
                          className={`parameter-block-label${PARAMETER_HELP[row.name] ? " parameter-block-label--help" : ""}`}
                          tabIndex={PARAMETER_HELP[row.name] ? 0 : undefined}
                          aria-describedby={
                            PARAMETER_HELP[row.name]
                              ? `parameter-help-${row.name}`
                              : undefined
                          }
                        >
                          <ParameterLabel
                            nice={
                              row.name === "ks_mag" && ksEstimated
                                ? `${row.displayLabel} (est)`
                                : row.displayLabel
                            }
                            fallback={row.name}
                          />
                          {PARAMETER_HELP[row.name] ? (
                            <span
                              id={`parameter-help-${row.name}`}
                              className="parameter-help-tooltip"
                              role="tooltip"
                            >
                              {PARAMETER_HELP[row.name]}
                            </span>
                          ) : null}
                        </div>
                        <ObservedReading row={row} physical={physical} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
    </section>
  );
}
