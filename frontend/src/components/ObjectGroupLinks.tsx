import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchGroupMemberships,
  groupMembershipUrl,
  type GroupMembership,
} from "../api/groups.ts";
import "./objectGroupLinks.css";

const DEFINITION_NAMES = {
  physical: "Physical",
  suite: "MD suite",
  published: "Published",
} as const;

/** Inline, explicit source-aware choices. Never silently select a definition. */
export function ObjectGroupLinks({ pgc }: { pgc: number }) {
  const [groups, setGroups] = useState<GroupMembership[] | null>(null);
  const [resolvedPgc, setResolvedPgc] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setGroups(null);
    setResolvedPgc(null);
    setError(false);
    void fetchGroupMemberships(pgc)
      .then((value) => {
        if (active) {
          setGroups(value);
          setResolvedPgc(pgc);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setResolvedPgc(pgc);
        }
      });
    return () => {
      active = false;
    };
  }, [pgc]);

  if (resolvedPgc !== pgc) return null;
  if (error)
    return (
      <p className="object-group-error" role="status">
        Group membership unavailable
      </p>
    );
  if (!groups?.length) return null;

  return (
    <nav className="object-group-links" aria-label="Catalogue group membership">
      <span className="object-group-label">Groups</span>
      <div className="object-group-items">
        {groups.map((group) => (
          <Link
            className="object-group-chip"
            key={`${group.definition}:${group.group_id}:${group.source_catalog}:${group.source_version}`}
            to={groupMembershipUrl(group)}
          >
            <span className="object-group-chip-name">{group.name}</span>
            <span className="object-group-chip-type">
              {DEFINITION_NAMES[group.definition]}
            </span>
            {group.data_status === "pilot" ||
            group.membership_status === "unconfirmed" ? (
              <span className="object-group-chip-qualification">
                {group.membership_status === "unconfirmed"
                  ? "Candidate"
                  : "Pilot"}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
