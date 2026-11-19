import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  fetchGroup,
  type GroupDefinition,
  type GroupDetail,
} from "../api/groups.ts";
import { GroupSkyMap } from "../components/GroupSkyMap.tsx";
import { GroupFigures } from "../components/GroupFigures.tsx";
import { GroupParameters } from "../components/GroupParameters.tsx";
import {
  newCollectionToken,
  saveCollection,
  consumeCollectionReturn,
} from "../lib/collectionNavigation.ts";
import "../styles/groups.css";

function value(v: number | null, digits: number): string {
  return v === null || !Number.isFinite(v) ? "—" : v.toFixed(digits);
}

export function GroupPage() {
  const { rootPgc } = useParams();
  const [searchParams] = useSearchParams();
  const browseToken = searchParams.get("browse");
  const definition: GroupDefinition =
    searchParams.get("definition") === "suite" ? "suite" : "physical";
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const collectionToken = useMemo(
    () => `group-${rootPgc}-${definition}-${newCollectionToken()}`,
    [rootPgc, definition],
  );
  useEffect(() => {
    const id = Number(rootPgc);
    if (!Number.isInteger(id) || id <= 0) {
      setGroup(null);
      setError("Invalid PGC");
      return;
    }
    let active = true;
    setGroup(null);
    setError(null);
    void fetchGroup(id, definition)
      .then((loaded) => {
        if (active) setGroup(loaded);
      })
      .catch((cause: unknown) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [rootPgc, definition]);

  const names = useMemo(
    () =>
      new Map(group?.members.map((member) => [member.pgc, member.name]) ?? []),
    [group],
  );

  useEffect(() => {
    if (!group) return;
    const restoreY = consumeCollectionReturn();
    if (restoreY !== null) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: restoreY, behavior: "auto" }),
      );
    }
  }, [group]);

  function saveGroupNavigation(): void {
    if (!group) return;
    saveCollection(collectionToken, {
      origin: "group",
      label: `${group.name} Group`,
      returnTo: `/groups/${group.root_pgc}?definition=${definition}${browseToken ? `&browse=${encodeURIComponent(browseToken)}` : ""}`,
      pgcs: [...new Set(group.members.map((member) => member.pgc))],
      scrollY: window.scrollY,
      group: {
        id: group.group_id,
        rootPgc: group.root_pgc,
        definition: definition === "suite" ? "suite" : "physical",
      },
    });
  }

  return (
    <main className="groups-layout group-details">
      {error && (
        <p role="alert" className="catalog-status catalog-status-error">
          {error}
        </p>
      )}
      {!group && !error && (
        <p role="status" className="catalog-status">
          Loading group…
        </p>
      )}
      {group && (
        <>
          <div className="group-overview-layout">
            <section className="group-map-panel" aria-label="Group sky map">
              <GroupSkyMap
                group={group}
                onMemberNavigate={(pgc) => {
                  if (!group.members.some((member) => member.pgc === pgc))
                    return null;
                  saveGroupNavigation();
                  return `/object/${pgc}?nav=${encodeURIComponent(collectionToken)}`;
                }}
              />
            </section>
            <div className="group-detail-summary">
              <div className="group-detail-identity">
                <h2 className="group-detail-title">{group.name} Group</h2>
                <p className="group-detail-kicker">
                  Main Disturber ·{" "}
                  <Link
                    to={`/object/${group.root_pgc}?nav=${collectionToken}`}
                    onClick={saveGroupNavigation}
                  >
                    PGC {group.root_pgc}
                  </Link>
                </p>
              </div>
              <GroupParameters
                group={group}
                navToken={collectionToken}
                onMemberOpen={saveGroupNavigation}
              />
            </div>
          </div>
          <details className="group-members">
            <summary className="group-members-trigger">
              <span>Members and hierarchy</span>
              <span className="group-members-count">
                {group.member_count} galaxies
              </span>
            </summary>
            <div className="group-members-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Galaxy</th>
                    <th>PGC</th>
                    <th>Parent MD</th>
                    <th>Depth</th>
                    <th>Θ₁ (current)</th>
                    <th>Distance (Mpc)</th>
                    <th>
                      V<sub>LG</sub> (km/s)
                    </th>
                    <th>Membership</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((member) => (
                    <tr key={member.pgc}>
                      <td
                        style={{
                          paddingLeft: `${12 + member.hierarchy_depth * 14}px`,
                        }}
                      >
                        <Link
                          to={`/object/${member.pgc}?nav=${collectionToken}`}
                          onClick={saveGroupNavigation}
                        >
                          {member.name}
                        </Link>
                      </td>
                      <td>{member.pgc}</td>
                      <td>
                        {member.parent_md_pgc === null
                          ? "—"
                          : (names.get(member.parent_md_pgc) ??
                            `PGC ${member.parent_md_pgc}`)}
                      </td>
                      <td>{member.hierarchy_depth}</td>
                      <td>{value(member.theta1_computed, 2)}</td>
                      <td>{value(member.dist_mpc, 2)}</td>
                      <td>{value(member.lvg_v_lg_kms, 0)}</td>
                      <td>
                        {member.membership_status === "computed"
                          ? "derived"
                          : member.membership_status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <GroupFigures group={group} />
        </>
      )}
    </main>
  );
}
