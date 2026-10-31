import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';

const source = readFileSync(new URL('../src/scripts/caustics/main.ts', import.meta.url), 'utf8');
const fitSource = source.match(/function fitLightCamera\(\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(fitSource, 'Light-camera fit function exists');

test('light-camera depth covers the receiver beyond the gem', () => {
  const W = 1432;
  const H = 721;
  const gemCenter = new THREE.Vector3(W * 0.5, H * 0.42, 65);
  const lightPos = new THREE.Vector3(W * 0.5, H * 0.7, 140);
  const lightCam = new THREE.PerspectiveCamera();
  const fit = new Function('THREE', 'lightPos', 'gemCenter', 'gemRadius', 'W', 'H', 'lightCam', `${fitSource}; fitLightCamera();`);
  fit(THREE, lightPos, gemCenter, 70, W, H, lightCam);
  const receiver = new THREE.Vector3(W * 0.5, 0, 0).project(lightCam);
  assert.ok(receiver.z <= 1, `Receiver clipped at depth ${receiver.z}`);
});
