import assert from "node:assert/strict";
import test from "node:test";
import { makeSplatMaterial } from "../src/scripts/caustics/shaders.ts";

test("reconstructed light conserves deposited energy as footprint grows", () => {
  const material = makeSplatMaterial();
  const exponent = material.uniforms.kernelExponent?.value;
  const normalization = material.uniforms.kernelNormalization?.value;
  assert.ok(Number.isFinite(exponent) && exponent > 0, "smooth kernel required");
  assert.ok(Number.isFinite(normalization) && normalization > 0, "normalized kernel required");

  for (const radius of [2, 4, 12, 28]) {
    const radiusSquared = radius * radius;
    const step = radius / 160;
    let energy = 0;
    for (let y = -radius + step / 2; y < radius; y += step) {
      for (let x = -radius + step / 2; x < radius; x += step) {
        const distanceSquared = (x * x + y * y) / radiusSquared;
        if (distanceSquared > 1) continue;
        energy += normalization * Math.exp(-exponent * distanceSquared)
          / radiusSquared * step * step;
      }
    }
    assert.ok(Math.abs(energy - 1) < 0.002, `radius ${radius}: energy ${energy}`);
  }
  material.dispose();
});
