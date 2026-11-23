import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const map = fs.readFileSync('frontend/src/components/GroupSkyMap.tsx', 'utf8');
const gallery = fs.readFileSync('frontend/src/pages/GroupsPage.tsx', 'utf8');

test('overlays and catalogues are attached before their contents are added', () => {
  function before(first, second, message) {
    const a = map.indexOf(first);
    const b = map.indexOf(second);
    assert.ok(a >= 0 && b >= 0 && a < b, message);
  }

  const toneLoop = map.indexOf('for (const tone of [');
  const toneLoopEnd = map.indexOf('const bounds = members.map', toneLoop);
  assert.ok(toneLoop >= 0 && toneLoopEnd > toneLoop, 'Tidal overlay registration loop must exist');
  const registration = map.slice(toneLoop, toneLoopEnd);
  for (const tone of ['positive', 'negative', 'zero', 'unknown']) {
    assert.ok(registration.includes(`"${tone}"`), `Missing tidal tone: ${tone}`);
  }
  assert.match(registration, /lines\.set\(tone,\s*overlay\)/);
  assert.match(registration, /view\.addOverlay\(overlay\)/);
  before('view.addOverlay(overlay)', 'mapView.on("zoomChanged", updateGroupEdges)', 'Tidal overlays must be attached before registering redraw callbacks');
  before('view.addOverlay(overlay)', 'updateGroupEdges();', 'Tidal overlays must be attached before the first draw');

  for (const layer of ['subgroupFill', 'outlines', 'highlights']) {
    before(`view.addOverlay(${layer})`, `${layer}.add(`, `${layer} must be attached before adding polygons`);
    before(`view.addOverlay(${layer})`, 'presentation.apply(nativeSubgroupState.current)', `${layer} must be attached before applying subgroup presentation`);
  }
  before('view.addCatalog(catalog)', 'setCatalogSources(', 'Aladin catalogue must be attached before adding markers');
});

test('group cards use stored image and do not instantiate an Aladin viewer', () => {
  assert.match(gallery, /<img[\s\S]*?loading="lazy"/);
  assert.match(gallery, /previewUrl\(/);
  assert.doesNotMatch(gallery, /GroupSkyMap/);
});
