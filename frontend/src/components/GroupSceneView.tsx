import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GroupDetail } from "../api/groups.ts";
import { buildGroupScene, type PositionKind } from "../lib/groupScene3d.ts";
import {
  visibleScenePoint,
  type SceneView,
} from "../lib/groupSceneWebGLPolicy.ts";
import {
  frameAxisLabels,
  viewerScene,
  type SceneFrameMode,
} from "../lib/groupSceneSupergalactic.ts";
import GroupSceneThree from "./GroupSceneThree.tsx";
import "./GroupSceneView.css";
import {
  groupSessionId,
  readGroupPreferences,
  saveGroupPreferences,
} from "../lib/groupSession.ts";

const KINDS: Record<PositionKind, string> = {
  INDIVIDUAL_ADOPTED: "Individual catalogue distance",
  ASSIGNED_PROJECTION: "Group-assigned · depth unknown",
  MODEL_ESTIMATE: "Model estimate",
  UNCLASSIFIED_ESTIMATE: "Unclassified estimate",
  DIRECTION_ONLY: "Direction only",
  UNAVAILABLE: "Position unavailable",
};
function value(n: number | null | undefined, digits = 2) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "—";
}
export default function GroupSceneView({
  group,
  onMemberNavigate,
  onClose,
}: {
  group: GroupDetail;
  onMemberNavigate: (pgc: number) => string | null;
  onClose: () => void;
}) {
  const sessionId = groupSessionId(
    group.definition,
    group.group_id,
    group.root_pgc,
  );
  const [restored] = useState(() =>
    readGroupPreferences(
      sessionId,
      new Set(group.members.map((member) => member.pgc)),
      group.root_pgc,
    ),
  );
  const [frameMode, setFrameMode] = useState<SceneFrameMode>(
    restored.frameMode,
  );
  const localScene = useMemo(() => buildGroupScene(group), [group]);
  const scene = useMemo(
    () => viewerScene(localScene, frameMode),
    [localScene, frameMode],
  );
  const axisLabels = frameAxisLabels(frameMode);
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const [inspectorOpen, setInspectorOpen] = useState(restored.inspectorOpen);
  const [selected, setSelected] = useState<number | null>(restored.selected);
  const [relations, setRelations] = useState<boolean>(restored.relations);
  const [individualOnly, setIndividualOnly] = useState<boolean>(
    restored.individualOnly,
  );

  const [grid, setGrid] = useState<boolean>(restored.grid);
  const [box, setBox] = useState<boolean>(restored.box);
  const [sphere, setSphere] = useState<boolean>(restored.sphere);
  const [view, setView] = useState<SceneView>(restored.view);
  const [viewRevision, setViewRevision] = useState(0);
  const current = scene.points.find((p) => p.pgc === selected);
  const count = scene.points.filter((p) =>
    visibleScenePoint(p, individualOnly),
  ).length;
  const individual = scene.points.filter(
    (p) => p.kind === "INDIVIDUAL_ADOPTED",
  ).length;
  const assigned = scene.points.filter(
    (p) => p.kind === "ASSIGNED_PROJECTION",
  ).length;
  const other = scene.points.length - individual - assigned;
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);
  useEffect(() => {
    saveGroupPreferences(sessionId, {
      frameMode,
      view,
      selected,
      inspectorOpen,
      relations,
      individualOnly,
      grid,
      box,
      sphere,
    });
  }, [
    sessionId,
    frameMode,
    view,
    selected,
    inspectorOpen,
    relations,
    individualOnly,
    grid,
    box,
    sphere,
  ]);
  function setCamera(next: SceneView) {
    setView(next);
    setViewRevision((n) => n + 1);
  }
  function switchFrame(next: SceneFrameMode) {
    setFrameMode(next);
    setCamera("orbit");
  }
  return (
    <dialog
      className={
        inspectorOpen
          ? "lv-three-dialog"
          : "lv-three-dialog lv-three-dialog--solo"
      }
      ref={dialog}
      aria-labelledby="lv-three-title"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        dialog.current?.close();
      }}
    >
      <div className="lv-three-shell">
        <header className="lv-three-header">
          <div>
            <h2 id="lv-three-title">
              {group.name} <span>Group · 3D</span>
            </h2>
            <p>
              {group.definition} · {scene.points.length} members
            </p>
          </div>
          <button
            className="lv-three-inspector-toggle"
            type="button"
            aria-expanded={inspectorOpen}
            aria-controls="lv-three-inspector-panel"
            onClick={() => setInspectorOpen((open) => !open)}
          >
            {inspectorOpen ? "Hide inspector" : "Show inspector"}
          </button>
          <button
            className="lv-three-close"
            type="button"
            aria-label="Close 3D Group"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div className="lv-three-toolbar">
          <div className="lv-three-segments" aria-label="Coordinate frame">
            <button
              type="button"
              aria-pressed={frameMode === "LOCAL"}
              onClick={() => switchFrame("LOCAL")}
            >
              Local
            </button>
            <button
              type="button"
              aria-pressed={frameMode === "SUPERGALACTIC"}
              onClick={() => switchFrame("SUPERGALACTIC")}
            >
              Supergalactic
            </button>
          </div>
          <div className="lv-three-segments" aria-label="Camera projections">
            {(["orbit", "XY", "XZ", "YZ"] as const).map((v, i) => (
              <button key={v} type="button" onClick={() => setCamera(v)}>
                {v === "orbit"
                  ? "Fit view"
                  : frameMode === "SUPERGALACTIC"
                    ? ["", "SGX–SGY", "SGX–SGZ", "SGY–SGZ"][i]
                    : v}
              </button>
            ))}
          </div>
          <div className="lv-three-segments" aria-label="Scene layers">
            <button
              type="button"
              aria-pressed={relations}
              onClick={() => setRelations((v) => !v)}
            >
              Relations {relations ? "on" : "off"}
            </button>
            <button
              type="button"
              aria-pressed={grid}
              onClick={() => setGrid((v) => !v)}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={box}
              onClick={() => setBox((v) => !v)}
              title="Show coordinate frame"
            >
              Box
            </button>
            <button
              type="button"
              aria-pressed={sphere}
              onClick={() => setSphere((v) => !v)}
              title="Display sphere enclosing catalogue positions; not a physical group radius"
            >
              Sphere
            </button>

            <button
              type="button"
              aria-pressed={individualOnly}
              onClick={() => setIndividualOnly((v) => !v)}
            >
              Individual D only
            </button>
          </div>
        </div>
        <div
          className={
            inspectorOpen
              ? "lv-three-workspace"
              : "lv-three-workspace lv-three-workspace--wide"
          }
        >
          <section className="lv-three-main" aria-label="Group spatial scene">
            {scene.status === "READY" ? (
              <GroupSceneThree
                sessionId={sessionId}
                scene={scene}
                members={group.members}
                selected={selected}
                onSelect={setSelected}
                relations={relations}
                individualOnly={individualOnly}
                grid={grid}
                box={box}
                sphere={sphere}
                view={view}
                viewRevision={viewRevision}
                frameMode={frameMode}
              />
            ) : (
              <div className="lv-three-unavailable" role="status">
                {scene.status === "CENTRE_UNAVAILABLE"
                  ? "The catalogue centre has no usable adopted distance."
                  : "Group identity or membership is inconsistent."}{" "}
                Use the sky map or inspect members in the panel.
              </div>
            )}
            <div className="lv-three-key">
              <span className="lv-three-visible-count">
                <b>{count}</b> / {scene.points.length} · {individual} individual
                · {assigned} assigned{other > 0 ? ` · ${other} other` : ""}
              </span>
              <span>
                <i className="lv-three-key-dot" />
                Individual
              </span>
              <span>
                <i className="lv-three-key-diamond" />
                Assigned (LOS unknown)
              </span>
              <span>△ Model</span>
              <span>□ Unknown</span>
              <span className="lv-three-key-morph">
                <i /> T: early → late
              </span>
              <span
                className="lv-three-view-help"
                title="Drag: orbit; right drag: pan; scroll or pinch: zoom; click: select"
              >
                Drag · zoom · select
              </span>
            </div>
          </section>
          <aside
            className="lv-three-inspector"
            id="lv-three-inspector-panel"
            aria-label="Scene data and legend"
            hidden={!inspectorOpen}
          >
            <div className="lv-three-reference-strip">
              <span>Scene centre</span>
              <strong>
                {scene.centre?.name ?? "Unavailable"} ·{" "}
                {value(scene.centre?.distanceMpc, 3)} Mpc
              </strong>
              <span>
                {frameMode === "SUPERGALACTIC"
                  ? "SG offsets relative to the adopted group centre"
                  : "East / North / LOS away from observer"}
              </span>
            </div>
            <div className="lv-three-panel">
              <h3>Galaxy inspector</h3>
              <label className="lv-three-select-label">
                Select member
                <select
                  value={selected ?? ""}
                  onChange={(e) =>
                    setSelected(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">Select galaxy</option>
                  {scene.points.map((p) => (
                    <option key={p.pgc} value={p.pgc}>
                      {p.name}
                      {p.displayPositionKpc === null ? " · no position" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {current && (
                <div aria-live="polite">
                  <div className="lv-three-object-name">{current.name}</div>
                  <div className="lv-three-muted">
                    PGC {current.pgc} · {KINDS[current.kind]}
                  </div>
                  <dl className="lv-three-data">
                    <dt>Adopted D</dt>
                    <dd>{value(current.adoptedDistanceMpc, 3)} Mpc</dd>
                    <dt>Method</dt>
                    <dd>{current.method ?? "—"}</dd>
                    <dt>Source review</dt>
                    <dd>
                      {(current.valueReview ?? "NOT_REVIEWED")
                        .toLowerCase()
                        .replace(/_+/g, " ")}
                    </dd>
                    <dt>
                      M<sub>B</sub>
                    </dt>
                    <dd>{value(current.absBMag)} mag</dd>
                    <dt>Morphology T</dt>
                    <dd>{value(current.morphologyT, 1)}</dd>
                  </dl>
                  {current.displayPositionKpc && (
                    <div className="lv-three-coords">
                      {current.displayPositionKpc.map((n, i) => (
                        <div key={i}>
                          <span>{axisLabels[i]}</span>
                          <b>
                            {frameMode === "LOCAL" &&
                            i === 2 &&
                            current.kind === "ASSIGNED_PROJECTION"
                              ? "—"
                              : value(n, 1)}
                          </b>
                          <small>
                            {frameMode === "LOCAL" &&
                            i === 2 &&
                            current.kind === "ASSIGNED_PROJECTION"
                              ? "unknown"
                              : frameMode === "SUPERGALACTIC" &&
                                  current.kind === "ASSIGNED_PROJECTION"
                                ? "schematic kpc"
                                : "kpc"}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                  {current.kind === "ASSIGNED_PROJECTION" && (
                    <p className="lv-three-muted">
                      {frameMode === "SUPERGALACTIC"
                        ? "Rotated schematic plane; all displayed SG offsets are conditional and true depth is unknown."
                        : "Schematic plane. LOS = 0 is a display convention, not a measured depth."}
                    </p>
                  )}
                  {current.interval && (
                    <p className="lv-three-muted">
                      D interval: −{value(current.interval.minusMpc, 3)} / +
                      {value(current.interval.plusMpc, 3)} Mpc ·{" "}
                      {current.interval.quality === "VERIFIED"
                        ? "verified"
                        : "catalogue, unreviewed"}
                    </p>
                  )}
                  {!visibleScenePoint(current, individualOnly) && (
                    <p className="lv-three-muted">
                      Not positioned or excluded by the current filter.
                    </p>
                  )}
                  <p className="lv-three-reference">
                    {current.reference ?? "No paired distance reference"}
                  </p>
                  <button
                    className="lv-three-open"
                    type="button"
                    onClick={() => {
                      const route = onMemberNavigate(current.pgc);
                      if (route) {
                        dialog.current?.close();
                        void navigate(route);
                      }
                    }}
                  >
                    Open galaxy ↗
                  </button>
                </div>
              )}
            </div>
            <details className="lv-three-panel lv-three-legend">
              <summary>Display conventions</summary>
              <div>
                <span>○</span> Individual adopted distance
              </div>
              <div>
                <span>◇</span> Assigned projection plane
              </div>
              <div>
                <span>△</span> Model estimate
              </div>
              <div>
                <span>□</span> Unclassified estimate
              </div>
              <div>
                <span className="lv-three-gold">◎</span> Centre / selected
                object
              </div>
              <div className="lv-three-morph">
                <span>Early T</span>
                <i />
                <span>Late T</span>
              </div>
              <p className="lv-three-muted">
                Size encodes absolute B magnitude, not galaxy diameter.
                Relations: green Θ₁ &gt; 0, purple Θ₁ &lt; 0, grey zero or
                unknown. Dashed relations include schematic endpoints. Catalogue
                intervals are shown only when permitted by the distance-lineage
                model. Box and Sphere are display guides, not measured group
                boundaries. The sphere is centred on the adopted group centre
                and has the maximum radius of all positioned markers, including
                schematic positions. Fit view includes enabled Box and Sphere
                guides. Adopted distances are not necessarily independently
                verified. The grid is the plane through the group centre (LOS =
                0 or relative ΔSGZ = 0), not the absolute supergalactic equator.
                Drag to orbit, right drag to pan, scroll or pinch to zoom. WASD
                or arrows to pan (Shift faster); Enter or double-click to focus.
                Click a galaxy to inspect, empty space to clear. The D interval
                is shown for the selected galaxy only, when available.
              </p>
            </details>
          </aside>
        </div>
      </div>
    </dialog>
  );
}
