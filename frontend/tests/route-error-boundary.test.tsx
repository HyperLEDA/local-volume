import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { RouteLoadErrorBoundary } from "../src/components/RouteLoadErrorBoundary.tsx";

describe("lazy route error recovery", () => {
  test("renders the original page when no error occurs", () => {
    const boundary = new RouteLoadErrorBoundary({
      children: <p>Existing Atlas page</p>,
    });
    expect(renderToStaticMarkup(boundary.render())).toContain(
      "Existing Atlas page",
    );
  });

  test("provides an accessible reload action after a render error", () => {
    const boundary = new RouteLoadErrorBoundary({
      children: <p>Existing Atlas page</p>,
    });
    boundary.state = RouteLoadErrorBoundary.getDerivedStateFromError();
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain('role="alert"');
    expect(html).toContain("Reload page");
    expect(html).not.toContain("Existing Atlas page");
  });

  test("all seven routes have independent error boundaries", () => {
    const app = readFileSync(
      new URL("../src/App.tsx", import.meta.url),
      "utf8",
    );
    const keys = Array.from(
      app.matchAll(/<RouteLoadErrorBoundary key="([^"]+)"/g),
      (match) => match[1],
    );
    expect(keys).toEqual([
      "atlas",
      "object",
      "groups",
      "preview-builder",
      "group",
      "publications",
      "acknowledgements",
    ]);
    expect(app).toContain("Loading page…");
    expect(app).toContain("useDeferredValue(location)");
  });
});
