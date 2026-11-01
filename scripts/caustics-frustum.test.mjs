import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

const source = readFileSync(new URL('../src/scripts/caustics/core.ts', import.meta.url), 'utf8');
const fitSource = source.match(/private fitLightCamera\(gem: Gem\) \{[\s\S]*?\n  \}/)?.[0]
  ?.replace('private fitLightCamera(gem: Gem)', 'function fitLightCamera(gem)')
  ?.replaceAll('this.', 'self.')
  ?.replace('= this;', '= self;');
assert.ok(fitSource, 'Light-camera fit function exists');

test('light-camera depth covers the receiver beyond the gem', () => {
  const W = 1432;
  const H = 721;
  const lightPos = new THREE.Vector3(W * 0.5, H * 0.7, 140);
  const lightCam = new THREE.PerspectiveCamera();
  const self = { lightPos, lightCam, W, H };
  const gem = { center: new THREE.Vector3(W * 0.5, H * 0.42, 65), radius: 70 };
  const fit = new Function('THREE', 'self', 'gem', `${fitSource}; fitLightCamera(gem);`);
  fit(THREE, self, gem);
  const receiver = new THREE.Vector3(W * 0.5, 0, 0).project(lightCam);
  assert.ok(receiver.z <= 1, `Receiver clipped at depth ${receiver.z}`);
});
