import { useState } from "react";
import {
  morphologyColor,
  UNKNOWN_MORPHOLOGY_COLOR,
} from "../lib/morphologyColors.ts";
import type { AtlasRange } from "../lib/atlasBounds.ts";

const SAMPLES = [-3, -1, 0, 2, 5, 9];

function fmt(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/** Hidden by default; hover, keyboard focus and touch clicks open the legend. */
export function AtlasLegend({ tidalRange }: { tidalRange: AtlasRange | null }) {
  const [pinned, setPinned] = useState(false);
  return (
    <div
      className={`atlas-legend-anchor${pinned ? " atlas-legend-anchor--pinned" : ""}`}
    >
      <button
        type="button"
        className="atlas-legend-button"
        aria-label="Show map legend"
        aria-controls="atlas-map-legend"
        aria-expanded={pinned}
        title="Map legend"
        onClick={() => setPinned((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setPinned(false);
        }}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      <div id="atlas-map-legend" className="atlas-legend-panel" role="tooltip">
        <strong>Map legend</strong>
        <div className="atlas-legend-section">
          <span>Morphology · color</span>
          <div className="atlas-legend-swatches">
            {SAMPLES.map((t) => (
              <span key={t} style={{ backgroundColor: morphologyColor(t) }} />
            ))}
          </div>
          <div className="atlas-legend-label-pair">
            <span>Early (T &lt; 0)</span>
            <span>Late (T &gt; 0)</span>
          </div>
          <div className="atlas-legend-unknown">
            <span style={{ backgroundColor: UNKNOWN_MORPHOLOGY_COLOR }} />{" "}
            Unknown T
          </div>
        </div>
        <div className="atlas-legend-section">
          <span>B magnitude · diameter</span>
          <div className="atlas-legend-sizes">
            <span className="atlas-legend-circle atlas-legend-circle--small" />
            <span className="atlas-legend-circle atlas-legend-circle--large" />{" "}
            7–14 px · brighter = larger
          </div>
        </div>
        <div
          className="atlas-legend-section"
          title="Calculated from the incomplete Local Volume donor census; scientific interpretation remains provisional"
        >
          <span>
            Θ<sub>1</sub> · stroke
          </span>
          <div className="atlas-legend-strokes">
            <span className="atlas-legend-stroke atlas-legend-stroke--thin" />
            {tidalRange ? fmt(tidalRange.min) : "—"}
            <span className="atlas-legend-stroke atlas-legend-stroke--thick" />
            {tidalRange ? fmt(tidalRange.max) : "—"}
          </div>
          <div className="atlas-legend-detail">
            1.2–2.2 px · missing: 1.5 px
          </div>
          <div className="atlas-legend-detail">
            Min/max from entire loaded catalogue
          </div>
        </div>
      </div>
    </div>
  );
}
