# Gemstone caustics

Cursor-driven point light, procedural gems, and colored caustic deposits. Homepage uses cyan brilliant, mint step cut, and pink shard; work/contact use one accent. Anchors follow document sections, with geometry sized to available gutters.

Visual reference: [Caustica Blender reel](https://www.instagram.com/reel/DeKQVmUOsB3/). Browser implementation uses Three.js and three-mesh-bvh, without React or a path tracer. Dependency licenses ship at `/caustics-third-party-notices.txt`.

## Rendering

Each visible gem gets a perspective light-view normal/depth pass. Rays refract through its BVH, including total internal reflection; forward splats accumulate tinted light on a flat receiver. Shared blur and composite passes finish the image. Gem highlights use the same point light. Site canvas stays transparent behind DOM content; lab adds an opaque receiver and depth shadows.

This implementation uses solid-angle-weighted forward splats, replacing the original plan's area-ratio gather. Tint filtering is approximate; no spectral dispersion, inter-gem light transport, or physically calibrated brightness. Reference reel remains a fidelity target, not a browser performance claim.

## Site behavior

- Graphics module loads after page load and an idle callback.
- Solve resolution adapts through 128, 96, and 64 samples per axis; canvas pixel ratio capped at 1.5.
- Pointer movement moves the light; scroll/resize update anchors. No autonomous motion.
- Reduced motion, coarse pointers, unsupported WebGL, and context loss use static accents. Gems hide when gutters cannot fit them.
- Decorative layer ignores pointer input and stays outside the accessibility tree.

## Manual review

Run `npm run check`, `npm run build`, then `npm run preview`. Use `/lab/caustics/` for three-gem diagnostics; `?res=128` selects a lower lab solve resolution. Lab controls isolate cuts and show raw scatter, blurred caustics, normals, and depth.

Append `?gemDebug=1` to a site page for diagnostic controls. Keep browser visible during `bench 300f`; measurements exclude 20 warmup frames and invalidate when hidden. Record viewport, canvas pixels, solve resolution, visible gems, browser, and GPU. CPU-submit timing is not GPU timing; frame intervals describe presentation cadence. Never use idle HUD values as motion benchmarks.

Review home, work, contact, and case routes; test links, keyboard focus, scrolling, resize, reduced-motion changes, and back/forward restoration. Mobile browser checks and desktop GPU timing must be reported separately.

## Measured validation — 2026-11-01

Edge on Intel Arc 140V, ANGLE D3D11. Actual foreground tab verified through native Edge window; browser automation's selected-tab and visibility signals alone did not prove foreground selection. Every run below rendered 320 frames, excluding 20 warmup frames and retaining all 300 measured intervals. Point light follows a continuous orbit; eight refraction bounces.

| Scene | Canvas CSS / pixels | Solve | Active gems / calls | Mean / p50 / p95 frame interval |
| --- | --- | --- | --- | --- |
| Three-gem lab | 1432×721 / 1432×721 | 128² per gem | 3 / 12 | 9.69 / 9.70 / 10.20 ms |
| Homepage | 1432×720 / 2148×1080 | 128² per gem | 2 / 8 | 9.81 / 9.90 / 10.30 ms |
| Homepage, quiet repeat | 1432×720 / 2148×1080 | 128² per gem | 2 / 8 | 9.91 / 10.00 / 10.30 ms |

Lab CPU-submit mean/p95: 0.26/0.40 ms; not GPU timing. Homepage retains adaptive quality and pixel-ratio cap 1.5. Both measured scenes meet the 33.3 ms p95 budget on this device. Measurements describe this browser/device/load, not universal frame-rate guarantees.

Diagnostic counter originally changed text every frame and polluted page timing: p95 ~41 ms, including a DPR1 comparison. Counter now updates every 30 rendered frames; sampling and rendering remain per-frame. Lowering canvas pixel ratio did not help, so that experiment was reverted. A repeat overlapping local validation work reached p95 40.70 ms; quiet repeat above completed after checks finished. Earlier background-tab runs with ~1,000 ms stalls are invalid for rendering performance.

28 tests pass; Astro check reports zero errors/warnings/hints; nine-route static build succeeds. Geometry, lifecycle, narrow-gutter resource disposal, delayed import, context loss, and browser Back restoration checked. Devin verified 390×844 and 1024×768 static layouts; local viewport override did not reliably resize the intended tab. Coarse-pointer behavior covered by controller tests. Safari, Apple Silicon, discrete GPUs, and physical mobile devices remain untested.

Sources measured: integration commit `33019cc` plus benchmark-counter change described above. UTC result timestamps: 2026-11-02 01:34:21.002 (lab), 01:37:22.792 and 01:38:32.141 (homepage); local date November 1, America/Chicago.
