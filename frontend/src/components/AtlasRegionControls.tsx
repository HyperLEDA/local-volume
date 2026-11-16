import { useEffect, useRef, useState } from "react";
import {
  describeRegion,
  isValidRegion,
  type SkyRegion,
} from "../lib/skyRegion.ts";

type Props = {
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  region: SkyRegion | null;
  onRegionChange: (region: SkyRegion | null) => void;
  onDraw: (kind: "circle" | "rectangle") => void;
  drawingMode?: "circle" | "rectangle" | null;
};

export function AtlasRegionControls({
  region,
  onRegionChange,
  onDraw,
  drawingMode = null,
  panelOpen,
  onPanelOpenChange,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panelOpen) return;
    function dismissOnOutsidePointer(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      )
        onPanelOpenChange(false);
    }
    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [panelOpen, onPanelOpenChange]);
  const [kind, setKind] = useState<"circle" | "rectangle">("circle");
  const [ra, setRa] = useState("180");
  const [dec, setDec] = useState("0");
  const [radius, setRadius] = useState("30");
  const [raFrom, setRaFrom] = useState("150");
  const [raTo, setRaTo] = useState("180");
  const [decMin, setDecMin] = useState("-10");
  const [decMax, setDecMax] = useState("10");
  const [error, setError] = useState<string | null>(null);

  function openControls() {
    if (!panelOpen && region) {
      setKind(region.kind);
      if (region.kind === "circle") {
        setRa(String(region.center.ra));
        setDec(String(region.center.dec));
        setRadius(String(region.radiusDeg * 60));
      } else {
        setRaFrom(String(region.raFrom));
        setRaTo(String(region.raTo));
        setDecMin(String(region.decMin));
        setDecMax(String(region.decMax));
      }
    }
    setError(null);
    onPanelOpenChange(!panelOpen);
  }

  function apply() {
    const candidate: SkyRegion =
      kind === "circle"
        ? {
            kind: "circle",
            center: { ra: Number(ra), dec: Number(dec) },
            radiusDeg: Number(radius) / 60,
          }
        : {
            kind: "rectangle",
            raFrom: Number(raFrom),
            raTo: Number(raTo),
            decMin: Number(decMin),
            decMax: Number(decMax),
          };
    if (
      !isValidRegion(candidate) ||
      (kind === "circle"
        ? [ra, dec, radius]
        : [raFrom, raTo, decMin, decMax]
      ).some((v) => v.trim() === "")
    ) {
      setError(
        "Use valid ICRS limits with a decimal point; radius in arcminutes and RA in [0, 360).",
      );
      return;
    }
    setError(null);
    onRegionChange(candidate);
    onPanelOpenChange(false);
  }
  return (
    <div className="atlas-filter-anchor" ref={panelRef}>
      <button
        type="button"
        className={`atlas-filters-trigger${region ? " atlas-filters-trigger--active" : ""}`}
        aria-expanded={panelOpen}
        onClick={openControls}
      >
        ▢ Region{drawingMode ? " · drawing" : region ? " · active" : ""}
      </button>
      {panelOpen ? (
        <div
          className="atlas-filter-panel atlas-region-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") onPanelOpenChange(false);
          }}
          role="group"
          aria-label="Select sky region"
        >
          <div className="atlas-filter-heading">
            <strong>Sky region · ICRS</strong>
            <button
              type="button"
              className="atlas-plain-icon"
              aria-label="Close region controls"
              onClick={() => onPanelOpenChange(false)}
            >
              ×
            </button>
          </div>
          <div className="atlas-region-mode">
            <button
              type="button"
              aria-pressed={kind === "circle"}
              onClick={() => setKind("circle")}
            >
              Circle
            </button>
            <button
              type="button"
              aria-pressed={kind === "rectangle"}
              onClick={() => setKind("rectangle")}
            >
              Rectangle
            </button>
          </div>
          <button
            type="button"
            className="atlas-region-draw"
            onClick={() => {
              onDraw(kind);
              onPanelOpenChange(false);
            }}
          >
            Draw on map
          </button>
          <p className="atlas-region-note">
            Zoom in before drawing; preview follows ICRS geometry.
          </p>
          {kind === "circle" ? (
            <div className="atlas-region-fields">
              <label>
                RA (°)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={ra}
                  onChange={(e) => setRa(e.target.value)}
                />
              </label>
              <label>
                Dec (°)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={dec}
                  onChange={(e) => setDec(e.target.value)}
                />
              </label>
              <label>
                Radius (′)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="atlas-region-fields">
              <label>
                RA from (°)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={raFrom}
                  onChange={(e) => setRaFrom(e.target.value)}
                />
              </label>
              <label>
                RA to (°)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={raTo}
                  onChange={(e) => setRaTo(e.target.value)}
                />
              </label>
              <label>
                Dec min (°)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={decMin}
                  onChange={(e) => setDecMin(e.target.value)}
                />
              </label>
              <label>
                Dec max (°)
                <input
                  type="text"
                  inputMode="decimal"
                  spellCheck={false}
                  value={decMax}
                  onChange={(e) => setDecMax(e.target.value)}
                />
              </label>
            </div>
          )}
          <p className="atlas-region-note">
            Rectangle: RA–Dec limits, including wrap at RA = 0°.
          </p>
          {error ? (
            <p className="atlas-region-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="atlas-filter-footer">
            <button
              type="button"
              onClick={() => {
                onRegionChange(null);
                onPanelOpenChange(false);
              }}
            >
              Clear region
            </button>
            <button type="button" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      ) : null}
      {region ? (
        <span className="atlas-region-label" title="Active sky region">
          {describeRegion(region)}
        </span>
      ) : null}
    </div>
  );
}
