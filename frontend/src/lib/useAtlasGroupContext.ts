import { useEffect, useState } from "react";
import type { GroupDetail, GroupMembership } from "../api/groups.ts";
import {
  atlasActiveMembership,
  atlasMembershipChoices,
  atlasMembershipKey,
  createAtlasGroupResolver,
} from "./atlasGroupContext.ts";

type MembershipResult = {
  pgc: number;
  rows: GroupMembership[];
  error: boolean;
};
type DetailResult = {
  pgc: number;
  key: string;
  detail: GroupDetail | null;
  error: boolean;
};

// Stage 04a: physical-only Atlas selection; no definition chooser.
export function useAtlasGroupContext(pgc: number | null) {
  const [resolver] = useState(createAtlasGroupResolver);
  const [memberships, setMemberships] = useState<MembershipResult | null>(null);
  const [result, setResult] = useState<DetailResult | null>(null);
  useEffect(() => {
    let active = true;
    setMemberships(null);
    if (pgc !== null) {
      void resolver
        .memberships(pgc)
        .then((rows) => {
          if (active) setMemberships({ pgc, rows, error: false });
        })
        .catch(() => {
          if (active) setMemberships({ pgc, rows: [], error: true });
        });
    }
    return () => {
      active = false;
    };
  }, [pgc, resolver]);
  const current =
    memberships !== null && memberships.pgc === pgc ? memberships : null;
  // Membership objects retain their identity across unrelated map renders.
  const physical = current
    ? atlasMembershipChoices(current.rows, current.pgc).filter(
        (row) => row.definition === "physical",
      )
    : [];
  const selected = atlasActiveMembership(physical);
  const key = selected === null ? null : atlasMembershipKey(selected);
  useEffect(() => {
    let active = true;
    setResult(null);
    if (pgc !== null && selected !== null && key !== null) {
      void resolver
        .detail(selected)
        .then((detail) => {
          if (active) setResult({ pgc, key, detail, error: false });
        })
        .catch(() => {
          if (active) setResult({ pgc, key, detail: null, error: true });
        });
    }
    return () => {
      active = false;
    };
  }, [pgc, selected, key, resolver]);
  const resolved =
    result !== null && result.pgc === pgc && result.key === key ? result : null;
  const status =
    pgc === null
      ? "idle"
      : current === null
        ? "loading"
        : current.error || physical.length > 1
          ? "error"
          : selected === null
            ? "none"
            : resolved === null
              ? "loading"
              : resolved.error
                ? "error"
                : "ready";
  return {
    status,
    selected,
    detail: status === "ready" ? (resolved?.detail ?? null) : null,
  };
}
