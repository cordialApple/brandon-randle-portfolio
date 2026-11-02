import assert from "node:assert/strict";
import test from "node:test";
import { rubberBand, advanceSpring, releaseVelocity } from "../src/scripts/caustics/spring.ts";

test("rubber band responds immediately with increasing resistance", () => {
  assert.equal(rubberBand(0), 0);
  assert.ok(rubberBand(0.01) > 0.0099);
  assert.ok(rubberBand(200) > rubberBand(100));
  assert.ok(rubberBand(200) - rubberBand(100) < rubberBand(100));
  assert.ok(rubberBand(1e8) < 240);
  assert.equal(rubberBand(-200), -rubberBand(200));
});

test("spring preserves initial position and velocity at release", () => {
  const initial = { position: 85, velocity: 640 };
  const same = advanceSpring(initial, 0, 0.9);
  assert.ok(Math.abs(same.position - initial.position) < 1e-10);
  assert.ok(Math.abs(same.velocity - initial.velocity) < 1e-10);
  const next = advanceSpring(initial, 1e-7, 0.9);
  assert.ok(Math.abs((next.position - initial.position) / 1e-7 - initial.velocity) < 0.01);
});

test("spring trajectory independent of frame rate and uneven frames", () => {
  for (const damping of [1, 0.88]) {
    const start = { position: -160, velocity: 800 };
    const exact = advanceSpring(start, 0.5, damping);
    for (const steps of [30, 60, 120]) {
      let state = start;
      for (let i = 0; i < steps; i++) state = advanceSpring(state, 0.5 / steps, damping);
      assert.ok(Math.abs(state.position - exact.position) < 1e-9);
      assert.ok(Math.abs(state.velocity - exact.velocity) < 1e-8);
    }
    const uneven = advanceSpring(advanceSpring(start, 0.17, damping), 0.33, damping);
    assert.ok(Math.abs(uneven.position - exact.position) < 1e-9);
  }
});

test("resting release returns without bounce; velocity and displacement settle", () => {
  let previous = 160;
  for (let t = 0; t <= 1; t += 0.02) {
    const state = advanceSpring({ position: 160, velocity: 0 }, t, 1);
    assert.ok(state.position >= 0 && state.position <= previous + 1e-9);
    previous = state.position;
  }
  const settled = advanceSpring({ position: 200, velocity: -1200 }, 2, 0.88);
  assert.ok(Math.abs(settled.position) < 0.01 && Math.abs(settled.velocity) < 0.01);
});

test("release velocity follows recent motion and forgets paused motion", () => {
  const samples = [0, 10, 20, 30, 40].map(t => ({ t, x: t * 0.5, y: -t }));
  assert.deepEqual(releaseVelocity(samples, 40), { x: 500, y: -1000 });
  assert.deepEqual(releaseVelocity(samples, 200), { x: 0, y: 0 });
  assert.deepEqual(releaseVelocity([{ t: 4, x: 2, y: 3 }], 4), { x: 0, y: 0 });
});
