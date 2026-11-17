import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("four columns and full JPEG modal with keyboard-close native dialog", () => {
  const css = read("frontend/src/styles/groups.css");
  const fig = read("frontend/src/components/GroupFigures.tsx");
  expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  expect(fig).toContain("<dialog");
  expect(fig).toContain("showModal()");
  expect(fig).toContain("onClose=");
  expect(fig).toContain("downloadCsv(");
});

test("gallery does not launch Aladin and swaps cached images", () => {
  const page = read("frontend/src/pages/GroupsPage.tsx");
  expect(page).not.toContain("GroupSkyMap");
  expect(page).toContain('"portrait"');
  expect(page).toContain('"hierarchy"');
  expect(page).toContain("onMouseEnter");
  expect(page).toContain("onFocus");
});

test("preview builder renders both variants and uses object FoV", () => {
  const builder = read("frontend/src/pages/GroupPreviewBuilderPage.tsx");
  const map = read("frontend/src/components/GroupSkyMap.tsx");
  expect(builder).toContain("objectFovDegrees(data)");
  expect(builder).toContain("previewVariant={current.variant}");
  expect(builder).toContain('["portrait", "hierarchy"]');
  expect(map).toContain('previewVariant === "portrait"');
  expect(map).toContain("if (!portrait && atlas !== null)");
});

test("previous cached preview rows remain hierarchy", () => {
  const migration = read("postgres/migrations/0014.lv_group_preview_variants.sql");
  expect(migration).toContain("DEFAULT 'hierarchy'");
  expect(migration).toContain("PRIMARY KEY (root_pgc, definition, variant)");
  expect(migration).not.toMatch(/\bTRUNCATE\b|\bDELETE\b\s+FROM\s+lv\.group_previews/i);
});
