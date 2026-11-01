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
