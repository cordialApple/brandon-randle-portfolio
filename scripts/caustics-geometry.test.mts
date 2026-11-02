import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  makeGemGeometry,
  makeStepGeometry,
  makeShardGeometry,
  verifyGemGeometry,
} from '../src/scripts/caustics/gem.ts';

const cuts: Array<[string, () => THREE.BufferGeometry]> = [
  ['brilliant', () => makeGemGeometry(8, 1, 0.35, 1.05, 0.55)],
  ['step', () => makeStepGeometry(1.2, 0.85, 0.38, 1.0, 2, 3)],
  ['shard', () => makeShardGeometry(5, 0.8, 2.3)],
];

for (const [name, make] of cuts) {
  test(`${name} cut is closed with outward facet normals`, () => {
    const geo = make();
    geo.rotateX(Math.PI / 2);
    geo.scale(60, 60, 60);
    const check = verifyGemGeometry(geo);
    assert.equal(
      check.openEdges,
      0,
      `${name} has ${check.openEdges} open edges (not closed)`,
    );
    assert.equal(
      check.invertedFaces,
      0,
      `${name} has ${check.invertedFaces} inward-facing facets`,
    );
    const r = geo.boundingSphere?.radius ?? 0;
    assert.ok(Number.isFinite(r) && r > 20 && r < 400, `${name} radius ${r}`);
    const tris = geo.getAttribute('position').count / 3;
    assert.ok(tris >= 10, `${name} too few facets: ${tris}`);
  });
}

test('cuts produce distinct facet structures', () => {
  const counts = cuts.map(([, make]) => make().getAttribute('position').count);
  assert.ok(new Set(counts).size === counts.length, `cuts share face counts: ${counts}`);
});

test('shard ring tessellation scales with sides', () => {
  const a = makeShardGeometry(5, 0.8, 2.3);
  const b = makeShardGeometry(7, 0.8, 2.3);
  assert.equal(b.getAttribute('position').count - a.getAttribute('position').count, 12);
});
