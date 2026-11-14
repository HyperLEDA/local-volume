import type { ParameterRow } from "../api/objects.ts";
import { formatUncertainty } from "../api/objects.ts";
import { groupObservedParameters } from "../lib/observedParameters.ts";
import { ParameterLabel } from "./ParameterLabel.tsx";

type ObservedParameterCardsProps = { rows: ParameterRow[] };

function displayValue(row: ParameterRow): string {
  if (row.name === "ks_estimated") {
    if (row.value === "true") return "Yes";
    if (row.value === "false") return "No";
  }
  return row.value;
}

export function ObservedParameterCards({ rows }: ObservedParameterCardsProps) {
  const groups = groupObservedParameters(rows);

  return (
    <section className="object-params" aria-labelledby="object-params-heading">
      <h3 id="object-params-heading" className="object-section-heading">Observed Parameters</h3>
      {groups.length === 0 ? (
        <p className="object-params-empty">No observed parameters available.</p>
      ) : (
        <div className="parameter-groups">
          {groups.map((group) => (
            <section className="parameter-group" key={group.title} aria-label={group.title}>
              <h4 className="parameter-group-heading">{group.title}</h4>
              <div className="parameter-card-grid">
                {group.rows.map((row) => (
                  <article
                    className="parameter-card"
                    key={row.name}
                    title={[row.description, `Field: ${row.name}`].filter(Boolean).join(" · ")}
                  >
                    <div className="parameter-card-label">
                      <ParameterLabel nice={row.displayLabel} fallback={row.name} />
                    </div>
                    <div className="parameter-card-reading">
                      <span className="parameter-card-value">{displayValue(row)}</span>
                      {row.error !== null && row.error.trim() !== "" ? (
                        <span className="parameter-card-error">
                          {formatUncertainty(row.error)}
                          {row.errorUnit !== null ? ` ${row.errorUnit}` : ""}
                        </span>
                      ) : null}
                    </div>
                    {row.unit ? <div className="parameter-card-unit">{row.unit}</div> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
