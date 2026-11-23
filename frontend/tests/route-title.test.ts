import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { routeDocumentTitle } from "../src/lib/routeTitle.ts";

describe("#85 browser title follows SPA navigation", () => {
  test("static sections do not inherit About title", () => {
    expect(routeDocumentTitle("/about")).toBe("About LV LEDA | LV LEDA");
    expect(routeDocumentTitle("/")).toBe(
      "LV LEDA | Galaxies of the Nearby Universe",
    );
    expect(routeDocumentTitle("/groups")).toBe(
      "Physical galaxy groups | LV LEDA",
    );
    expect(routeDocumentTitle("/documents")).toBe(
      "Scientific documents | LV LEDA",
    );
    expect(routeDocumentTitle("/publications")).toBe("Publications | LV LEDA");
    expect(routeDocumentTitle("/acknowledgements")).toBe(
      "Acknowledgements | LV LEDA",
    );
  });

  test("dynamic and filtered destinations have meaningful titles", () => {
    expect(routeDocumentTitle("/object/29146")).toBe(
      "Galaxy PGC 29146 | LV LEDA",
    );
    expect(routeDocumentTitle("/groups/29146", "?definition=suite")).toBe(
      "MD suite PGC 29146 | LV LEDA",
    );
    expect(routeDocumentTitle("/groups", "?definition=suite")).toBe(
      "MD suites | LV LEDA",
    );
    expect(routeDocumentTitle("/groups/preview-builder")).toBe(
      "Group preview builder | LV LEDA",
    );
  });

  test("App updates document.title on route changes without overwriting the direct-visit title", () => {
    const app = readFileSync(
      new URL("../src/App.tsx", import.meta.url),
      "utf8",
    );
    expect(app).toContain("document.title = routeDocumentTitle(");
    expect(app).toContain(
      "const previousLocationKey = useRef(deferredLocation.key)",
    );
    expect(app).toContain("deferredLocation.pathname");
  });
});
