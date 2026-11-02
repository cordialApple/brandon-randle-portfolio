import type { CausticsScene } from "./core";

export interface GemAnchor {
  cut: "brilliant" | "step" | "shard";
  tint: string;
  edge: "left" | "right";
  selector: string;
  yFrac: number;
  fallbackDocY: number;
}

export interface GemPlacement {
  x: number;
  docY: number;
  r: number;
}

export function marginGemPlacement(
  edge: "left" | "right",
  anchorDocY: number,
  contentLeft: number,
  contentRight: number,
  viewportW: number,
): GemPlacement | null {
  const pad = 12;
  const gutter = edge === "left" ? contentLeft : viewportW - contentRight;
  const r = Math.min(44, (gutter - pad * 2) * 0.34);
  if (r < 14) return null;
  return {
    x: edge === "left" ? pad + r : viewportW - pad - r,
    docY: anchorDocY,
    r,
  };
}

export const QUALITY_TIERS = [128, 96, 64] as const;

export function nextQualityTier(
  tier: number,
  emaMs: number,
  framesInTier: number,
): number {
  if (emaMs > 26 && framesInTier > 60 && tier < QUALITY_TIERS.length - 1) {
    return tier + 1;
  }
  if (emaMs < 15 && framesInTier > 300 && tier > 0) {
    return tier - 1;
  }
  return tier;
}

export function anchorDocY(
  rect: { top: number; height: number } | null,
  yFrac: number,
  scrollY: number,
  fallback: number,
): number {
  if (!rect) return fallback;
  return rect.top + scrollY + rect.height * yFrac;
}

function anchorsFor(path: string): GemAnchor[] {
  if (path.startsWith("/work")) {
    return [
      {
        cut: "step",
        tint: "#77efcd",
        edge: "right",
        selector: ".work-list",
        yFrac: 0.06,
        fallbackDocY: 420,
      },
    ];
  }
  if (path.startsWith("/contact")) {
    return [
      {
        cut: "shard",
        tint: "#ff4fa0",
        edge: "left",
        selector: ".contact-heading",
        yFrac: 0.65,
        fallbackDocY: 300,
      },
    ];
  }
  return [
    {
      cut: "brilliant",
      tint: "#6de5f2",
      edge: "left",
      selector: ".hero h1",
      yFrac: 0.5,
      fallbackDocY: 300,
    },
    {
      cut: "step",
      tint: "#77efcd",
      edge: "right",
      selector: ".context-strip",
      yFrac: 0.5,
      fallbackDocY: 640,
    },
    {
      cut: "shard",
      tint: "#ff4fa0",
      edge: "right",
      selector: ".about-strip",
      yFrac: 0.2,
      fallbackDocY: 2000,
    },
  ];
}

export interface SiteCausticsDeps {
  loadCore?: () => Promise<{ CausticsScene: typeof CausticsScene }>;
  now?: () => number;
}

export function initSiteCaustics(
  root: HTMLElement,
  deps: SiteCausticsDeps = {},
): () => void {
  const loadCore = deps.loadCore ?? (() => import("./core"));
  const nowFn = deps.now ?? (() => performance.now());
  const canvas = root.querySelector<HTMLCanvasElement>(".gem-canvas")!;
  const staticLayer = root.querySelector<HTMLElement>(".gem-static")!;
  const anchors = anchorsFor(location.pathname);
  const mainEl = document.querySelector<HTMLElement>("main");
  const motionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarseMQ = window.matchMedia("(pointer: coarse)");
  const debug = new URLSearchParams(location.search).get("gemDebug") === "1";

  const listeners: Array<() => void> = [];
  const persistent: Array<() => void> = [];
  const on = (
    target: Window | Document | HTMLCanvasElement | MediaQueryList,
    type: string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions,
    bag = listeners,
  ) => {
    target.addEventListener(type, fn as EventListener, opts);
    bag.push(() =>
      target.removeEventListener(type, fn as EventListener, opts)
    );
  };

  let scene: CausticsScene | null = null;
  let raf = 0;
  let idleId = 0;
  let idleCancelled = false;
  let startToken = 0;
  let pendingStart = false;
  let contextLost = false;
  let disposed = false;
  let scrollY = window.scrollY;
  let lastActive = 0;
  let lastRenderNow = 0;
  let wasActive = false;
  let ema = 0;
  let emaN = 0;
  let tier = 0;
  let framesInTier = 0;
  let bench: {
    n: number;
    warm: number;
    intervals: number[];
    frames: number;
    t: number;
  } | null = null;
  let benchStatus: HTMLElement | null = null;
  let debugBox: HTMLElement | null = null;
  let resizeObs: ResizeObserver | null = null;

  const wantsGpu = () =>
    !motionMQ.matches &&
    !coarseMQ.matches &&
    window.innerWidth >= 720 &&
    !contextLost;
  const anyAnchorFits = () => measure().some(Boolean);

  let allHidden = true;
  let clearedOnce = false;

  const measure = () => {
    const mainRect = mainEl?.getBoundingClientRect() ?? null;
    const contentLeft = mainRect ? mainRect.left : 56;
    const contentRight = mainRect ? mainRect.right : window.innerWidth - 56;
    const vw = window.innerWidth;
    return anchors.map((a) => {
      const el = document.querySelector(a.selector);
      const docY = anchorDocY(
        el ? el.getBoundingClientRect() : null,
        a.yFrac,
        window.scrollY,
        a.fallbackDocY,
      );
      return marginGemPlacement(a.edge, docY, contentLeft, contentRight, vw);
    });
  };

  const drawStatic = () => {
    staticLayer.innerHTML = "";
    const placements = measure();
    anchors.forEach((a, i) => {
      const p = placements[i];
      if (!p) return;
      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      svg.setAttribute("viewBox", "0 0 40 40");
      svg.setAttribute("width", String(p.r * 2));
      svg.setAttribute("height", String(p.r * 2));
      svg.classList.add("gem-accent");
      svg.style.left = `${p.x - p.r}px`;
      svg.style.top = `${p.docY - p.r}px`;
      svg.innerHTML =
        a.cut === "shard"
          ? `<polygon points="14,4 28,10 26,32 12,38 6,20" fill="none" stroke="${a.tint}" stroke-width="1.4" opacity="0.8"/>`
          : a.cut === "step"
            ? `<rect x="8" y="12" width="24" height="16" fill="none" stroke="${a.tint}" stroke-width="1.4" opacity="0.8"/><rect x="12" y="16" width="16" height="8" fill="none" stroke="${a.tint}" stroke-width="1" opacity="0.6"/>`
            : `<polygon points="20,4 32,14 28,32 12,32 8,14" fill="none" stroke="${a.tint}" stroke-width="1.4" opacity="0.8"/><line x1="8" y1="14" x2="32" y2="14" stroke="${a.tint}" stroke-width="1" opacity="0.6"/>`;
      staticLayer.appendChild(svg);
    });
  };

  const activateStatic = () => {
    root.dataset.mode = "static";
    drawStatic();
  };
  const deactivateStatic = () => {
    root.dataset.mode = "live";
  };

  const layoutGems = () => {
    if (!scene) return;
    const ps = measure();
    const H = scene.H;
    let any = false;
    anchors.forEach((_a, i) => {
      const p = ps[i];
      const gem = scene!.gems[i];
      if (!p || !gem) {
        scene!.setGemVisible(i, false);
        return;
      }
      const vpY = p.docY - scrollY;
      const onScreen = vpY > -p.r * 3 && vpY < H + p.r * 3;
      scene!.setGemSize(i, p.r);
      scene!.setGemCenter(i, p.x, H - vpY, 55);
      scene!.setGemVisible(i, onScreen);
      if (onScreen) any = true;
    });
    if (any) clearedOnce = false;
    allHidden = !any;
    if (allHidden) invalidateBench("no visible gems");
  };

  const installDebugBox = () => {
    if (!debug || !scene) return;
    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:99;font:11px/1.5 monospace;color:#9fb;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:4px;pointer-events:auto";
    const btn = document.createElement("button");
    btn.textContent = "bench 300f";
    btn.addEventListener("click", () => runBench(300));
    const loseBtn = document.createElement("button");
    loseBtn.textContent = "lose ctx";
    loseBtn.addEventListener("click", () => {
      scene?.renderer
        .getContext()
        .getExtension("WEBGL_lose_context")
        ?.loseContext();
    });
    const status = document.createElement("span");
    status.textContent = "idle";
    box.append(btn, loseBtn, status);
    document.body.appendChild(box);
    debugBox = box;
    benchStatus = status;
  };

  const tick = (now: number) => {
    raf = 0;
    if (disposed || !scene) return;
    const dt = now - (lastRenderNow || now);
    if (bench) {
      bench.t += dt / 1000;
      scene.setLight(
        scene.W * 0.5 + Math.cos(bench.t * 2.2) * scene.W * 0.3,
        scene.H * 0.5 + Math.sin(bench.t * 2.2) * scene.H * 0.25,
        scene.params.lightHeight,
      );
    }
    let rendered = false;
    if (allHidden && clearedOnce) scene.dirty = false;
    if (scene.dirty) {
      scene.renderer.info.reset();
      scene.solve();
      scene.composite();
      scene.dirty = false;
      rendered = true;
      if (allHidden) clearedOnce = true;
      const activeDt = wasActive ? now - lastRenderNow : 0;
      lastRenderNow = now;
      wasActive = true;
      if (activeDt > 0) {
        ema = emaN === 0 ? activeDt : ema * 0.92 + activeDt * 0.08;
        emaN++;
        framesInTier++;
        const next = nextQualityTier(tier, ema, framesInTier);
        if (next !== tier) {
          tier = next;
          framesInTier = 0;
          scene.setSolveRes(QUALITY_TIERS[tier]);
        }
      }
    } else {
      wasActive = false;
    }
    if (bench && rendered) {
      bench.frames++;
      if (bench.frames > bench.warm) {
        bench.intervals.push(dt);
      }
      if (benchStatus && bench.frames % 30 === 0) {
        benchStatus.textContent = `${bench.intervals.length}/${bench.n}`;
      }
      if (bench.intervals.length >= bench.n) {
        const d = [...bench.intervals].sort((a, b) => a - b);
        const pct = (q: number) => d[Math.floor(d.length * q)].toFixed(2);
        const vis = scene.gems.filter((g) => g.visible).length;
        const line =
          `[gembench] rendered=${bench.frames} measured=${d.length} ` +
          `(excl. ${bench.warm} warmup) ` +
          `mean=${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2)}ms ` +
          `p50=${pct(0.5)} p95=${pct(0.95)}ms ` +
          `· solve ${scene.solveRes}² · ${vis} gems · ` +
          `${scene.renderer.info.render.calls} calls · ${scene.W}x${scene.H}`;
        console.log(line);
        if (benchStatus) benchStatus.textContent = line;
        bench = null;
      }
    }
    if (!disposed && (now - lastActive < 1600 || scene.dirty || bench)) {
      raf = requestAnimationFrame(tick);
    }
  };

  const wake = () => {
    lastActive = nowFn();
    if (!raf && scene && !disposed && !document.hidden) {
      wasActive = false;
      lastRenderNow = nowFn();
      raf = requestAnimationFrame(tick);
    }
  };

  const start = async () => {
    if (
      disposed ||
      scene ||
      pendingStart ||
      !wantsGpu() ||
      !anyAnchorFits()
    )
      return;
    const token = ++startToken;
    pendingStart = true;
    let mod: Awaited<ReturnType<typeof loadCore>>;
    try {
      mod = await loadCore();
    } catch {
      if (token === startToken && !disposed) {
        pendingStart = false;
        activateStatic();
      }
      return;
    }
    if (disposed || token !== startToken) return;
    pendingStart = false;
    if (!wantsGpu() || !anyAnchorFits()) return;
    if (document.hidden) {
      pendingStart = true;
      return;
    }
    let created: CausticsScene | null = null;
    try {
      created = mod.CausticsScene.create({
        canvas,
        transparent: true,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        solveRes: QUALITY_TIERS[0],
        gems: (() => {
          const ps = measure();
          return anchors.map((a, i) => ({
            cut: a.cut,
            tint: a.tint,
            size: ps[i]?.r ?? 1,
            center: { x: -9999, y: 0, z: 55 },
          }));
        })(),
        onUnsupported: () => {},
      });
    } catch {
      created = null;
    }
    if (disposed || token !== startToken) return;
    if (!created) {
      activateStatic();
      return;
    }
    scene = created;
    scene.params.directStrength = 0;
    scene.params.causticStrength = 0.55;
    scene.params.splatSize = 2.5;
    scene.renderer.info.autoReset = false;
    ema = 0;
    emaN = 0;
    tier = 0;
    framesInTier = 0;
    wasActive = false;
    lastRenderNow = 0;
    scrollY = window.scrollY;
    scene.resize(window.innerWidth, window.innerHeight);
    layoutGems();
    scene.setLight(scene.W * 0.68, scene.H * 0.45, scene.params.lightHeight);
    deactivateStatic();
    installDebugBox();
    wake();
  };

  const runBench = (n = 300) => {
    if (!scene) return;
    if (document.hidden) {
      console.warn("[gembench] aborted: page hidden");
      return;
    }
    layoutGems();
    if (allHidden) {
      console.warn("[gembench] rejected: no visible gems (nonrepresentative)");
      if (benchStatus) benchStatus.textContent = "rejected: no visible gems";
      return;
    }
    bench = { n, warm: 20, intervals: [], frames: 0, t: 0 };
    wake();
  };

  const invalidateBench = (why: string) => {
    if (!bench) return;
    console.warn(`[gembench] invalidated: ${why}`);
    bench = null;
    if (benchStatus) benchStatus.textContent = `invalidated (${why})`;
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    wasActive = false;
    invalidateBench("stopped mid-run");
    scene?.dispose();
    scene = null;
    debugBox?.remove();
    debugBox = null;
    benchStatus = null;
    pendingStart = false;
    startToken++;
  };

  const onVis = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      wasActive = false;
      invalidateBench("page hidden mid-run");
    } else if (pendingStart) {
      pendingStart = false;
      void start().catch(() => {});
    } else {
      wake();
    }
  };

  const onPointer = (e: Event) => {
    if (!scene || (allHidden && clearedOnce)) return;
    const pe = e as PointerEvent;
    scene.setLight(pe.clientX, scene.H - pe.clientY, scene.params.lightHeight);
    wake();
  };
  const onScroll = () => {
    scrollY = window.scrollY;
    layoutGems();
    wake();
  };
  const onResize = () => {
    scrollY = window.scrollY;
    if (!wantsGpu() || !anyAnchorFits()) {
      if (scene || pendingStart) stop();
      activateStatic();
      return;
    }
    if (scene) {
      scene.resize(window.innerWidth, window.innerHeight);
      layoutGems();
      wake();
    } else {
      drawStatic();
    }
    if (!scene && !disposed) {
      void start().catch(() => {});
    }
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
    stop();
    activateStatic();
  };
  const onContextRestored = () => {
    if (!contextLost || disposed) return;
    contextLost = false;
    void start().catch(() => {});
  };
  const onPrefChange = () => {
    if (!wantsGpu() && scene) {
      stop();
      activateStatic();
    } else if (
      wantsGpu() &&
      !scene &&
      !disposed &&
      anyAnchorFits()
    ) {
      void start().catch(() => {});
    } else if (!wantsGpu() && !scene) {
      activateStatic();
    }
  };
  const onPageHide = () => {
    teardown();
  };
  const onPageShow = (e: Event) => {
    if ((e as PageTransitionEvent).persisted && disposed) {
      disposed = false;
      contextLost = false;
      boot();
    }
  };

  const boot = () => {
    on(window, "pointermove", onPointer, { passive: true });
    on(window, "pointerdown", onPointer, { passive: true });
    on(window, "scroll", onScroll, { passive: true });
    on(window, "resize", onResize);
    on(document, "visibilitychange", onVis);
    on(canvas, "webglcontextlost", onContextLost);
    on(canvas, "webglcontextrestored", onContextRestored);
    on(motionMQ, "change", onPrefChange);
    on(coarseMQ, "change", onPrefChange);
    if (!scene) activateStatic();
    if (typeof ResizeObserver !== "undefined" && mainEl) {
      const ro = new ResizeObserver(() => {
        if (scene) {
          layoutGems();
          wake();
        } else {
          drawStatic();
        }
      });
      ro.observe(mainEl);
      resizeObs = ro;
      listeners.push(() => {
        ro.disconnect();
        if (resizeObs === ro) resizeObs = null;
      });
    }
    if (!wantsGpu() || !anyAnchorFits()) {
      return;
    }
    idleCancelled = false;
    const begin = () => {
      if (idleCancelled || disposed) return;
      if (document.hidden) {
        pendingStart = true;
        return;
      }
      void start().catch(() => {});
    };
    const ric =
      window.requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 250));
    if (document.readyState === "complete") {
      idleId = ric(begin);
    } else {
      on(window, "load", () => {
        idleId = ric(begin);
      });
    }
  };

  const teardown = () => {
    stop();
    idleCancelled = true;
    const cic =
      window.cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    if (idleId) cic(idleId);
    resizeObs?.disconnect();
    resizeObs = null;
    listeners.forEach((f) => f());
    listeners.length = 0;
    disposed = true;
  };

  on(window, "pagehide", onPageHide, undefined, persistent);
  on(window, "pageshow", onPageShow, undefined, persistent);
  document.fonts?.ready?.then?.(() => {
    if (!disposed) {
      if (scene) {
        layoutGems();
        wake();
      } else {
        drawStatic();
      }
    }
  });

  (window as unknown as Record<string, unknown>).__gemBench = runBench;
  persistent.push(() => {
    delete (window as unknown as Record<string, unknown>).__gemBench;
  });

  boot();
  return () => {
    teardown();
    persistent.forEach((f) => f());
    persistent.length = 0;
  };
}
