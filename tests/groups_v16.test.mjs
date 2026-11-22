import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const read = (s) => readFileSync(s, 'utf8');
describe('Groups v16 UI and preview cache', () => {
  test('point tooltip contains only the primary name, no repeated PGC', () => {
    const s = read('frontend/src/components/GroupFigureInspector.tsx');
    expect(s).toContain('{shown.point.name?.trim() || `PGC ${shown.point.pgc}`}');
    expect(s).not.toContain(' · PGC {shown.point.pgc}');
  });
  test('tighter SIN fitting still checks every marker on interactive and exported maps', () => {
    const s = read('frontend/src/components/GroupSkyMap.tsx');
    expect(s).toContain('maxOffset / 0.91');
    expect(s).toContain('const padding = miniature ? 17 : 18');
    expect(s).toMatch(/allMembersFit\(\s*view,\s*members,\s*width,\s*height,\s*padding,?\s*\)/);
    expect(s).toContain('Preview incomplete:');
  });
  test('renderer version invalidates outdated hierarchy images and preserves portraits', () => {
    const s = read('lv_backend/data/group_previews.py');
    expect(s).toContain('sin-dss2-atlas-markers-v16-tight-fit');
    expect(s).toContain('sin-dss2-md-closeup-a26-x1.4-v18');
    expect(s).toContain('def cache_manifest(');
    expect(s).toContain('octet_length(image_webp)');
  });
  test('builder retrieves one cache manifest instead of N HEAD requests', () => {
    const s = read('frontend/src/pages/GroupPreviewBuilderPage.tsx');
    expect(s).toContain('fetchPreviewCacheManifest(definition)');
    expect(s).toContain('if (!report.write_enabled)');
    expect(s).toContain('const currentPairs = new Set(');
    expect(s).not.toContain('await previewExists(');
  });
  test('Group Properties tooltips remain science-specific and concise', () => {
    const s = read('frontend/src/components/GroupParameters.tsx');
    expect(s).toContain('Sample standard deviation');
    expect(s).toContain('Sum of H I detections');
    expect(s).not.toContain('not a measured total halo mass');
  });
});
