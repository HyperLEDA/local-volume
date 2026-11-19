import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  newCollectionToken,
  consumeCollectionReturn,
} from "../lib/collectionNavigation.ts";
import {
  readGroupListState,
  groupListUrl,
  saveGroupBrowse,
  type GroupListState,
} from "../lib/groupBrowsing.ts";
import {
  fetchGroups,
  previewUrl,
  type GroupDefinition,
  type GroupSummary,
} from "../api/groups.ts";
import "../styles/groups.css";
import { supportsHierarchyPreview } from "../lib/groupPreviewPolicy.ts";

function quantity(value: number | null, digits: number): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

function GroupCard({
  group,
  definition,
  browseKey,
  onOpen,
}: {
  group: GroupSummary;
  definition: GroupDefinition;
  browseKey: string;
  onOpen: () => void;
}) {
  const allowHierarchy = supportsHierarchyPreview(group.root_pgc);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [hierarchyRequested, setHierarchyRequested] = useState(false);
  const [hierarchyReady, setHierarchyReady] = useState(false);
  const [hierarchyFailed, setHierarchyFailed] = useState(false);

  useEffect(() => {
    setPortraitFailed(false);
    setHierarchyRequested(false);
    setHierarchyReady(false);
    setHierarchyFailed(false);
  }, [definition, group.root_pgc]);

  return (
    <Link
      className="group-card"
      to={`/groups/${group.root_pgc}?definition=${definition}&browse=${encodeURIComponent(browseKey)}`}
      onClick={onOpen}
      onMouseEnter={() => {
        if (allowHierarchy) setHierarchyRequested(true);
      }}
      onFocus={() => {
        if (allowHierarchy) setHierarchyRequested(true);
      }}
    >
      <div
        className={`group-card-image${portraitFailed ? " group-card-image--fallback" : ""}`}
      >
        {!portraitFailed && (
          <img
            className="group-card-preview group-card-preview--portrait"
            loading="lazy"
            decoding="async"
            src={previewUrl(group.root_pgc, definition, "portrait")}
            alt={`Close-up DSS2 Color image of ${group.name}`}
            onError={() => {
              setPortraitFailed(true);
              if (allowHierarchy) setHierarchyRequested(true);
            }}
          />
        )}
        {allowHierarchy && hierarchyRequested && !hierarchyFailed && (
          <img
            className={`group-card-preview group-card-preview--hierarchy${hierarchyReady ? " is-ready" : ""}`}
            loading="lazy"
            decoding="async"
            src={previewUrl(group.root_pgc, definition, "hierarchy")}
            alt={`Full sky extent of ${group.name}, with MD hierarchy`}
            onLoad={() => setHierarchyReady(true)}
            onError={() => setHierarchyFailed(true)}
          />
        )}
        {portraitFailed && (!allowHierarchy || hierarchyFailed) && (
          <span className="group-preview-missing">Previews not generated</span>
        )}
      </div>
      <div className="group-card-content">
        <div className="group-card-title">
          <strong>{group.name} Group</strong>
          {group.subgroup_count > 0 && (
            <small>
              {group.subgroup_count} subgroup
              {group.subgroup_count === 1 ? "" : "s"}
            </small>
          )}
        </div>
        <div className="group-stats">
          <div>
            <small>Members</small>
            <strong>{group.member_count}</strong>
          </div>
          <div>
            <small>Distance</small>
            <strong>
              {quantity(group.distance_mpc, 2)} <em>Mpc</em>
            </strong>
          </div>
          <div>
            <small>Extent</small>
            <strong>
              {quantity(group.extent_kpc, 0)} <em>kpc</em>
            </strong>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function GroupsPage() {
  const initialList = useMemo(
    () => readGroupListState(window.location.search),
    [],
  );
  const [definition, setDefinition] = useState<GroupListState["definition"]>(
    initialList.definition,
  );
  const [sort, setSort] = useState<GroupListState["sort"]>(initialList.sort);
  const [query, setQuery] = useState(initialList.query);
  const [limit, setLimit] = useState(initialList.limit);
  const browseKey = useMemo(
    () =>
      `groups-${definition}-${sort}-${limit}-${query.length}-${newCollectionToken()}`,
    [definition, sort, limit, query],
  );
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setGroups([]);
    void fetchGroups(definition)
      .then((data) => {
        if (active) setGroups(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(String(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [definition]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter(
        (group) =>
          group.name.toLowerCase().includes(q) ||
          String(group.root_pgc).includes(q),
      )
      .sort((a, b) =>
        sort === "distance"
          ? (a.distance_mpc ?? Infinity) - (b.distance_mpc ?? Infinity)
          : sort === "name"
            ? a.name.localeCompare(b.name)
            : b.member_count - a.member_count || a.name.localeCompare(b.name),
      );
  }, [groups, query, sort]);

  // Persist the small search/sort/definition state in the Groups URL.
  useEffect(() => {
    const destination = groupListUrl({ definition, sort, query, limit });
    if (
      `${window.location.pathname}${window.location.search}` !== destination
    ) {
      window.history.replaceState(
        window.history.state,
        "",
        destination + window.location.hash,
      );
    }
  }, [definition, sort, query, limit]);

  useEffect(() => {
    if (loading || error !== null) return;
    const scroll = consumeCollectionReturn();
    if (scroll !== null) {
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: scroll, behavior: "auto" }),
      );
    }
  }, [loading, error]);

  function saveBrowseContext(): void {
    saveGroupBrowse(browseKey, {
      definition,
      returnTo: groupListUrl({ definition, sort, query, limit }),
      scrollY: window.scrollY,
      entries: filtered.slice(0, limit).map((group) => ({
        rootPgc: group.root_pgc,
        groupId: group.group_id,
      })),
    });
  }

  return (
    <main className="groups-layout">
      <div className="groups-heading">
        <h2>Groups</h2>
        <p>Computed from the current LV LEDA catalogue</p>
      </div>
      <div className="groups-tools">
        <input
          aria-label="Search galaxy groups"
          type="search"
          placeholder="Search groups or PGC…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(24);
          }}
        />
        <select
          aria-label="Group definition"
          value={definition}
          onChange={(event) => {
            const nextDefinition = event.target.value;
            if (nextDefinition !== "physical" && nextDefinition !== "suite")
              return;
            setDefinition(nextDefinition);
            setLimit(24);
          }}
        >
          <option value="physical">Physical groups</option>
          <option value="suite">MD suites</option>
        </select>
        <select
          aria-label="Sort groups"
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as GroupListState["sort"])
          }
        >
          <option value="members">Most members</option>
          <option value="distance">Nearest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>
      {loading && <p role="status">Loading current LV LEDA groups…</p>}
      {error && (
        <p role="alert" className="catalog-status catalog-status-error">
          {error}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p>No groups match the selection.</p>
      )}
      {!loading && !error && (
        <section className="groups-grid" aria-label="Group cards">
          {filtered.slice(0, limit).map((group) => (
            <GroupCard
              key={`${definition}-${group.root_pgc}`}
              group={group}
              definition={definition}
              browseKey={browseKey}
              onOpen={saveBrowseContext}
            />
          ))}
        </section>
      )}
      {limit < filtered.length && (
        <button
          type="button"
          className="groups-more"
          onClick={() => setLimit((n) => n + 24)}
        >
          Load more
        </button>
      )}
    </main>
  );
}
