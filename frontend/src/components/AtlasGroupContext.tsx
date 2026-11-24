import type { CatalogObject } from "../api/objects.ts";
import type { buildAtlasGroupGraph } from "../lib/atlasGroupContext.ts";
import type { useAtlasGroupContext } from "../lib/useAtlasGroupContext.ts";
import "./atlasGroupContext.css";

// Physical-only Atlas status for assistive technology. No separate visual panel.
export function AtlasGroupContext({
  context,
  selected,
  graph,
  outsideCount,
  hasMd,
}: {
  context: ReturnType<typeof useAtlasGroupContext>;
  selected: CatalogObject;
  graph: ReturnType<typeof buildAtlasGroupGraph> | null;
  outsideCount: number;
  hasMd: boolean;
}) {
  const membership = context.selected;
  let message = "";
  if (context.status === "loading") {
    message = "Loading physical group membership.";
  } else if (context.status === "ready" && membership && graph) {
    message = `${membership.name}: physical group, ${membership.data_status}, ${membership.source_catalog} / ${membership.source_version}. ${graph.arcs.length} relations; ${graph.points.length}/${graph.acceptedCount} members on Atlas; ${outsideCount} outside filters. ${graph.candidateCount} candidate members excluded. Sky-plane relations are not proof of gravitational binding.`;
  } else if (context.status === "none" || context.status === "error") {
    message = `${context.status === "error" ? "Physical group context unavailable or ambiguous" : "No resolved physical group"}. ${hasMd ? "Individual MD only." : "No identified MD on map."}`;
  }
  return (
    <span className="atlas-group-context-status" role="status">
      {selected.name}: {message}
    </span>
  );
}
