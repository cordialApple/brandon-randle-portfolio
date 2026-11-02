import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { CausticsScene } from "./core";
import { makeDisplayMaterial } from "./shaders";

export interface LabOptions {
  solveRes?: number;
  onUnsupported?: (reason: string) => void;
}

export interface LabHandle {
  dispose(): void;
}

export function initCausticsLab(
  canvas: HTMLCanvasElement,
  opts: LabOptions = {},
): LabHandle | null {
  const W0 = window.innerWidth;
  const H0 = window.innerHeight;
  const maybeScene = CausticsScene.create({
    canvas,
    solveRes: opts.solveRes ?? 256,
    gems: [
      {
        cut: "brilliant",
        center: new THREE.Vector3(W0 * 0.5, H0 * 0.58, 65),
        size: 55,
        tint: "#6de5f2",
      },
      {
        cut: "step",
        center: new THREE.Vector3(W0 * 0.22, H0 * 0.5, 55),
        size: 45,
        tint: "#77efcd",
      },
      {
        cut: "shard",
        center: new THREE.Vector3(W0 * 0.78, H0 * 0.5, 60),
        size: 50,
        tint: "#ff4fa0",
      },
    ],
    onUnsupported: opts.onUnsupported,
  });
  if (!maybeScene) return null;
  const sc: CausticsScene = maybeScene;
  const { renderer, params } = sc;
  const W = () => sc.W;
  const H = () => sc.H;
  const solveRes = sc.solveRes;
  sc.lightPos.set(W0 * 0.5, H0 * 0.7, 140);

  const view = { mode: "final", debugGem: 0, paused: false };
  const gui = new GUI({ title: "caustics lab" });
  gui.add(params, "lightHeight", 20, 600, 5).name("light z");
  gui.add(params, "ior", 1.1, 2.4, 0.01);
  gui.add(params, "bounces", 1, 12, 1);
  gui.add(params, "splatSize", 1, 8, 0.5).name("splat px");
  gui.add(params, "debugStage", {
    solve: 0,
    unrefracted: 1,
    "trace outcome": 2,
  }).name("splat stage");
  gui.add(params, "blurEnabled").name("blur");
  gui.add(params, "blurRadius", 0, 10, 0.5).name("blur radius");
  gui.add(params, "intensity", 0, 80000, 500).name("splat gain");
  gui.add(params, "causticStrength", 0, 4, 0.05).name("display gain");
  gui.add(params, "directStrength", 0, 8000, 50).name("direct gain");
  gui.add(params, "specStrength", 0, 40000, 100).name("spec gain");
  gui.add(params, "specPow", 8, 256, 1).name("spec pow");
  gui.addColor(params, "baseColor");
  const gemVis = { brilliant: true, step: true, shard: true };
  const gemFolder = gui.addFolder("gems");
  gemFolder.add(gemVis, "brilliant").onChange((v: boolean) => {
    sc.setGemVisible(0, v);
  });
  gemFolder.add(gemVis, "step").onChange((v: boolean) => {
    sc.setGemVisible(1, v);
  });
  gemFolder.add(gemVis, "shard").onChange((v: boolean) => {
    sc.setGemVisible(2, v);
  });
  gui.add(view, "mode", [
    "final",
    "caustic",
    "scatter",
    "lightDepth",
    "lightNormal",
  ]).name("view");
  gui.add(view, "debugGem", { brilliant: 0, step: 1, shard: 2 }).name("debug gem");
  gui.add(view, "paused").name("pause solve");
  gui.onChange(() => {
    sc.dirty = true;
  });

  const statsEl = document.getElementById("stats");
  const glInfoEl = document.getElementById("glinfo");
  if (glInfoEl) {
    glInfoEl.textContent =
      `${sc.glRenderer} · webgl2 · buf=${sc.bufName} · ` +
      `solve ${solveRes}² · 3 gems`;
  }

  const setLightFromEvent = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    sc.setLight(
      e.clientX - r.left,
      H() - (e.clientY - r.top),
      params.lightHeight,
    );
  };
  window.addEventListener("pointermove", setLightFromEvent);
  window.addEventListener("pointerdown", setLightFromEvent);

  const displayMat = makeDisplayMaterial();
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), displayMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  function showDebug() {
    const dm = displayMat.uniforms;
    const gem = sc.gems[view.debugGem];
    if (view.mode === "caustic" || view.mode === "scatter") {
      dm.tex.value =
        view.mode === "scatter"
          ? sc.rawCaustic().texture
          : sc.activeCaustic().texture;
      dm.mode.value = 0;
      dm.gain.value = params.causticStrength * 2;
    } else if (view.mode === "lightDepth") {
      dm.tex.value = gem?.lightTarget.depthTexture ?? null;
      dm.mode.value = 1;
      dm.gain.value = 1;
    } else {
      dm.tex.value = gem?.lightTarget.texture ?? null;
      dm.mode.value = 0;
      dm.gain.value = 1;
    }
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  }

  const times: number[] = [];
  let frames = 0;
  function pushTime(ms: number) {
    times.push(ms);
    if (times.length > 240) times.shift();
    frames++;
    if (frames % 15 === 0 && statsEl) {
      const s = [...times].sort((a, b) => a - b);
      const vis = sc.gems.filter((g) => g.visible).length;
      statsEl.textContent =
        `frame ${s[Math.floor(s.length * 0.5)].toFixed(1)}ms p50 / ` +
        `${s[Math.floor(s.length * 0.95)].toFixed(1)}ms p95 · ` +
        `solve ${solveRes}² · ${vis} gems`;
    }
  }

  let bench: {
    t: number;
    n: number;
    warm: number;
    times: number[];
    intervals: number[];
    frames: number;
  } | null = null;
  renderer.info.autoReset = false;
  (window as unknown as Record<string, unknown>).runBench = (n = 300) => {
    if (document.hidden) {
      console.warn("[bench] aborted: page hidden");
      return;
    }
    bench = { t: 0, n, warm: 20, times: [], intervals: [], frames: 0 };
  };
  const onVisibility = () => {
    if (document.hidden && bench) {
      console.warn("[bench] invalidated: page hidden mid-run");
      bench = null;
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onBenchClick = () => {
    (window as unknown as { runBench: (n: number) => void }).runBench(300);
  };
  document.getElementById("bench")?.addEventListener("click", onBenchClick);

  const measureCaustic = (x: number, y: number, w: number, h: number) =>
    sc.measureCaustic(x, y, w, h);
  (window as unknown as Record<string, unknown>).measureCaustic =
    measureCaustic;

  const probeEl = document.getElementById("probe");
  const onProbeClick = () => {
    const savedBench = bench;
    bench = null;
    const prev = sc.lightPos.clone();
    sc.setLight(W() * 0.5, H() * 0.55, params.lightHeight);
    sc.solve();
    const px = Math.max(0, Math.min(Math.round(W() * 0.5 - 128), W() - 256));
    const py = Math.max(0, Math.min(Math.round(H() * 0.62 - 128), H() - 256));
    const v = measureCaustic(px, py, 256, 256);
    if (probeEl) {
      const val =
        v < 1e-6 ? `${v.toExponential(6)} (inconclusive)` : v.toExponential(6);
      probeEl.textContent = `${val} @ ${solveRes}² rect(${px},${py},256,256)`;
    }
    sc.lightPos.copy(prev);
    bench = savedBench;
    sc.dirty = true;
  };
  document.getElementById("probebtn")?.addEventListener("click", onProbeClick);
  (window as unknown as Record<string, unknown>).setLight = (
    x: number,
    y: number,
    z?: number,
  ) => {
    sc.setLight(x, y, z ?? params.lightHeight);
  };

  let raf = 0;
  let last = performance.now();
  let disposed = false;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    last = now;
    if (bench) {
      bench.t += dt / 1000;
      const cx = W() * 0.5 + Math.cos(bench.t * 2.2) * W() * 0.28;
      const cy = H() * 0.55 + Math.sin(bench.t * 2.2) * H() * 0.22;
      sc.setLight(cx, cy, params.lightHeight);
    }
    if (params.lightHeight !== sc.lightPos.z) {
      sc.lightPos.z = params.lightHeight;
      sc.dirty = true;
    }
    const t0 = performance.now();
    if (sc.dirty || bench) {
      renderer.info.reset();
      if (!view.paused) sc.solve();
      if (view.mode === "final") sc.composite();
      else showDebug();
      sc.dirty = false;
      if (bench) bench.frames++;
    }
    const ms = performance.now() - t0;
    pushTime(dt);
    if (bench && bench.frames > bench.warm) {
      bench.times.push(ms);
      bench.intervals.push(dt);
    }
    if (bench) {
      if (bench.times.length >= bench.n) {
        const s = [...bench.times].sort((a, b) => a - b);
        const d = [...bench.intervals].sort((a, b) => a - b);
        const pct = (arr: number[], q: number) =>
          arr[Math.floor(arr.length * q)].toFixed(2);
        const vis = sc.gems.filter((g) => g.visible).length;
        const mean = (d.reduce((a, b) => a + b, 0) / d.length).toFixed(2);
        console.log(
          `[bench] n=${s.length} visible-frames=${bench.frames} ` +
            `(excl. ${bench.warm} warmup) ` +
            `cpu-submit mean=${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)}ms ` +
            `p50=${pct(s, 0.5)}ms p95=${pct(s, 0.95)}ms · ` +
            `raf-interval mean=${mean}ms p50=${pct(d, 0.5)}ms p95=${pct(d, 0.95)}ms ` +
            `(${solveRes}²/gem · ${vis} gems · ` +
            `${renderer.info.render.calls} calls · ${W()}x${H()})`,
        );
        bench = null;
      }
    }
  }
  raf = requestAnimationFrame(frame);

  const onResize = () => {
    sc.resize(window.innerWidth, window.innerHeight);
    const cx = W() * 0.5;
    sc.setGemCenter(0, cx, H() * 0.58);
    sc.setGemCenter(1, W() * 0.22, H() * 0.5);
    sc.setGemCenter(2, W() * 0.78, H() * 0.5);
  };
  window.addEventListener("resize", onResize);

  (window as unknown as Record<string, unknown>).lab = {
    renderer,
    scene: sc,
    params,
    invalidate: () => {
      sc.dirty = true;
    },
  };

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", setLightFromEvent);
      window.removeEventListener("pointerdown", setLightFromEvent);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      document
        .getElementById("bench")
        ?.removeEventListener("click", onBenchClick);
      document
        .getElementById("probebtn")
        ?.removeEventListener("click", onProbeClick);
      const w = window as unknown as Record<string, unknown>;
      delete w.lab;
      delete w.runBench;
      delete w.measureCaustic;
      delete w.setLight;
      gui.destroy();
      displayMat.dispose();
      quad.geometry.dispose();
      sc.dispose();
    },
  };
}
