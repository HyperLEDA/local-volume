import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');

test('observed D has row-spanning value; velocity stays a single symmetric ±', () => {
  const css = read('frontend/src/styles/groups.css');
  const observed = read('frontend/src/components/ObservedParameterCards.tsx');
  const uncertainty = read('frontend/src/lib/observedUncertainty.ts');
  expect(css).toContain('grid-row: 1 / span 2;');
  expect(observed).toContain('observed-reading--asymmetric');
  expect(uncertainty).toContain('kind: "symmetric", sigma: twoSignificant(sigma)');
});

test('plot exports show scientific units in square brackets and a readable title', () => {
  const data = read('frontend/src/lib/groupFigureData.ts');
  expect(data).toContain('title: "Velocity–distance diagram"');
  expect(data).toContain('D [Mpc]');
  expect(data).toContain('R_p [kpc]');
  expect(data).toContain('V_LG [km s⁻¹]');
  expect(data).not.toContain('V_LG versus distance');
});

test('JPEG and hover share image coordinate transform, without imaginary PGC for bins', () => {
  const renderer = read('frontend/src/lib/groupFigureJpeg.ts');
  const hover = read('frontend/src/components/GroupFigureInspector.tsx');
  expect(renderer).toContain('function plotCoordinates(plot: GroupFigure)');
  expect(renderer).toContain('const { xMin, xMax, yMin, yMax, px, py } = plotCoordinates(plot);');
  expect(renderer).toContain('if (plot.kind !== "scatter" || plot.unavailable) return [];');
  expect(hover).toContain('figureImageHits(figure)');
  expect(hover).toContain('const shown = pinned ?? hover;');
  expect(hover).toContain('href={`/object/${shown.point.pgc}`}');
  expect(hover).toContain('D<sub>sat</sub> − D<sub>MD</sub>');
});

test('remove subtitle and catalogue footer only from figure UI', () => {
  const figures = read('frontend/src/components/GroupFigures.tsx');
  expect(figures).not.toContain('LV LEDA · current catalogue');
  expect(figures).not.toContain('<p>{scientificText(figure.subtitle)}</p>');
  expect(figures).toContain('GroupFigureInspector');
  expect(figures).toContain('Download CSV');
});
