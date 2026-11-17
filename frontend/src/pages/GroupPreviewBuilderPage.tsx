import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPreviewCacheManifest,
  fetchGroup,
  fetchGroups,
  type GroupPreviewCacheManifest,
  uploadPreview,
  type GroupDefinition,
  type GroupDetail,
  type GroupPreviewVariant,
  type GroupSummary,
} from "../api/groups.ts";
import { fetchObject } from "../api/objects.ts";
import { GroupSkyMap } from "../components/GroupSkyMap.tsx";
import { objectFovDegrees } from "../lib/objectFov.ts";
import {
  GROUP_PORTRAIT_FOV_FACTOR,
  supportsHierarchyPreview,
} from "../lib/groupPreviewPolicy.ts";
import "../styles/groups.css";

type PreviewTask = { group: GroupSummary; variant: GroupPreviewVariant };
type Job = {
  definition: GroupDefinition;
  tasks: PreviewTask[];
  index: number;
  completed: number;
  revision: number;
};

export function GroupPreviewBuilderPage() {
  const [definition, setDefinition] = useState<GroupDefinition>("physical");
  const [variantChoice, setVariantChoice] = useState<
    "both" | GroupPreviewVariant
  >("both");
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [cache, setCache] = useState<GroupPreviewCacheManifest | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [portraitFov, setPortraitFov] = useState<number | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [status, setStatus] = useState(
    "The PostgreSQL cache stores separate MD portraits and full-hierarchy WebP previews.",
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [batchSize, setBatchSize] = useState(1);

  useEffect(() => {
    let alive = true;
    setGroups([]);
    setCache(null);
    void Promise.all([
      fetchGroups(definition),
      fetchPreviewCacheManifest(definition),
    ])
      .then(([data, report]) => {
        if (alive) {
          setGroups(data);
          setCache(report);
        }
      })
      .catch((error: unknown) => {
        if (alive) setStatus(`Cannot inspect group cache: ${String(error)}`);
      });
    return () => {
      alive = false;
    };
  }, [definition]);

  const current = job?.tasks[job.index];
  const jobDefinition = job?.definition;
  const jobDone = job !== null && job.index >= job.tasks.length;
  const remainingLabel = useMemo(
    () =>
      job
        ? `${Math.min(job.index + 1, job.tasks.length)} / ${job.tasks.length}`
        : "—",
    [job],
  );

  useEffect(() => {
    if (!jobDefinition || !current || failed) return;
    let alive = true;
    setDetail(null);
    setPortraitFov(null);
    setStatus(
      `Rendering ${current.group.name} · ${current.variant} (${remainingLabel})…`,
    );
    const fetches: [Promise<GroupDetail>, Promise<number>] = [
      fetchGroup(current.group.root_pgc, jobDefinition),
      current.variant === "portrait"
        ? fetchObject(current.group.root_pgc).then(
            ({ data }) => objectFovDegrees(data) * GROUP_PORTRAIT_FOV_FACTOR,
          )
        : Promise.resolve(1),
    ];
    void Promise.all(fetches)
      .then(([data, fov]) => {
        if (alive) {
          setPortraitFov(fov);
          setDetail(data);
        }
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setFailed(true);
        setJob(null);
        setStatus(`Cannot load ${current.group.name}: ${String(error)}`);
      });
    return () => {
      alive = false;
    };
  }, [current, jobDefinition, failed, remainingLabel]);

  const onSnapshot = useCallback(
    (blob: Blob) => {
      if (!job || !current || failed) return;
      void uploadPreview(
        current.group.root_pgc,
        job.definition,
        blob,
        job.revision,
        current.variant,
      )
        .then(() => {
          setDetail(null);
          setJob((previous) =>
            previous
              ? {
                  ...previous,
                  index: previous.index + 1,
                  completed: previous.completed + 1,
                }
              : previous,
          );
        })
        .catch((error: unknown) => {
          setFailed(true);
          setJob(null);
          setStatus(
            `Preview for ${current.group.name} (${current.variant}) was NOT saved: ${String(error)}`,
          );
        });
    },
    [job, current, failed],
  );

  const onSnapshotError = useCallback((reason: string) => {
    setFailed(true);
    setJob(null);
    setStatus(`Capture stopped without writing: ${reason}`);
  }, []);

  async function buildBatch(): Promise<void> {
    if (busy || (job !== null && !jobDone && !failed)) return;
    setBusy(true);
    setFailed(false);
    setDetail(null);
    setJob(null);
    try {
      const report = await fetchPreviewCacheManifest(definition);
      setCache(report);
      if (!report.write_enabled) {
        throw new Error(
          "Preview writing is disabled. Restart backend with LV_GROUP_PREVIEW_WRITE=1 on the isolated 6435 database.",
        );
      }
      const currentPairs = new Set(
        report.entries
          .filter((entry) => entry.current)
          .map((entry) => `${entry.root_pgc}/${entry.variant}`),
      );
      const candidates = groups.slice(0, batchSize);
      const variants: GroupPreviewVariant[] =
        variantChoice === "both" ? ["portrait", "hierarchy"] : [variantChoice];
      const missing: PreviewTask[] = candidates.flatMap((group) =>
        variants
          .filter(
            (variant) =>
              (variant !== "hierarchy" ||
                supportsHierarchyPreview(group.root_pgc)) &&
              !currentPairs.has(`${group.root_pgc}/${variant}`),
          )
          .map((variant) => ({ group, variant })),
      );
      if (missing.length === 0) {
        setStatus(
          `All ${candidates.length} groups have current ${variantChoice} previews.`,
        );
        return;
      }
      setStatus(
        `Generating ${missing.length} missing WebP images. Do not close this page.`,
      );
      setJob({
        definition,
        tasks: missing,
        index: 0,
        completed: 0,
        revision: report.revision,
      });
    } catch (error: unknown) {
      setStatus(`Cannot start preview generation: ${String(error)}`);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (job === null || job.index < job.tasks.length) return;
    setStatus(
      `Stored ${job.completed} WebP images in PostgreSQL. Reload Groups to see them.`,
    );
    setDetail(null);
    void fetchPreviewCacheManifest(job.definition)
      .then(setCache)
      .catch(() => {});
  }, [job]);

  return (
    <main className="groups-layout group-preview-builder">
      <h2>Groups · preview cache builder</h2>
      <p>
        Local maintenance tool: each 512 × 512 DSS2 Color WebP is generated once
        and stored in <code>lv.group_previews</code>. The MD portrait uses the
        same angular field-of-view rule as ObjectPage. The hierarchy preview
        shows all positioned members and their MD links.
      </p>
      <p>
        Stored previews are reused while their physical-catalogue and renderer
        versions match. Only missing or outdated images are regenerated.
      </p>
      {cache && (
        <div className="group-preview-cache-status" role="status">
          {(["portrait", "hierarchy"] as const).map((variant) => {
            const entries = new Map(
              cache.entries
                .filter((item) => item.variant === variant)
                .map((item) => [item.root_pgc, item]),
            );
            const eligibleGroups = groups.filter(
              (group) =>
                variant !== "hierarchy" ||
                supportsHierarchyPreview(group.root_pgc),
            );
            const currentCount = eligibleGroups.filter(
              (group) => entries.get(group.root_pgc)?.current,
            ).length;
            const staleCount = eligibleGroups.filter((group) => {
              const entry = entries.get(group.root_pgc);
              return entry !== undefined && !entry.current;
            }).length;
            return (
              <p key={variant}>
                <strong>
                  {variant === "portrait" ? "MD portraits" : "Hierarchy views"}:
                </strong>
                {` ${currentCount} current · ${staleCount} outdated · ${eligibleGroups.length - currentCount - staleCount} missing`}
              </p>
            );
          })}
        </div>
      )}
      {cache && !cache.write_enabled && (
        <p className="catalog-status" role="alert">
          Writing is disabled. Restart the backend with{" "}
          <code>$env:LV_GROUP_PREVIEW_WRITE = '1'</code> and the existing
          PostgreSQL connection to port 6435; then reload this page.
        </p>
      )}
      <div className="groups-tools">
        <select
          aria-label="Preview definition"
          value={definition}
          disabled={busy || (job !== null && !jobDone && !failed)}
          onChange={(event) =>
            setDefinition(event.target.value as GroupDefinition)
          }
        >
          <option value="physical">Physical groups</option>
          <option value="suite">MD suites</option>
        </select>
        <select
          aria-label="Preview variants"
          value={variantChoice}
          disabled={busy || (job !== null && !jobDone && !failed)}
          onChange={(event) =>
            setVariantChoice(event.target.value as "both" | GroupPreviewVariant)
          }
        >
          <option value="both">Both images (MD + hierarchy)</option>
          <option value="portrait">MD portrait only</option>
          <option value="hierarchy">Hierarchy only</option>
        </select>
        <select
          aria-label="Number of groups"
          value={batchSize}
          disabled={busy || (job !== null && !jobDone && !failed)}
          onChange={(event) => setBatchSize(Number(event.target.value))}
        >
          <option value={1}>First 1 group (quality check)</option>
          <option value={24}>First 24 groups</option>
          <option value={96}>First 96 groups</option>
          <option value={groups.length}>All {groups.length} groups</option>
        </select>
        <button
          type="button"
          disabled={
            busy ||
            groups.length === 0 ||
            !cache?.write_enabled ||
            (job !== null && !jobDone && !failed)
          }
          onClick={() => {
            void buildBatch();
          }}
        >
          Generate missing previews
        </button>
      </div>
      <p role="status">{status}</p>
      {failed && (
        <p role="alert">Rendering stopped. A failed capture is not saved.</p>
      )}
      {detail && portraitFov !== null && current && !failed && (
        <div
          className="group-preview-capture-map"
          aria-label={`Preview generator: ${detail.name}, ${current.variant}`}
        >
          <GroupSkyMap
            key={`${definition}-${detail.root_pgc}-${current.variant}`}
            group={detail}
            miniature
            previewVariant={current.variant}
            portraitFov={portraitFov}
            onSnapshot={onSnapshot}
            onSnapshotError={onSnapshotError}
          />
        </div>
      )}
      <p>
        <Link to="/groups">← Return to Groups</Link>
      </p>
    </main>
  );
}
