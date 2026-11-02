import test from "node:test";
import assert from "node:assert/strict";
import {
  marginGemPlacement,
  fitGemInSpace,
  nextQualityTier,
  anchorDocY,
  QUALITY_TIERS,
} from "../src/scripts/caustics/site.ts";

test("marginGemPlacement keeps enlarged gems outside content", () => {
  const p = marginGemPlacement("left", 300, 160, 1272, 1432)!;
  assert.ok(p);
  assert.equal(p.docY, 300);
  assert.ok(p.x - p.r >= 12);
  assert.ok(p.r >= 40);
  assert.ok(p.x + p.r <= 160 - 12);
});

test("marginGemPlacement hides when gutter too narrow", () => {
  assert.equal(marginGemPlacement("left", 300, 40, 960, 1000), null);
  assert.equal(marginGemPlacement("right", 300, 0, 992, 1000), null);
  assert.equal(marginGemPlacement("left", 300, 76, 1356, 1432), null);
});

test("marginGemPlacement right edge mirrors and clamps radius", () => {
  const p = marginGemPlacement("right", 100, 56, 800, 2000)!;
  assert.ok(p);
  assert.equal(p.r, 76);
  assert.equal(p.x, 2000 - 12 - 76);
});

test("hero whitespace fits a 152px gem without covering either column", () => {
  const space = { left: 693, right: 938, top: 222, bottom: 430 };
  const p = fitGemInSpace(space, 0, 76)!;
  assert.ok(p);
  assert.equal(p.r * 2, 152);
  assert.ok(p.x - p.r >= space.left + 12);
  assert.ok(p.x + p.r <= space.right - 12);
  assert.ok(p.docY - p.r >= space.top + 12);
  assert.ok(p.docY + p.r <= space.bottom - 12);
});

test("section whitespace preserves document anchoring and shrinks to fit", () => {
  const p = fitGemInSpace({ left: 800, right: 1040, top: 250, bottom: 402 }, 900, 72)!;
  assert.ok(p);
  assert.equal(p.r, 64);
  assert.equal(p.docY, 1226);
  assert.equal(p.x, 920);
});

test("crowded or inverted whitespace hides gem instead of overlapping text", () => {
  assert.equal(fitGemInSpace({ left: 700, right: 790, top: 200, bottom: 430 }, 0, 76), null);
  assert.equal(fitGemInSpace({ left: 700, right: 600, top: 200, bottom: 430 }, 0, 76), null);
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
    for (const size of [40, 64, 76, 92]) {
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
