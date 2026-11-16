import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import "./physicalParameters.css";

type PhysicalValue = number | string | boolean | null;
type PhysicalData = Record<string, PhysicalValue>;

type Field = {
  key: string;
  label: ReactNode;
  description: string;
  decimals?: number;
  unit?: string;
  value: (record: PhysicalData) => PhysicalValue | undefined;
  upperLimit?: (record: PhysicalData) => boolean;
};

type PhysicalRow = { key: string; fields: readonly Field[] };

const NUMERIC = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function finiteNumber(value: PhysicalValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !NUMERIC.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function displayValue(
  value: PhysicalValue | undefined,
  decimals?: number,
): string {
  if (value === undefined || value === null || value === "") return "—";
  if (decimals === undefined) return String(value);
  const numeric = finiteNumber(value);
  if (numeric === null) return "—";
  const rounded = Number(numeric.toFixed(decimals));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

// Precisely six scientific rows. Displayable fields in a row always share its width.
// All logarithmic values are the numerical base-10 values in the indicated solar units.
const ROWS: readonly PhysicalRow[] = [
  {
    key: "geometry-and-kinematics",
    fields: [
      {
        key: "a26",
        label: (
          <>
            a<sub>26</sub>
          </>
        ),
        description:
          "Linear diameter at the Holmberg B-band isophote (26.5 mag/arcsec²)",
        unit: "kpc",
        decimals: 2,
        value: (d) => d.a26_kpc,
      },
      {
        key: "inclination",
        label: <i>i</i>,
        description: "Inclination of the galaxy disk to the line of sight",
        unit: "deg",
        decimals: 1,
        value: (d) => d.inclination_deg,
      },
      {
        key: "vm",
        label: (
          <>
            V<sub>m</sub>
          </>
        ),
        description: "Rotation amplitude derived from the H I line width",
        unit: "km/s",
        decimals: 1,
        value: (d) => d.vrot_kms,
      },
    ],
  },
  {
    key: "stellar-photometry",
    fields: [
      {
        key: "mb",
        label: (
          <>
            M<sub>B</sub>
          </>
        ),
        description: "Absolute B-band magnitude corrected for extinction",
        unit: "mag",
        decimals: 2,
        value: (d) => d.abs_b_mag,
      },
      {
        key: "mk",
        label: (
          <>
            M<sub>K</sub>
          </>
        ),
        description:
          "Absolute Ks-band magnitude from the published Ks luminosity, adopting M(Ks, Sun) = 3.28 mag",
        unit: "mag",
        decimals: 2,
        value: (d) => d.abs_ks_mag,
      },
    ],
  },
  {
    key: "stellar-luminosity",
    fields: [
      {
        key: "log-lk",
        label: (
          <>
            log(L<sub>K</sub>)
          </>
        ),
        description:
          "Base-10 logarithm of Ks-band luminosity in solar Ks-band luminosities",
        decimals: 2,
        value: (d) => d.log_lks_lsun,
      },
      {
        key: "mu",
        label: (
          <>
            ⟨μ<sub>B</sub>⟩
          </>
        ),
        description:
          "Mean B-band surface brightness inside the corrected Holmberg isophote",
        unit: "mag/arcsec²",
        decimals: 2,
        value: (d) => d.mean_sb_b_mag_arcsec2,
      },
    ],
  },
  {
    key: "mass",
    fields: [
      {
        key: "log-mdyn",
        label: (
          <>
            log(M<sub>dyn</sub>)
          </>
        ),
        description:
          "Base-10 logarithm of dynamical mass in solar masses, within the Holmberg radius (M26)",
        decimals: 2,
        value: (d) => d.log_m26_msun,
      },
      {
        key: "log-mhi",
        label: (
          <>
            log(M<sub>H I</sub>)
          </>
        ),
        description:
          "Base-10 logarithm of neutral-hydrogen mass in solar masses; '<' indicates an upper limit",
        decimals: 2,
        value: (d) => d.log_mhi_msun,
        upperLimit: (d) => d.log_mhi_limit_flag === "<",
      },
    ],
  },
  {
    key: "star-formation",
    fields: [
      {
        key: "sfr-ha",
        label: (
          <>
            log(SFR<sub>Hα</sub>)
          </>
        ),
        description:
          "Logarithm of Hα star formation rate in solar masses per year; LVGDB/Karachentsev et al. (2013) calibration and extinction correction",
        decimals: 2,
        value: (d) => d.log_sfr_halpha_msun_yr,
        upperLimit: (d) => d.log_sfr_halpha_upper_limit === true,
      },
      {
        key: "sfr-fuv",
        label: (
          <>
            log(SFR<sub>FUV</sub>)
          </>
        ),
        description:
          "Logarithm of FUV star formation rate in solar masses per year; LVGDB/Karachentsev et al. (2013) calibration and extinction correction",
        decimals: 2,
        value: (d) => d.log_sfr_fuv_msun_yr,
        upperLimit: (d) => d.log_sfr_fuv_upper_limit === true,
      },
    ],
  },
  {
    key: "environment",
    fields: [
      {
        key: "md",
        label: <>MD</>,
        description:
          "Main disturber: canonical galaxy responsible for the strongest tidal contribution",
        value: (d) => d.md_name,
      },
      {
        key: "theta1",
        label: (
          <>
            Θ<sub>1</sub>
          </>
        ),
        description:
          "Tidal index set by the strongest neighboring galaxy; provisional from the available LV donor census",
        decimals: 2,
        value: (d) => d.theta1,
      },
      {
        key: "theta5",
        label: (
          <>
            Θ<sub>5</sub>
          </>
        ),
        description:
          "Tidal index of the five dominant neighboring galaxies; provisional from the available LV donor census",
        decimals: 2,
        value: (d) => d.theta5,
      },
      {
        key: "thetaj",
        label: (
          <>
            Θ<sub>j</sub>
          </>
        ),
        description:
          "Local Ks luminosity density relative to the cosmic mean; provisional from the available LV donor census",
        decimals: 2,
        value: (d) => d.thetaj,
      },
    ],
  },
];

function isPresent(field: Field, record: PhysicalData): boolean {
  const raw = field.value(record);
  if (raw === null || raw === undefined || raw === "") return false;
  if (typeof raw === "string" && !raw.trim()) return false;
  return field.decimals === undefined || finiteNumber(raw) !== null;
}

function Measurement({
  field,
  record,
}: {
  field: Field;
  record: PhysicalData;
}) {
  const formatted = displayValue(field.value(record), field.decimals);
  const upperLimit = formatted !== "—" && field.upperLimit?.(record) === true;
  const pgc = finiteNumber(record.md_pgc);
  const linkedMd =
    field.key === "md" &&
    pgc !== null &&
    Number.isSafeInteger(pgc) &&
    pgc > 0 &&
    typeof record.md_name === "string" &&
    record.md_name.trim().length > 0;

  return (
    <div className="parameter-block">
      <div
        className="parameter-block-label parameter-block-label--help"
        tabIndex={0}
        aria-describedby={`physical-help-${field.key}`}
      >
        {field.label}
        <span
          id={`physical-help-${field.key}`}
          className="parameter-help-tooltip"
          role="tooltip"
        >
          {field.description}
        </span>
      </div>
      <div className="parameter-block-reading">
        <span className="parameter-block-value">
          {linkedMd ? (
            <Link className="physical-md-link" to={`/object/${pgc}`}>
              {record.md_name}
            </Link>
          ) : (
            <>
              {upperLimit ? "< " : null}
              {formatted}
            </>
          )}
        </span>
        {field.unit ? (
          <span className="parameter-block-unit">{field.unit}</span>
        ) : null}
      </div>
    </div>
  );
}

export function PhysicalParametersTable({ pgc }: { pgc: number }) {
  const [record, setRecord] = useState<PhysicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined = undefined;
    setRecord(null);
    setLoading(true);
    setError(null);

    async function load(): Promise<void> {
      try {
        const response = await fetch(`/api/v1/object/${pgc}/physical`, {
          signal: controller.signal,
        });
        if (response.status === 404) {
          if (!controller.signal.aborted) setRecord(null);
          return;
        }
        if (!response.ok)
          throw new Error(
            `Physical properties unavailable (${response.status})`,
          );
        const payload = (await response.json()) as { data: PhysicalData };
        if (!controller.signal.aborted) {
          setRecord(payload.data);
          if (payload.data.physical_status === "pending") {
            retryTimer = setTimeout(() => {
              if (!controller.signal.aborted) void load();
            }, 3000);
          }
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Physical properties unavailable",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => {
      controller.abort();
      if (retryTimer !== undefined) clearTimeout(retryTimer);
    };
  }, [pgc]);

  const activeRows =
    record === null
      ? []
      : ROWS.map((row) => ({
          key: row.key,
          fields: row.fields.filter((field) => isPresent(field, record)),
        })).filter((row) => row.fields.length > 0);

  return (
    <section className="object-params" aria-label="Physical Properties">
      {loading ? (
        <p className="catalog-status">Loading physical properties…</p>
      ) : error !== null ? (
        <p className="catalog-status catalog-status-error">{error}</p>
      ) : record?.physical_status === "pending" ? (
        <p className="catalog-status">Calculating physical properties…</p>
      ) : record === null ? (
        <p className="catalog-status">
          Physical parameters are unavailable for this object.
        </p>
      ) : activeRows.length === 0 ? (
        <p className="catalog-status">No physical properties available.</p>
      ) : (
        <table className="parameter-matrix physical-parameter-matrix">
          <caption className="parameter-matrix-caption">
            Physical Properties
          </caption>
          <colgroup>
            {Array.from({ length: 12 }, (_, n) => (
              <col key={n} />
            ))}
          </colgroup>
          {activeRows.map((row) => (
            <tbody className="parameter-group" key={row.key}>
              <tr className="parameter-data-row">
                {row.fields.map((field) => (
                  <td
                    className="parameter-cell"
                    colSpan={12 / row.fields.length}
                    key={field.key}
                  >
                    <Measurement field={field} record={record} />
                  </td>
                ))}
              </tr>
            </tbody>
          ))}
        </table>
      )}
    </section>
  );
}
