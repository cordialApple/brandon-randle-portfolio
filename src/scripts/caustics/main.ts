import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import {
  MeshBVH,
  MeshBVHUniformStruct,
  FloatVertexAttributeTexture,
  SAH,
} from "three-mesh-bvh";
import { makeGemGeometry, verifyGemGeometry } from "./gem";
import {
  makeLightNormalMaterial,
  makeSplatMaterial,
  makeReceiverMaterial,
  makeGemMaterial,
  makeDisplayMaterial,
  makeBlurMaterial,
  makeEnvTexture,
} from "./shaders";

export interface LabOptions {
  gemSides?: number;
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
  const solveRes = Math.min(
    Math.max(Math.floor(opts.solveRes ?? 256) || 256, 16),
    2048,
  );
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (err) {
    opts.onUnsupported?.(String(err));
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const gl2 = renderer.getContext() as WebGL2RenderingContext;
  if (!renderer.capabilities.isWebGL2) {
    opts.onUnsupported?.("WebGL2 unavailable");
    renderer.dispose();
    return null;
  }
  const extColorFloat = !!gl2.getExtension("EXT_color_buffer_float");
  const extFloatBlend = !!gl2.getExtension("EXT_float_blend");
  const extColorHalfFloat = !!gl2.getExtension("EXT_color_buffer_half_float");
  const extFloatLinear = !!gl2.getExtension("OES_texture_float_linear");
  const extHalfLinear = !!gl2.getExtension("OES_texture_half_float_linear");
  // EXT_color_buffer_float covers 16F renderability too; 16F blending needs no
  // extra ext, only 32F does. byte targets would silently quantize deposits.
  const canFloat = extColorFloat && extFloatBlend;
  const canHalf = extColorFloat || extColorHalfFloat;
  if (!canFloat && !canHalf) {
    opts.onUnsupported?.("float render target unsupported");
    renderer.dispose();
    return null;
  }
  const targetType = canFloat ? THREE.FloatType : THREE.HalfFloatType;
  const targetFilter =
    (canFloat && extFloatLinear) || (!canFloat && extHalfLinear)
      ? THREE.LinearFilter
      : THREE.NearestFilter;
  const dbgRen = gl2.getExtension("WEBGL_debug_renderer_info");
  const glRenderer = dbgRen
    ? gl2.getParameter(dbgRen.UNMASKED_RENDERER_WEBGL)
    : "webgl2 (masked)";

  let W = window.innerWidth;
  let H = window.innerHeight;
  renderer.setSize(W, H);
  renderer.setPixelRatio(1);

  // Page space: 1 unit = 1 css px, origin bottom-left, z toward viewer.
  const cam = new THREE.OrthographicCamera(0, W, H, 0, 1, 4000);
  cam.position.set(0, 0, 1000);
  const bufferCam = new THREE.OrthographicCamera(0, W, H, 0, 1, 4000);
  bufferCam.position.set(0, 0, 1000);
  const lightCam = new THREE.PerspectiveCamera(50, 1, 1, 100);

  const gemGeo = makeGemGeometry(8, 1, 0.35, 1.05, 0.55);
  gemGeo.rotateX(Math.PI / 2); // table faces +z (viewer), pavilion into page
  gemGeo.scale(60, 60, 60);
  const geoCheck = verifyGemGeometry(gemGeo);
  if (geoCheck.invertedFaces || geoCheck.openEdges) {
    console.error("[caustics] gem geometry check failed", geoCheck);
  }
  const bvh = new MeshBVH(gemGeo, { strategy: SAH });
  const bvhStruct = new MeshBVHUniformStruct();
  bvhStruct.updateFrom(bvh);
  const normalAttr = new FloatVertexAttributeTexture();
  normalAttr.updateFrom(gemGeo.getAttribute("normal") as THREE.BufferAttribute);

  const gemMat = makeGemMaterial();
  const gem = new THREE.Mesh(gemGeo, gemMat);
  const gemCenter = new THREE.Vector3(W * 0.5, H * 0.42, 65);
  gem.position.copy(gemCenter);
  const gemRadius = gemGeo.boundingSphere?.radius ?? 70;

  const recvMat = makeReceiverMaterial();
  const receiver = new THREE.Mesh(new THREE.PlaneGeometry(W, H), recvMat);
  receiver.position.set(W / 2, H / 2, 0);

  const scene = new THREE.Scene();
  scene.add(receiver, gem);

  const lightTarget = new THREE.WebGLRenderTarget(solveRes, solveRes, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthTexture: new THREE.DepthTexture(solveRes, solveRes, THREE.FloatType),
  });
  const lightNormalMat = makeLightNormalMaterial();
  const gemForLight = new THREE.Mesh(gemGeo, lightNormalMat);
  gemForLight.position.copy(gemCenter);
  const lightScene = new THREE.Scene();
  lightScene.add(gemForLight);

  // position attr carries light-view uv in xy (z unused); a true 3-component
  // attribute keeps computeBoundingSphere valid
  const nPts = solveRes * solveRes;
  const uvs = new Float32Array(nPts * 3);
  for (let j = 0, p = 0; j < solveRes; j++) {
    for (let i = 0; i < solveRes; i++) {
      uvs[p++] = (i + 0.5) / solveRes;
      uvs[p++] = (j + 0.5) / solveRes;
      uvs[p++] = 0;
    }
  }
  const splatGeo = new THREE.BufferGeometry();
  splatGeo.setAttribute("position", new THREE.BufferAttribute(uvs, 3));
  splatGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.5, 0.5, 0), 1);
  const splatMat = makeSplatMaterial();
  const splats = new THREE.Points(splatGeo, splatMat);
  splats.frustumCulled = false;
  const splatScene = new THREE.Scene();
  splatScene.add(splats);

  const mkTarget = () =>
    new THREE.WebGLRenderTarget(W, H, {
      minFilter: targetFilter,
      magFilter: targetFilter,
      type: targetType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
    });
  const causticRaw = mkTarget();
  const causticPing = mkTarget();
  const causticFinal = mkTarget();

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurMat = makeBlurMaterial();
  const displayMat = makeDisplayMaterial();
  const quad = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(
    new THREE.PlaneGeometry(2, 2),
    displayMat,
  );
  quad.frustumCulled = false;
  quadScene.add(quad);

  const envTex = makeEnvTexture();
  const lightPos = new THREE.Vector3(W * 0.5, H * 0.7, 140);
  const params = {
    lightHeight: 140,
    ior: 1.5,
    bounces: 8,
    splatSize: 2.0,
    debugStage: 0,
    blurRadius: 3.0,
    blurEnabled: true,
    intensity: 6000,
    causticStrength: 1.0,
    directStrength: 2.2e3,
    specStrength: 1.4e4,
    specPow: 90,
    tint: "#66ddff",
    baseColor: "#0d091a",
    view: "final" as "final" | "caustic" | "scatter" | "lightDepth" | "lightNormal",
    paused: false,
  };
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
  gui.addColor(params, "tint");
  gui.addColor(params, "baseColor");
  gui.add(params, "view", [
    "final",
    "caustic",
    "scatter",
    "lightDepth",
    "lightNormal",
  ]);
  gui.add(params, "paused").name("pause solve");
  gui.onChange(() => {
    lightDirty = true;
  });

  const statsEl = document.getElementById("stats");
  const glInfoEl = document.getElementById("glinfo");
  if (glInfoEl) {
    const bufName = targetType === THREE.FloatType ? "float" : "half";
    glInfoEl.textContent =
      `${glRenderer} · webgl2 · buf=${bufName}` +
      `${extFloatBlend ? " +float-blend" : ""}` +
      ` · geo ${geoCheck.invertedFaces}inv/${geoCheck.openEdges}open`;
  }

  let lightDirty = true;
  let disposed = false;
  const setLightFromEvent = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    lightPos.set(e.clientX - r.left, H - (e.clientY - r.top), params.lightHeight);
    lightDirty = true;
  };
  window.addEventListener("pointermove", setLightFromEvent);
  window.addEventListener("pointerdown", setLightFromEvent);

  function fitLightCamera() {
    const dist = lightPos.distanceTo(gemCenter);
    lightCam.position.copy(lightPos);
    lightCam.up.set(0, 1, 0);
    lightCam.lookAt(gemCenter);
    lightCam.fov = THREE.MathUtils.radToDeg(
      2 * Math.asin(Math.min((gemRadius * 1.15) / Math.max(dist, 1e-3), 0.999)),
    );
    lightCam.near = Math.max(dist - gemRadius * 1.5, 1);
    const receiverFar = Math.hypot(
      Math.max(Math.abs(lightPos.x), Math.abs(W - lightPos.x)),
      Math.max(Math.abs(lightPos.y), Math.abs(H - lightPos.y)),
      lightPos.z,
    );
    lightCam.far = Math.max(dist + gemRadius * 2.5, receiverFar);
    lightCam.aspect = 1;
    lightCam.updateProjectionMatrix();
    lightCam.updateMatrixWorld();
  }

  function renderLightView() {
    gemForLight.position.copy(gem.position);
    renderer.setRenderTarget(lightTarget);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear();
    renderer.render(lightScene, lightCam);
  }

  function runSolve() {
    gem.updateMatrixWorld(true);
    const sm = splatMat.uniforms;
    sm.debugStage.value = params.debugStage;
    sm.lightViewInv.value.copy(lightCam.matrixWorld);
    sm.lightProjInv.value.copy(lightCam.projectionMatrixInverse);
    sm.lightPos.value.copy(lightPos);
    sm.lightViewRes.value.set(solveRes, solveRes);
    sm.normalTex.value = lightTarget.texture;
    sm.depthTex.value = lightTarget.depthTexture;
    (sm.bvh as { value: unknown }).value = bvhStruct;
    (sm.normalAttribute as { value: unknown }).value = normalAttr;
    sm.gemModelMatrix.value.copy(gem.matrixWorld);
    sm.bounces.value = params.bounces;
    sm.ior.value = params.ior;
    sm.intensity.value = params.intensity;
    sm.splatSizePx.value = params.splatSize;
    sm.maxDist.value = 4000;
    sm.tint.value.set(params.tint);

    renderer.setRenderTarget(causticRaw);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(splatScene, bufferCam);

    if (params.blurEnabled) {
      blurMat.uniforms.texel.value.set(
        1 / causticRaw.width,
        1 / causticRaw.height,
      );
      blurMat.uniforms.radius.value = params.blurRadius;
      quad.material = blurMat;
      blurMat.uniforms.dir.value.set(1, 0);
      blurMat.uniforms.tex.value = causticRaw.texture;
      renderer.setRenderTarget(causticPing);
      renderer.render(quadScene, quadCam);
      blurMat.uniforms.dir.value.set(0, 1);
      blurMat.uniforms.tex.value = causticPing.texture;
      renderer.setRenderTarget(causticFinal);
      renderer.render(quadScene, quadCam);
    }
  }

  const activeCaustic = () =>
    params.blurEnabled ? causticFinal : causticRaw;

  function composite() {
    gem.updateMatrixWorld(true);
    const rm = recvMat.uniforms;
    rm.baseColor.value.set(params.baseColor);
    rm.causticTex.value = activeCaustic().texture;
    rm.receiverRes.value.set(W, H);
    rm.lightPos.value.copy(lightPos);
    rm.lightViewMatrix.value.copy(lightCam.matrixWorldInverse);
    rm.lightProjMatrix.value.copy(lightCam.projectionMatrix);
    rm.lightDepthTex.value = lightTarget.depthTexture;
    rm.lightHasProj.value = 1;
    rm.directStrength.value = params.directStrength;
    rm.causticStrength.value = params.causticStrength;

    const gm = gemMat.uniforms;
    gm.envMap.value = envTex;
    (gm.bvh as { value: unknown }).value = bvhStruct;
    (gm.normalAttribute as { value: unknown }).value = normalAttr;
    gm.gemModelMatrix.value.copy(gem.matrixWorld);
    gm.bounces.value = params.bounces;
    gm.ior.value = params.ior;
    gm.tint.value.set(params.tint);
    gm.lightPos.value.copy(lightPos);
    gm.specStrength.value = params.specStrength;
    gm.specPow.value = params.specPow;

    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    renderer.render(scene, cam);
  }

  function showDebug() {
    const dm = displayMat.uniforms;
    if (params.view === "caustic" || params.view === "scatter") {
      dm.tex.value =
        params.view === "scatter" ? causticRaw.texture : activeCaustic().texture;
      dm.mode.value = 0;
      dm.gain.value = params.causticStrength * 2;
    } else if (params.view === "lightDepth") {
      dm.tex.value = lightTarget.depthTexture;
      dm.mode.value = 1;
      dm.gain.value = 1;
    } else {
      dm.tex.value = lightTarget.texture;
      dm.mode.value = 0;
      dm.gain.value = 1;
    }
    quad.material = displayMat;
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
      statsEl.textContent =
        `frame ${s[Math.floor(s.length * 0.5)].toFixed(1)}ms p50 / ` +
        `${s[Math.floor(s.length * 0.95)].toFixed(1)}ms p95 · solve ${solveRes}²`;
    }
  }

  let bench: {
    t: number;
    n: number;
    times: number[];
    intervals: number[];
  } | null = null;
  (window as unknown as Record<string, unknown>).runBench = (n = 300) => {
    bench = { t: 0, n, times: [], intervals: [] };
  };
  const onBenchClick = () => {
    (window as unknown as { runBench: (n: number) => void }).runBench(300);
  };
  document.getElementById("bench")?.addEventListener("click", onBenchClick);

  const halfToFloat = (h: number) => {
    const s = (h & 0x8000) >> 15;
    const e = (h & 0x7c00) >> 10;
    const f = h & 0x03ff;
    return e === 0
      ? (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024)
      : e === 31
        ? f
          ? NaN
          : (s ? -1 : 1) * Infinity
        : (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
  };
  const measureCaustic = (x: number, y: number, w: number, h: number) => {
    const t = activeCaustic();
    let sum = 0;
    if (targetType === THREE.FloatType) {
      const px = new Float32Array(w * h * 4);
      // render-target origin is bottom-left; flip y
      renderer.readRenderTargetPixels(t, x, H - y - h, w, h, px);
      for (let i = 0; i < px.length; i += 4) {
        sum += px[i] + px[i + 1] + px[i + 2];
      }
    } else {
      const px = new Uint16Array(w * h * 4);
      renderer.readRenderTargetPixels(t, x, H - y - h, w, h, px);
      for (let i = 0; i < px.length; i += 4) {
        sum +=
          halfToFloat(px[i]) + halfToFloat(px[i + 1]) + halfToFloat(px[i + 2]);
      }
    }
    return sum / (w * h * 3);
  };
  (window as unknown as Record<string, unknown>).measureCaustic =
    measureCaustic;

  const probeEl = document.getElementById("probe");
  const onProbeClick = () => {
    const savedBench = bench;
    bench = null;
    const prev = lightPos.clone();
    lightPos.set(W * 0.5, H * 0.55, params.lightHeight);
    fitLightCamera();
    renderLightView();
    runSolve();
    const px = Math.max(0, Math.min(Math.round(W * 0.5 - 128), W - 256));
    const py = Math.max(0, Math.min(Math.round(H * 0.62 - 128), H - 256));
    const v = measureCaustic(px, py, 256, 256);
    if (probeEl) {
      const val = v < 1e-6 ? `${v.toExponential(6)} (inconclusive)` : v.toExponential(6);
      probeEl.textContent = `${val} @ ${solveRes}² rect(${px},${py},256,256)`;
    }
    lightPos.copy(prev);
    bench = savedBench;
    lightDirty = true;
  };
  document.getElementById("probebtn")?.addEventListener("click", onProbeClick);
  (window as unknown as Record<string, unknown>).setLight = (
    x: number,
    y: number,
    z?: number,
  ) => {
    lightPos.set(x, y, z ?? params.lightHeight);
    lightDirty = true;
  };

  let raf = 0;
  let last = performance.now();
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    last = now;
    if (bench) {
      bench.t += dt / 1000;
      const cx = W * 0.5 + Math.cos(bench.t * 2.2) * W * 0.28;
      const cy = H * 0.55 + Math.sin(bench.t * 2.2) * H * 0.22;
      lightPos.set(cx, cy, params.lightHeight);
      lightDirty = true;
    }
    if (params.lightHeight !== lightPos.z) {
      lightPos.z = params.lightHeight;
      lightDirty = true;
    }
    const t0 = performance.now();
    if (lightDirty || bench) {
      if (!params.paused) {
        fitLightCamera();
        renderLightView();
        runSolve();
      }
      if (params.view === "final") composite();
      else showDebug();
      lightDirty = false;
    }
    const ms = performance.now() - t0;
    pushTime(dt);
    if (bench) {
      bench.times.push(ms);
      bench.intervals.push(dt);
      if (bench.times.length >= bench.n) {
        const s = [...bench.times].sort((a, b) => a - b);
        const d = [...bench.intervals].sort((a, b) => a - b);
        const pct = (arr: number[], q: number) =>
          arr[Math.floor(arr.length * q)].toFixed(2);
        console.log(
          `[bench] n=${s.length} cpu-submit mean=${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)}ms ` +
            `p50=${pct(s, 0.5)}ms p95=${pct(s, 0.95)}ms · ` +
            `raf-interval p50=${pct(d, 0.5)}ms p95=${pct(d, 0.95)}ms ` +
            `(${solveRes}² splats)`,
        );
        bench = null;
      }
    }
  }
  raf = requestAnimationFrame(frame);

  const onResize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setSize(W, H);
    cam.right = W;
    cam.top = H;
    cam.updateProjectionMatrix();
    bufferCam.right = W;
    bufferCam.top = H;
    bufferCam.updateProjectionMatrix();
    causticRaw.setSize(W, H);
    causticPing.setSize(W, H);
    causticFinal.setSize(W, H);
    receiver.geometry.dispose();
    receiver.geometry = new THREE.PlaneGeometry(W, H);
    receiver.position.set(W / 2, H / 2, 0);
    gemCenter.set(W * 0.5, H * 0.42, 65);
    gem.position.copy(gemCenter);
    lightDirty = true;
  };
  window.addEventListener("resize", onResize);

  (window as unknown as Record<string, unknown>).lab = {
    renderer,
    params,
    invalidate: () => {
      lightDirty = true;
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
      document.getElementById("bench")?.removeEventListener("click", onBenchClick);
      document.getElementById("probebtn")?.removeEventListener("click", onProbeClick);
      const w = window as unknown as Record<string, unknown>;
      delete w.lab;
      delete w.runBench;
      delete w.measureCaustic;
      delete w.setLight;
      gui.destroy();
      for (const t of [lightTarget, causticRaw, causticPing, causticFinal]) {
        t.dispose();
      }
      for (const g of [gemGeo, splatGeo, receiver.geometry, quad.geometry]) {
        g.dispose();
      }
      for (const m of [
        gemMat,
        lightNormalMat,
        splatMat,
        recvMat,
        blurMat,
        displayMat,
      ]) {
        m.dispose();
      }
      envTex.dispose();
      normalAttr.dispose();
      bvhStruct.dispose();
      renderer.dispose();
    },
  };
}
