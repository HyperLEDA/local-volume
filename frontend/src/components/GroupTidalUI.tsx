import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import "./groupSubgroupInteractions.css";
import type { GroupDetail, GroupMember } from "../api/groups.ts";
import {
  greatCircleVertices,
  visibleGreatCircleSegments,
} from "../lib/mdConnection.ts";
import { trimGroupEdge } from "../lib/groupEdgeTrim.ts";
import {
  buildCelestialSubgroups,
  type CelestialSubgroup,
} from "../lib/groupCelestialSubgroups.ts";
import {
  groupTidalEdges,
  TIDAL_TONES,
  tidalEdgeTooltip,
  type TidalEdge,
  type TidalTone,
} from "../lib/groupTidalEdges.ts";

export type GroupProjection = {
  world2pix: (ra: number, dec: number) => [number, number] | null;
  pix2world: (x: number, y: number) => number[] | null;
};

type DrawnEdge = {
  key: string;
  edge: TidalEdge;
  paths: string[];
  anchor: [number, number];
};
type Halo = CelestialSubgroup;
type Selected =
  | {
      kind: "edge";
      key: string;
      text: readonly [string, string];
      x: number;
      y: number;
    }
  | { kind: "subgroup"; pgc: number; x: number; y: number };

function toPath(
  vertices: readonly [number, number][],
  project: GroupProjection,
): string | null {
  const pts = vertices.map(([ra, dec]) => project.world2pix(ra, dec));
  if (
    pts.length < 2 ||
    pts.some((p) => !p || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))
  ) {
    return null;
  }
  return pts
    .map(
      (p, index) =>
        `${index === 0 ? "M" : "L"}${p![0].toFixed(2)} ${p![1].toFixed(2)}`,
    )
    .join(" ");
}

/** Marker/sky interactions are delegated from the map, never intercepted by a filled SVG. */
export function GroupTidalUI({
  group,
  view,
  revision,
  width,
  height,
  onMemberNavigate,
  onSubgroupPresentation,
}: {
  group: GroupDetail;
  view: GroupProjection | null;
  revision: number;
  width: number;
  height: number;
  onMemberNavigate?: (pgc: number) => string | null;
  onSubgroupPresentation?: (state: {
    enabled: boolean;
    filter: number | "all";
    emphasized: number | null;
  }) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [hoveredSubgroup, setHoveredSubgroup] = useState<number | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [showSubgroups, setShowSubgroups] = useState(true);
  const [visibleSubgroup, setVisibleSubgroup] = useState<number | "all">("all");
  const members = group.members;
  // The membership footprint is immutable with respect to camera and cursor.
  const celestialHalos = useMemo(
    () => (group.root_pgc === 5064336 ? [] : buildCelestialSubgroups(group)),
    [group],
  );

  const drawn = useMemo(() => {
    // Aladin changes the projection in place. This key invalidates cached pixels.
    void revision;
    if (!view || width <= 0 || height <= 0) {
      return { edges: [] as DrawnEdge[], halos: celestialHalos };
    }
    const byPgc = new Map(members.map((member) => [member.pgc, member]));
    const edges: DrawnEdge[] = [];
    for (const edge of groupTidalEdges(members)) {
      const a = byPgc.get(edge.memberPgc);
      const b = byPgc.get(edge.parentPgc);
      if (
        !a ||
        !b ||
        a.ra === null ||
        a.dec === null ||
        b.ra === null ||
        b.dec === null
      )
        continue;
      const arc = greatCircleVertices(
        { ra: a.ra, dec: a.dec },
        { ra: b.ra, dec: b.dec },
      );
      const trimmed = trimGroupEdge(arc, 11, 11, (ra, dec) =>
        view.world2pix(ra, dec),
      );
      const segments = visibleGreatCircleSegments(
        trimmed,
        (ra, dec) => view.world2pix(ra, dec),
        width,
      );
      const paths = segments
        .map((segment) => toPath(segment, view))
        .filter((p): p is string => p !== null);
      if (!paths.length) continue;
      // This is only a keyboard/popover anchor, not a physical midpoint.
      const first = view.world2pix(a.ra, a.dec);
      const last = view.world2pix(b.ra, b.dec);
      const segment = segments.reduce<[number, number][]>(
        (best, current) => (current.length > best.length ? current : best),
        [],
      );
      const mid = segment[Math.floor(segment.length / 2)];
      const segmentAnchor =
        group.root_pgc === 5064336 && segment.length
          ? view.world2pix(mid[0], mid[1])
          : null;
      const anchor: [number, number] =
        segmentAnchor ??
        (first && last
          ? [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2]
          : [width / 2, height / 2]);
      edges.push({
        key: `${edge.memberPgc}:${edge.parentPgc}`,
        edge,
        paths,
        anchor,
      });
    }

    // Aladin owns the celestial outlines; React only draws tidal hit targets.
    return { edges, halos: celestialHalos };
  }, [members, view, revision, width, height, celestialHalos, group.root_pgc]);

  useEffect(() => {
    setSelected(null);
    setHoveredEdge(null);
    setHoveredSubgroup(null);
    setVisibleSubgroup("all");
  }, [group.group_id, group.definition, group.source_version]);

  useEffect(() => {
    // Previously selected screen positions are invalid after panning/zooming.
    setSelected(null);
  }, [revision]);

  useEffect(() => {
    if (
      visibleSubgroup !== "all" &&
      !drawn.halos.some((h) => h.pgc === visibleSubgroup)
    ) {
      setVisibleSubgroup("all");
    }
  }, [drawn.halos, visibleSubgroup]);

  useEffect(() => {
    if (!selected) return;
    function closeOnEscape(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") setSelected(null);
    }
    function closeOutside(event: PointerEvent): void {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        !target.closest(
          ".group-tidal-hit, .group-tidal-popup, .group-tidal-subgroups-control",
        )
      )
        setSelected(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [selected]);

  const filteredHalos = useMemo(
    () =>
      showSubgroups
        ? drawn.halos.filter(
            (halo) => visibleSubgroup === "all" || halo.pgc === visibleSubgroup,
          )
        : [],
    [drawn.halos, showSubgroups, visibleSubgroup],
  );

  useEffect(() => {
    onSubgroupPresentation?.({
      enabled: showSubgroups,
      filter: visibleSubgroup,
      emphasized: showSubgroups
        ? selected?.kind === "subgroup"
          ? selected.pgc
          : hoveredSubgroup
        : null,
    });
  }, [
    onSubgroupPresentation,
    showSubgroups,
    visibleSubgroup,
    hoveredSubgroup,
    selected,
  ]);

  useEffect(() => {
    const frame = frameRef.current;
    const map = frame?.parentElement;
    if (!map || !view || width <= 0 || height <= 0) return;
    function point(event: globalThis.MouseEvent | PointerEvent): {
      x: number;
      y: number;
    } {
      const rect = map!.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) * width) / rect.width,
        y: ((event.clientY - rect.top) * height) / rect.height,
      };
    }
    function isControl(event: Event): boolean {
      const target = event.target;
      return (
        target instanceof Element &&
        !!target.closest(
          ".group-tidal-subgroups-control, .group-tidal-popup, .group-tidal-hit, " +
            ".aladin-toolbar, .aladin-popup, .aladin-context-menu, button, a, input, select",
        )
      );
    }
    function onMarker(x: number, y: number): boolean {
      // Use CURRENT Aladin pixels, not a React snapshot from an earlier frame.
      return members.some((member) => {
        if (member.ra === null || member.dec === null) return false;
        const p = view!.world2pix(member.ra, member.dec);
        return (
          p !== null &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]) &&
          Math.hypot(p[0] - x, p[1] - y) <= 13
        );
      });
    }
    function hit(x: number, y: number): Halo | undefined {
      try {
        const sky = view!.pix2world(x, y);
        if (!sky || sky.length < 2) return undefined;
        return filteredHalos.find((halo) => halo.containsSky(sky[0], sky[1]));
      } catch {
        // A cursor outside the projection cannot select a subgroup.
        return undefined;
      }
    }
    function move(event: PointerEvent): void {
      if (isControl(event)) {
        setHoveredSubgroup(null);
        return;
      }
      const { x, y } = point(event);
      const pgc = onMarker(x, y) ? null : (hit(x, y)?.pgc ?? null);
      setHoveredSubgroup((old) => (old === pgc ? old : pgc));
    }
    function down(event: PointerEvent): void {
      pointerDownRef.current = point(event);
    }
    function click(event: globalThis.MouseEvent): void {
      if (
        isControl(event) ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const { x, y } = point(event);
      const start = pointerDownRef.current;
      if (start && Math.hypot(start.x - x, start.y - y) > 6) return;
      if (onMarker(x, y)) return; // Let the native Aladin galaxy marker open normally.
      const halo = hit(x, y);
      if (!halo) return;
      event.preventDefault();
      event.stopPropagation();
      const popupWidth = Math.min(290, Math.max(180, width - 16));
      setSelected({
        kind: "subgroup",
        pgc: halo.pgc,
        x: Math.min(width - popupWidth - 8, Math.max(8, x + 10)),
        y: Math.min(
          height - Math.min(290, height * 0.55) - 8,
          Math.max(8, y + 8),
        ),
      });
    }
    map.addEventListener("pointermove", move, true);
    map.addEventListener("pointerdown", down, true);
    map.addEventListener("click", click, true);
    return () => {
      map.removeEventListener("pointermove", move, true);
      map.removeEventListener("pointerdown", down, true);
      map.removeEventListener("click", click, true);
    };
  }, [filteredHalos, members, view, width, height]);

  if (!view || width <= 0 || height <= 0) return null;
  const tones: TidalTone[] = ["positive", "negative", "zero", "unknown"];
  const presentTones = new Set(drawn.edges.map(({ edge }) => edge.tone));
  const edgePopupWidth = Math.min(242, Math.max(170, width - 16));
  const subgroupPopupWidth = Math.min(290, Math.max(180, width - 16));
  const activeSubgroup =
    selected?.kind === "subgroup"
      ? drawn.halos.find((h) => h.pgc === selected.pgc)
      : undefined;
  const byPgc = new Map(members.map((m) => [m.pgc, m]));

  function selectEdge(item: DrawnEdge, x: number, y: number): void {
    setSelected({
      kind: "edge",
      key: item.key,
      text: tidalEdgeTooltip(item.edge),
      x: Math.min(width - edgePopupWidth - 8, Math.max(8, x)),
      y: Math.min(height - 76, Math.max(8, y)),
    });
  }
  function clickEdge(event: MouseEvent<SVGPathElement>, item: DrawnEdge): void {
    event.preventDefault();
    event.stopPropagation();
    const rect = frameRef.current?.getBoundingClientRect();
    selectEdge(
      item,
      rect ? event.clientX - rect.left + 8 : item.anchor[0],
      rect ? event.clientY - rect.top + 8 : item.anchor[1],
    );
  }
  function keyboardEdge(
    event: KeyboardEvent<SVGPathElement>,
    item: DrawnEdge,
  ): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectEdge(item, item.anchor[0], item.anchor[1]);
  }
  function openChosenSubgroup(): void {
    const halo =
      visibleSubgroup === "all"
        ? drawn.halos.length === 1
          ? drawn.halos[0]
          : undefined
        : drawn.halos.find((item) => item.pgc === visibleSubgroup);
    if (halo)
      setSelected({
        kind: "subgroup",
        pgc: halo.pgc,
        x: Math.max(8, width - subgroupPopupWidth - 8),
        y: Math.max(8, height * 0.28),
      });
  }
  function memberOpen(
    event: MouseEvent<HTMLAnchorElement>,
    member: GroupMember,
  ): void {
    if (
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    const route = onMemberNavigate?.(member.pgc);
    if (!route) return;
    event.preventDefault();
    void navigate(route);
  }

  return (
    <div className="group-tidal-ui" ref={frameRef}>
      <svg
        className="group-tidal-hitmap"
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Group tidal connections and selectable subgroup regions"
      >
        {/* Subgroup outlines are native sky polygons, not reprojected SVG paths. */}
        {drawn.edges.map((item) =>
          item.paths.map((path, index) => (
            <g key={`${item.key}-${index}`}>
              {(hoveredEdge === item.key ||
                (selected?.kind === "edge" && selected.key === item.key)) && (
                <path
                  d={path}
                  fill="none"
                  stroke={TIDAL_TONES[item.edge.tone]}
                  strokeWidth={
                    selected?.kind === "edge" && selected.key === item.key
                      ? 3.1
                      : 2.5
                  }
                  strokeOpacity="0.96"
                  className="group-tidal-highlight"
                  pointerEvents="none"
                />
              )}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="15"
                role="button"
                tabIndex={0}
                className="group-tidal-hit"
                aria-label={`${item.edge.memberName} to ${item.edge.parentName}; ${tidalEdgeTooltip(item.edge)[1]}`}
                onMouseEnter={() => setHoveredEdge(item.key)}
                onMouseLeave={() => setHoveredEdge(null)}
                onFocus={() => setHoveredEdge(item.key)}
                onBlur={() => setHoveredEdge(null)}
                onClick={(event: MouseEvent<SVGPathElement>) =>
                  clickEdge(event, item)
                }
                onKeyDown={(event: KeyboardEvent<SVGPathElement>) =>
                  keyboardEdge(event, item)
                }
              />
            </g>
          )),
        )}
      </svg>
      <div className="group-tidal-legend" aria-label="Tidal index sign legend">
        {tones
          .filter((tone) => presentTones.has(tone))
          .map((tone) => (
            <span key={tone}>
              <i style={{ background: TIDAL_TONES[tone] }} />
              {tone === "positive"
                ? "Θ > 0"
                : tone === "negative"
                  ? "Θ < 0"
                  : tone === "zero"
                    ? "Θ = 0"
                    : "Θ unavailable"}
            </span>
          ))}
      </div>
      {drawn.halos.length > 0 && (
        <div className="group-tidal-subgroups-control">
          <label>
            <input
              type="checkbox"
              checked={showSubgroups}
              onChange={(event) => {
                setShowSubgroups(event.target.checked);
                if (!event.target.checked) {
                  setHoveredSubgroup(null);
                  setSelected(null);
                }
              }}
            />{" "}
            Subgroups
          </label>
          {showSubgroups && drawn.halos.length > 1 && (
            <select
              aria-label="Show subgroup"
              value={visibleSubgroup}
              onChange={(event) =>
                setVisibleSubgroup(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
            >
              <option value="all">All MDs</option>
              {drawn.halos.map((halo) => (
                <option key={halo.pgc} value={halo.pgc}>
                  {halo.name}
                </option>
              ))}
            </select>
          )}
          {showSubgroups &&
            (visibleSubgroup !== "all" || drawn.halos.length === 1) && (
              <button type="button" onClick={openChosenSubgroup}>
                Members
              </button>
            )}
        </div>
      )}
      {selected?.kind === "edge" && (
        <div
          className="group-tidal-popup"
          role="dialog"
          aria-label="Selected tidal pair"
          style={{ left: selected.x, top: selected.y, width: edgePopupWidth }}
        >
          <div>{selected.text[0]}</div>
          <div>{selected.text[1]}</div>
        </div>
      )}
      {selected?.kind === "subgroup" && activeSubgroup && (
        <div
          className="group-tidal-popup group-tidal-subgroup-popup"
          role="dialog"
          aria-label={`${activeSubgroup.name} subgroup members`}
          style={{
            left: selected.x,
            top: selected.y,
            width: subgroupPopupWidth,
          }}
        >
          <div className="group-tidal-subgroup-popup-title">
            <strong>{activeSubgroup.name} subgroup</strong>
            <button
              type="button"
              aria-label="Close subgroup"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </div>
          <ul aria-label="Subgroup galaxies">
            {activeSubgroup.memberPgcs.map((pgc) => {
              const member = byPgc.get(pgc);
              if (!member) return null;
              return (
                <li key={pgc}>
                  <Link
                    to={`/object/${pgc}`}
                    onClick={(event) => memberOpen(event, member)}
                  >
                    {member.name} <span>PGC {pgc}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
