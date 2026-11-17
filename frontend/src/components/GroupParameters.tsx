import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { GroupDetail } from "../api/groups.ts";
import { calculateGroupScience, validNumber } from "../lib/groupScience.ts";
import "./physicalParameters.css";

type Cell = {
  key: string;
  label: ReactNode;
  value: ReactNode;
  help: string;
  unit?: string;
};
function fmt(n: number | null | undefined, digits: number): string {
  return validNumber(n) ? n.toFixed(digits) : "—";
}

function cell(
  key: string,
  label: ReactNode,
  value: ReactNode,
  help: string,
  unit?: string,
): Cell {
  return { key, label, value, help, unit };
}

export function GroupParameters({ group }: { group: GroupDetail }) {
  const s = calculateGroupScience(group);
  const host = group.members.find((member) => member.pgc === group.root_pgc);
  const N = group.member_count;
  const hostLink = host ? (
    <Link to={`/object/${host.pgc}`}>{host.name}</Link>
  ) : (
    `PGC ${group.root_pgc}`
  );
  const rows: Cell[][] = [
    [
      cell(
        "md",
        "Main galaxy",
        hostLink,
        "Galaxy at the centre of this MD-defined system.",
      ),
      cell(
        "n",
        "Members",
        N,
        "Number of selected galaxies, including the central galaxy.",
      ),
      cell(
        "nested",
        "Subgroups",
        group.subgroup_count,
        "Number of nested MD systems within the group.",
      ),
    ],
    [
      cell(
        "nv",
        <>
          N<sub>V</sub>
        </>,
        s.nVel,
        "Members with measured Local Group-frame velocities.",
      ),
      cell(
        "nd",
        <>
          N<sub>D</sub>
        </>,
        s.nIndependentD,
        "Members with individually determined distances; group-assigned distances excluded.",
      ),
    ],
    [
      cell(
        "dmean",
        <>
          ⟨D⟩<sub>ind</sub>
        </>,
        fmt(s.meanIndependentD, 2),
        `Mean of ${s.nIndependentD} independent galaxy distances.`,
        "Mpc",
      ),
      cell(
        "vmean",
        <>
          ⟨V<sub>LG</sub>⟩
        </>,
        fmt(s.meanVelocity, 1),
        "Mean of measured member velocities in the Local Group frame.",
        "km/s",
      ),
      cell(
        "sigma",
        <>
          σ<sub>V</sub>
        </>,
        fmt(s.velocityDispersion, 1),
        `Sample standard deviation of ${s.nVel} measured velocities. Measurement errors are not subtracted.`,
        "km/s",
      ),
    ],
    [
      cell(
        "rmax",
        <>
          R<sub>max</sub>
        </>,
        fmt(group.extent_kpc, 0),
        "Largest projected separation from the central galaxy at its adopted distance.",
        "kpc",
      ),
      cell(
        "rmean",
        <>
          ⟨R<sub>p</sub>⟩
        </>,
        fmt(s.meanProjectedKpc, 0),
        `Mean projected separation of ${s.nProjected} satellites from the central galaxy.`,
        "kpc",
      ),
      cell(
        "r50",
        <>
          R<sub>50</sub>
        </>,
        fmt(s.medianProjectedKpc, 0),
        "Median projected satellite radius, without a completeness correction.",
        "kpc",
      ),
      cell(
        "crossing",
        <>
          t<sub>cr</sub>
        </>,
        fmt(s.crossingTimeGyr, 2),
        "Crossing-time estimate ⟨Rₚ⟩/σᵥ, expressed in Gyr.",
        "Gyr",
      ),
    ],
    [
      cell(
        "morb",
        <>
          log(M<sub>orb</sub>/M☉)
        </>,
        fmt(s.logOrbitalMassMsun, 2),
        `Orbital mass estimate from ${s.nOrbitalTracers} direct satellites: (16/πG)⟨ΔV²Rₚ⟩, assuming ⟨e²⟩ = 1/2.`,
      ),
      cell(
        "lk",
        <>
          log(ΣL<sub>Ks</sub>/L☉)
        </>,
        fmt(s.logSummedKsLsun, 2),
        `Sum of available Kₛ-band luminosities (${s.nKs} of ${N} members).`,
      ),
      cell(
        "mhi",
        <>
          log(ΣM<sub>HI,det</sub>/M☉)
        </>,
        fmt(s.logSummedDetectedHiMsun, 2),
        `Sum of H I detections (${s.nHiDetections} of ${N} members); upper limits excluded.`,
      ),
    ],
    [
      cell(
        "gap",
        <>
          ΔK<sub>12</sub>
        </>,
        fmt(s.kBandGapMag, 2),
        `Kₛ magnitude difference between the two brightest measured members (${s.nKs} of ${N} have luminosities).`,
        "mag",
      ),
      cell(
        "fearly",
        <>
          f<sub>T≤2</sub>
        </>,
        fmt(s.earlyTypeFraction, 2),
        `Fraction of ${s.nMorph} classified satellites with morphological type T ≤ 2.`,
      ),
    ],
  ];
  return (
    <section
      className="group-parameters object-params"
      aria-label="Group Parameters"
    >
      <table className="parameter-matrix group-parameters-matrix">
        <caption className="parameter-matrix-caption">Group Properties</caption>
        <colgroup>
          {Array.from({ length: 12 }, (_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        {rows.map((fields, index) => (
          <tbody className="parameter-group" key={index}>
            <tr className="parameter-data-row">
              {fields.map((field) => (
                <td
                  className="parameter-cell"
                  colSpan={12 / fields.length}
                  key={field.key}
                >
                  <div className="parameter-block">
                    <div
                      className="parameter-block-label parameter-block-label--help"
                      tabIndex={0}
                    >
                      {field.label}
                      <span className="parameter-help-tooltip" role="tooltip">
                        {field.help}
                      </span>
                    </div>
                    <div className="parameter-block-reading">
                      <span className="parameter-block-value">
                        {field.value}
                      </span>
                      {field.unit && field.value !== "—" ? (
                        <span className="parameter-block-unit">
                          {field.unit}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        ))}
      </table>
    </section>
  );
}
