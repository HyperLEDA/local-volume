import { describe, expect, test } from "bun:test";
import {
  atlasLayerVisible,
  atlasMdEdges,
  DEFAULT_ATLAS_LAYERS,
} from "../src/lib/atlasScientificLayers.ts";
import type { AtlasSpatialPoint } from "../src/lib/atlasSpatialScene.ts";

function point(
  pgc: number,
  md: number | null,
  kind: AtlasSpatialPoint["kind"] = "individual",
): AtlasSpatialPoint {
  return {
    object: { pgc, md_pgc: md },
    position: [pgc, 0, 0],
    kind,
  } as AtlasSpatialPoint;
}
describe("atlas scientific layers", () => {
  test("independent layers, galaxy mode unaffected", () => {
    const layers = { ...DEFAULT_ATLAS_LAYERS, groups: false };
    expect(atlasLayerVisible(true, true, layers)).toBe(false);
    expect(atlasLayerVisible(false, true, layers)).toBe(true);
    expect(atlasLayerVisible(true, false, layers)).toBe(true);
    expect(atlasLayerVisible(false, true, { ...layers, field: false })).toBe(
      false,
    );
  });
  test("explicit directed MD identifiers only", () => {
    expect(
      atlasMdEdges([point(1, 2), point(2, null), point(3, 3), point(4, 99)]),
    ).toEqual([{ memberPgc: 1, mdPgc: 2, from: [1, 0, 0], to: [2, 0, 0] }]);
  });
  test("no assigned, model or unavailable endpoint", () => {
    expect(
      atlasMdEdges([
        point(1, 2),
        point(2, null, "assigned"),
        point(3, 1, "model"),
        point(4, 99),
      ]),
    ).toEqual([]);
  });
  test("duplicate identity fails closed", () => {
    expect(atlasMdEdges([point(1, 2), point(2, null), point(2, null)])).toEqual(
      [],
    );
  });
});
