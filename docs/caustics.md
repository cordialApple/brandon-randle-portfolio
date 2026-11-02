# Gemstone caustics

Cursor-driven point light, procedural gems, colored caustic deposits. Homepage: cyan brilliant, tilted mint step cut, pink shard. Work/contact: one accent. Desktop gems fit measured open space between columns or sections; wide outer gutters remain fallback.

Visual reference: [Caustica Blender reel](https://www.instagram.com/reel/DeKQVmUOsB3/). Browser implementation uses Three.js and three-mesh-bvh, without React or a path tracer. Dependency licenses ship at `/caustics-third-party-notices.txt`.

## Rendering

Each visible gem gets a perspective light-view normal/depth pass. Rays refract through its BVH, including total internal reflection; forward splats reconstruct tinted light on a flat receiver. Normalized Gaussian footprints grow with estimated ray spread and receiver incidence, filling gaps between samples. Shared blur and composite passes finish image. Gem highlights use same point light. Site canvas stays transparent behind DOM content; lab adds opaque receiver and depth shadows.

This implementation uses solid-angle-weighted forward splats, replacing the original plan's area-ratio gather. Tint filtering is approximate; no spectral dispersion, inter-gem light transport, or physically calibrated brightness. Reference reel remains a fidelity target, not a browser performance claim.

## Site behavior

- Graphics module loads after page load and an idle callback.
- Solve resolution adapts through 192, 128, and 96 samples per axis; canvas pixel ratio capped at 1.5. Reconstructed footprints let default use 44% fewer rays than previous 256² tier.
- Hero target diameter 152px; mint 144px; pink up to 192px, fitted to section gap. Projected silhouette varies by cut. Minimum fitted diameter 80px; crowded spaces hide gems.
- Desktop section gaps reserve 180px above projects and 208px above about. Below 1100px, normal section spacing returns; narrow gutters hide gems.
- Site light height 180, intensity 9000, caustic gain 1.35, footprint control 4, blur radius 1.5. Mint deposits use 0.72 intensity multiplier, preserving gem shading while reducing scattered light. Footprint radius capped at 28 CSS pixels; approximation can soften distant details. Disconnected facet beams can remain.
- Pointer movement moves the light; scroll/resize update anchors. No autonomous motion.
- Reduced motion, coarse pointers, unsupported WebGL, context loss use static accents where space fits.
- Decorative layer ignores pointer input and stays outside the accessibility tree.

## Manual review

Run `npm run check`, `npm run build`, then `npm run preview`. Use `/lab/caustics/` for three-gem diagnostics; `?res=128` selects a lower lab solve resolution. Lab controls isolate cuts and show raw scatter, blurred caustics, normals, and depth.

Append `?gemDebug=1` to a site page for diagnostic controls. Keep browser visible during `bench 300f`; measurements exclude 20 warmup frames and invalidate when hidden. Record viewport, canvas pixels, solve resolution, visible gems, browser, and GPU. CPU-submit timing is not GPU timing; frame intervals describe presentation cadence. Never use idle HUD values as motion benchmarks.

Review home, work, contact, and case routes; test links, keyboard focus, scrolling, resize, reduced-motion changes, and back/forward restoration. Mobile browser checks and desktop GPU timing must be reported separately.

## Earlier small-gem validation — 2026-11-01

Historical measurements for `88c4964`, before larger geometry and higher solve tiers. These results do not measure current visual revision.

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

## Earlier larger-gem revision — 2026-11-01

Devin reviewed actual before/after screenshots. Hero scale/placement accepted; pink enlarged and lowered within its reserved gap; mint tilted, then deposits reduced 28% after feedback about scattered beams. Pink fan judged closest to reel. Remaining distant stipple is sampling artifact, not intended particle animation. Renderer clears and reconstructs caustics each frame; no temporal accumulation.

Final production build, same Edge/Arc device: homepage at scrollY 0, 1432×721 CSS pixels, 2148×1081 canvas pixels, 256² samples per gem, two active gems, eight calls. Native foreground verified. 320 rendered frames, 20 warmup excluded, 300 measured: mean 17.03 ms, p50 16.70 ms, p95 33.30 ms. Result sits at 33.3 ms budget; limited headroom, no universal performance guarantee. UTC 2026-11-02 02:29:48.662; script asset `GemCaustics.astro_astro_type_script_index_0_lang.4ZMFOmN_.js`.

Supplementary one-active-gem view at scrollY 1455: mean 8.58 ms, p50 8.30 ms, p95 8.50 ms, five calls, same dimensions/quality. Earlier larger-gem runs before mint attenuation measured p95 33.30–33.40 ms. Canvas ratio 1.25 experiment gave no clear benefit; retained 1.5. Earlier small-gem 10.3 ms result above does not describe this revision.

31 tests pass; Astro check: zero errors/warnings/hints. Nine-route build succeeds; existing graphics-bundle size warning remains. Local visual checks: home hero/mint/pink, work, contact, production case. Viewport checks at 390×844, 1024×768, 1100×768: no horizontal overflow; narrow layouts static/hidden, desktop gem fits corridor. Overrides reset. These are desktop browser viewport checks, not physical mobile testing.

## Continuous-light reconstruction — 2026-11-01

Fixed square deposits replaced with truncated Gaussian footprints. Radius estimates angular sample spread from existing solid angle, entry distance, exit distance, receiver incidence; clamp prevents oversized splats. Kernel integrates to one; amplitude scales inversely with radius squared. Larger footprints fill gaps without adding BVH traces or temporal history. Explicit trace-debug modes retain square diagnostic markers. Isotropic estimate is not exact ray differentials; distant structures soften and disconnected facet beams can remain.

Site tiers now 192/128/96, versus 256/192/128. Top tier traces 36,864 samples per active gem instead of 65,536. Same eight-bounce limit, gem sizes, light, canvas ratio, blur, and eight draw calls for two active gems. No new dependency or render pass. Devin inspected actual hero/mint/pink screenshots against user's reference: continuous angular fans, readable text, no excessive blur; further anisotropic reconstruction unnecessary for this visual target.

Matched foreground checks, Edge / Intel Arc 140V, 1432×720 CSS, 2148×1080 canvas, homepage scrollY 0. All runs: 320 rendered, 20 warmup excluded, 300 measured, two active gems/eight calls. No local tests/builds during runs; native window confirmed selected page before and after final pair.

| Version | Solve | Mean / p50 / p95 frame interval | UTC timestamp, Nov 2 |
| --- | --- | --- | --- |
| Draft baseline `0493327` | 256² | 16.81 / 16.70 / 33.20 ms | 02:38:19.728 |
| Baseline repeat | 256² | 17.03 / 16.70 / 33.40 ms | 02:44:33.404 |
| Reconstructed default | 192² | 12.31 / 8.40 / 25.00 ms | 02:42:40.689 |
| Final repeat | 192² | 12.22 / 8.40 / 25.00 ms | 02:44:56.049 |

Final pair: 28% lower mean frame interval, 25% lower p95. Comparison evaluates complete default profiles, including deliberately lower ray count; it does not claim bigger footprints are free at equal sample count. No slowdown observed on this device; other hardware remains unmeasured. Final script asset: `GemCaustics.astro_astro_type_script_index_0_lang.BWFyxWK2.js`.

32 tests pass, including numerical kernel-energy integration over footprint radii 2–28. Typecheck clean; nine-route build succeeds with existing graphics-bundle warning. GPU shader compiles without errors; actual three-cut screenshots reviewed. Responsive/lifecycle behavior unchanged and existing controller tests pass.
