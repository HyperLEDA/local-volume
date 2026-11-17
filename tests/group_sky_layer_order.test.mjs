import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const map = fs.readFileSync('frontend/src/components/GroupSkyMap.tsx', 'utf8');
const gallery = fs.readFileSync('frontend/src/pages/GroupsPage.tsx', 'utf8');

test('overlays and catalogues are attached before their contents are added', () => {
  const overlayAttach = map.indexOf('view.addOverlay(lines)');
  const overlayAdd = map.indexOf('updateGroupEdges();', overlayAttach);
  const catalogAttach = map.indexOf('view.addCatalog(catalog)');
  const catalogAdd = map.indexOf('setCatalogSources(');
  assert.ok(overlayAttach >= 0 && overlayAttach < overlayAdd, 'MD overlay must be attached before requesting its first draw');
  assert.ok(catalogAttach >= 0 && catalogAttach < catalogAdd, 'Aladin catalogue must be attached before adding markers');
});

test('group cards use stored image and do not instantiate an Aladin viewer', () => {
  assert.match(gallery, /<img[\s\S]*?loading="lazy"/);
  assert.match(gallery, /previewUrl\(/);
  assert.doesNotMatch(gallery, /GroupSkyMap/);
});
