import test from "node:test";
import assert from "node:assert/strict";
import {
  marginGemPlacement,
  nextQualityTier,
  anchorDocY,
  QUALITY_TIERS,
} from "../src/scripts/caustics/site.ts";

test("marginGemPlacement sizes from measured gutter", () => {
  const p = marginGemPlacement("left", 300, 76, 1356, 1432)!;
  assert.ok(p);
  assert.equal(p.docY, 300);
  assert.ok(p.x - p.r >= 12);
  assert.ok(p.r <= (76 - 24) * 0.34 + 1e-9);
});

test("marginGemPlacement hides when gutter too narrow", () => {
  assert.equal(marginGemPlacement("left", 300, 40, 960, 1000), null);
  assert.equal(marginGemPlacement("right", 300, 0, 992, 1000), null);
});

test("marginGemPlacement right edge mirrors and clamps radius", () => {
  const p = marginGemPlacement("right", 100, 56, 800, 2000)!;
  assert.ok(p);
  assert.equal(p.r, 44);
  assert.equal(p.x, 2000 - 12 - 44);
});

test("nextQualityTier demotes on sustained slow frames, promotes on fast", () => {
  assert.equal(nextQualityTier(0, 30, 120), 1);
  assert.equal(nextQualityTier(0, 30, 30), 0);
  assert.equal(nextQualityTier(2, 30, 120), 2);
  assert.equal(nextQualityTier(1, 10, 400), 0);
  assert.equal(nextQualityTier(1, 10, 100), 1);
  assert.equal(nextQualityTier(0, 10, 400), 0);
});

test("anchorDocY resolves document position or fallback", () => {
  assert.equal(anchorDocY({ top: 200, height: 100 }, 0.5, 400, 999), 650);
  assert.equal(anchorDocY(null, 0.5, 400, 999), 999);
});

test("quality tiers monotonically decrease solve size", () => {
  const sorted = [...QUALITY_TIERS].sort((a, b) => b - a);
  assert.deepEqual([...QUALITY_TIERS], sorted);
});

test("each cut's projected half extent maps exactly to requested size", async () => {
  const { makeGemGeo, projectedRadius } = await import(
    "../src/scripts/caustics/gem.ts"
  );
  for (const cut of ["brilliant", "step", "shard"] as const) {
    const geo = makeGemGeo(cut);
    const projR = projectedRadius(geo);
    assert.ok(projR > 0, `${cut} projR`);
    for (const size of [14, 30, 44]) {
      const scale = size / projR;
      const scaled = projR * scale;
      assert.ok(Math.abs(scaled - size) < 1e-6, `${cut} @ ${size}`);
    }
  }
});

test("cut projected extents differ so nominal sizing would clip", async () => {
  const { makeGemGeo, projectedRadius } = await import(
    "../src/scripts/caustics/gem.ts"
  );
  const r = (c: "brilliant" | "step" | "shard") =>
    projectedRadius(makeGemGeo(c));
  const [b, s, h] = [r("brilliant"), r("step"), r("shard")];
  assert.ok(s > b, "step wider on screen than brilliant");
  assert.notEqual(Math.round(s * 100), Math.round(b * 100));
  assert.ok(h > 0);
});
