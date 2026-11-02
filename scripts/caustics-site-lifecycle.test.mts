import assert from "node:assert/strict";
import test from "node:test";

class T {
  listeners = new Map<string, Set<EventListener>>();
  addEventListener(t: string, fn: EventListener) {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t)!.add(fn);
  }
  removeEventListener(t: string, fn: EventListener) {
    this.listeners.get(t)?.delete(fn);
  }
  dispatch(t: string, e: Record<string, unknown> = {}) {
    this.listeners
      .get(t)
      ?.forEach((f) => f({ type: t, ...e } as Event));
  }
  count(t: string) {
    return this.listeners.get(t)?.size ?? 0;
  }
}

class El extends T {
  children: El[] = [];
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  classList = { add: () => {} };
  rect = { top: 0, left: 0, right: 0, height: 100 };
  textContent = "";
  private inner = "";
  set innerHTML(v: string) {
    this.inner = v;
    if (v === "") this.children = [];
  }
  get innerHTML() {
    return this.inner;
  }
  appendChild(c: El) {
    this.children.push(c);
    return c;
  }
  append(...cs: El[]) {
    this.children.push(...cs);
  }
  remove() {}
  setAttribute() {}
  addEventListener(t: string, fn: EventListener) {
    super.addEventListener(t, fn);
  }
  getBoundingClientRect() {
    return this.rect;
  }
  querySelector(_sel?: string): El | null {
    return null;
  }
}

class FakeScene {
  static created: FakeScene[] = [];
  static fail = false;
  opts: Record<string, unknown>;
  gems: { visible: boolean }[];
  dirty = true;
  W = 0;
  H = 0;
  solveRes: number;
  params = { lightHeight: 140, directStrength: 0, causticStrength: 0, splatSize: 0 };
  renderer = {
    info: { autoReset: true, reset: () => {}, render: { calls: 1 } },
    getContext: () => ({ getExtension: () => ({ loseContext() {} }) }),
  };
  calls = {
    solve: 0, composite: 0, setLight: 0, disposed: 0,
    setSolveRes: [] as number[], setGemVisible: [] as unknown[][],
    setGemSize: [] as number[][], setGemCenter: [] as number[][],
    resize: [] as number[][],
  };
  static create(opts: Record<string, unknown>) {
    if (FakeScene.fail) return null;
    const s = new FakeScene(opts);
    FakeScene.created.push(s);
    return s;
  }
  constructor(opts: Record<string, unknown>) {
    this.opts = opts;
    this.solveRes = (opts.solveRes as number) ?? 128;
    this.gems = (opts.gems as unknown[]).map(() => ({ visible: true }));
  }
  setLight() { this.calls.setLight++; this.dirty = true; }
  setGemVisible(i: number, v: boolean) {
    this.calls.setGemVisible.push([i, v]);
    this.gems[i].visible = v;
    this.dirty = true;
  }
  setGemCenter(i: number, x: number, y: number, z: number) {
    this.calls.setGemCenter.push([i, x, y, z]);
    this.dirty = true;
  }
  setGemSize(i: number, s: number) {
    this.calls.setGemSize.push([i, s]);
    this.dirty = true;
  }
  setSolveRes(r: number) { this.calls.setSolveRes.push(r); this.dirty = true; }
  resize(w: number, h: number) { this.calls.resize.push([w, h]); this.W = w; this.H = h; this.dirty = true; }
  solve() { this.calls.solve++; }
  composite() { this.calls.composite++; }
  dispose() { this.calls.disposed++; }
}

interface World {
  win: T & Record<string, unknown>;
  doc: T & Record<string, unknown>;
  canvas: El;
  staticLayer: El;
  root: El;
  mainEl: El;
  motionMQ: { matches: boolean } & T;
  coarseMQ: { matches: boolean } & T;
  rafQ: (null | ((n: number) => void))[];
  idleQ: (() => void)[];
  step: (now: number, n?: number) => void;
  flush: () => Promise<void>;
  cleanup: () => void;
}

function makeWorld(width = 1432, gutter = 160): World {
  FakeScene.created = [];
  const win = new T() as World["win"];
  const doc = new T() as World["doc"];
  const canvas = new El();
  const staticLayer = new El();
  const mainEl = new El();
  mainEl.rect = { top: 0, left: gutter, right: width - gutter, height: 4000 };
  const anchorEls: Record<string, El> = {};
  for (const s of [".hero h1", ".context-strip", ".about-strip"]) {
    anchorEls[s] = new El();
  }
  anchorEls[".hero h1"].rect = { top: 200, left: 100, right: 900, height: 120 };
  anchorEls[".context-strip"].rect = { top: 600, left: gutter, right: width - gutter, height: 60 };
  anchorEls[".about-strip"].rect = { top: 1900, left: gutter, right: width - gutter, height: 300 };
  const root = new El();
  root.querySelector = (sel: string) =>
    sel === ".gem-canvas" ? canvas : staticLayer;
  const motionMQ = new T() as World["motionMQ"];
  motionMQ.matches = false;
  const coarseMQ = new T() as World["coarseMQ"];
  coarseMQ.matches = false;
  const rafQ: World["rafQ"] = [];
  const idleQ: World["idleQ"] = [];

  Object.assign(win, {
    innerWidth: width,
    innerHeight: 900,
    scrollY: 0,
    devicePixelRatio: 1,
    matchMedia: (q: string) =>
      q.includes("reduced-motion") ? motionMQ : coarseMQ,
    requestAnimationFrame: (cb: (n: number) => void) => {
      rafQ.push(cb);
      return rafQ.length;
    },
    cancelAnimationFrame: (id: number) => {
      rafQ[id - 1] = null;
    },
    requestIdleCallback: (cb: () => void) => {
      idleQ.push(cb);
      return idleQ.length;
    },
    cancelIdleCallback: (id: number) => {
      idleQ[id - 1] = null as never;
    },
  });
  Object.assign(doc, {
    hidden: false,
    readyState: "complete",
    body: new El(),
    fonts: { ready: { then: () => {} } },
    querySelector: (sel: string) =>
      sel === "main" ? mainEl : (anchorEls[sel] ?? null),
    createElement: () => new El(),
    createElementNS: () => new El(),
  });

  const g = globalThis as Record<string, unknown>;
  const saved = {
    window: g.window, document: g.document, location: g.location,
    ResizeObserver: g.ResizeObserver,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame,
  };
  g.window = win;
  g.document = doc;
  g.location = { pathname: "/", search: "" };
  g.requestAnimationFrame = win.requestAnimationFrame;
  g.cancelAnimationFrame = win.cancelAnimationFrame;
  g.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };

  return {
    win, doc, canvas, staticLayer, root, mainEl, motionMQ, coarseMQ, rafQ, idleQ,
    step(now, n = 1) {
      for (let k = 0; k < n; k++) {
        const q = rafQ.splice(0);
        now += 0;
        q.forEach((cb) => cb && cb(now));
      }
    },
    async flush() {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    cleanup() {
      Object.assign(g, saved);
    },
  };
}

function depsFor(loader?: () => Promise<unknown>, clock?: { t: number }) {
  return {
    loadCore:
      loader ??
      (async () => ({ CausticsScene: FakeScene as never })),
    ...(clock ? { now: () => clock.t } : {}),
  } as never;
}

import { initSiteCaustics } from "../src/scripts/caustics/site.ts";

test("boot: lazy start creates scene on idle and goes live", async () => {
  const w = makeWorld();
  const { initSiteCaustics } = await import("../src/scripts/caustics/site.ts");
  const stop = initSiteCaustics(w.root as never, depsFor());
  assert.equal(w.idleQ.length, 1, "idle scheduled");
  w.idleQ.shift()!();
  await w.flush();
  assert.equal(FakeScene.created.length, 1);
  assert.equal(w.root.dataset.mode, "live");
  stop();
  w.cleanup();
});

test("pagehide tears down; persisted pageshow reboots a new scene", async () => {
  const w = makeWorld();
  const stop = initSiteCaustics(w.root as never, depsFor());
  w.idleQ.pop()!();
  await w.flush();
  assert.equal(FakeScene.created.length, 1);
  w.win.dispatch("pagehide");
  assert.equal(FakeScene.created[0].calls.disposed, 1);
  assert.equal(w.win.count("pointermove"), 0, "listeners removed");
  w.win.dispatch("pageshow", { persisted: true });
  w.idleQ.pop()!();
  await w.flush();
  assert.equal(FakeScene.created.length, 2, "new scene after bfcache");
  assert.ok(w.win.count("pointermove") > 0);
  stop();
  w.cleanup();
});

test("reduced-motion stops to static and resumes on un-reduce", async () => {
  const w = makeWorld();
  const stop = initSiteCaustics(w.root as never, depsFor());
  w.idleQ.shift()!();
  await w.flush();
  w.motionMQ.matches = true;
  w.motionMQ.dispatch("change");
  assert.equal(w.root.dataset.mode, "static");
  assert.equal(FakeScene.created[0].calls.disposed, 1);
  w.motionMQ.matches = false;
  w.motionMQ.dispatch("change");
  await w.flush();
  assert.equal(FakeScene.created.length, 2);
  assert.equal(w.root.dataset.mode, "live");
  stop();
  w.cleanup();
});

test("coarse pointer uses static path and never loads core", async () => {
  const w = makeWorld();
  w.coarseMQ.matches = true;
  let loaded = 0;
  const stop = initSiteCaustics(w.root as never, {
    loadCore: async () => {
      loaded++;
      return { CausticsScene: FakeScene as never };
    },
  } as never);
  await w.flush();
  assert.equal(loaded, 0);
  assert.equal(w.root.dataset.mode, "static");
  w.coarseMQ.matches = false;
  w.coarseMQ.dispatch("change");
  await w.flush();
  assert.equal(loaded, 1);
  stop();
  w.cleanup();
});

test("hidden during async import defers creation until visible", async () => {
  const w = makeWorld();
  let resolveMod: (v: unknown) => void = () => {};
  const stop = initSiteCaustics(w.root as never, {
    loadCore: () => new Promise((r) => { resolveMod = r; }),
  } as never);
  w.idleQ.shift()!();
  (w.doc as unknown as { hidden: boolean }).hidden = true;
  w.doc.dispatch("visibilitychange");
  await w.flush();
  assert.equal(FakeScene.created.length, 0, "no start while hidden");
  resolveMod({ CausticsScene: FakeScene as never });
  await w.flush();
  assert.equal(FakeScene.created.length, 0, "still hidden");
  (w.doc as unknown as { hidden: boolean }).hidden = false;
  w.doc.dispatch("visibilitychange");
  resolveMod({ CausticsScene: FakeScene as never });
  await w.flush();
  await w.flush();
  assert.equal(FakeScene.created.length, 1);
  stop();
  w.cleanup();
});

test("stale import after teardown does not create or throw", async () => {
  const w = makeWorld();
  let resolveMod: (v: unknown) => void = () => {};
  const stop = initSiteCaustics(w.root as never, {
    loadCore: () => new Promise((r) => { resolveMod = r; }),
  } as never);
  w.idleQ.shift()!();
  stop();
  await assert.doesNotReject(async () => {
    resolveMod({ CausticsScene: FakeScene as never });
    await w.flush();
  });
  assert.equal(FakeScene.created.length, 0);
  w.cleanup();
});

test("creation failure falls back to static without throwing", async () => {
  const w = makeWorld();
  FakeScene.fail = true;
  const stop = initSiteCaustics(w.root as never, depsFor());
  w.idleQ.shift()!();
  await w.flush();
  assert.equal(w.root.dataset.mode, "static");
  FakeScene.fail = false;
  stop();
  w.cleanup();
});

test("context loss latches static until webglcontextrestored", async () => {
  const w = makeWorld();
  const stop = initSiteCaustics(w.root as never, depsFor());
  w.idleQ.shift()!();
  await w.flush();
  w.canvas.dispatch("webglcontextlost", { preventDefault() {} });
  assert.equal(w.root.dataset.mode, "static");
  const before = FakeScene.created.length;
  w.win.dispatch("resize");
  await w.flush();
  assert.equal(FakeScene.created.length, before, "no restart on lost ctx");
  w.canvas.dispatch("webglcontextrestored");
  await w.flush();
  assert.equal(FakeScene.created.length, before + 1);
  stop();
  w.cleanup();
});

test("narrow boot inits no GPU; widening revives via resize", async () => {
  const w = makeWorld(1024, 40);
  let loaded = 0;
  const stop = initSiteCaustics(w.root as never, {
    loadCore: async () => {
      loaded++;
      return { CausticsScene: FakeScene as never };
    },
  } as never);
  await w.flush();
  assert.equal(loaded, 0, "no GPU with no fitting anchor");
  assert.equal(w.root.dataset.mode, "static");
  (w.win as unknown as { innerWidth: number }).innerWidth = 1432;
  w.mainEl.rect.left = 160;
  w.mainEl.rect.right = 1272;
  w.win.dispatch("resize");
  await w.flush();
  assert.equal(loaded, 1);
  assert.equal(w.root.dataset.mode, "live");
  stop();
  w.cleanup();
});

test("governor: 400ms active frames demote; idle gap does not count", async () => {
  const w = makeWorld();
  const clock = { t: 1000 };
  const stop = initSiteCaustics(w.root as never, depsFor(undefined, clock));
  w.idleQ.shift()!();
  await w.flush();
  const sc = FakeScene.created[0];
  for (let i = 0; i < 62; i++) {
    w.win.dispatch("pointermove", { clientX: 10, clientY: 10 });
    sc.dirty = true;
    clock.t += 400;
    w.step(clock.t);
  }
  assert.ok(sc.calls.setSolveRes.includes(192), "slow active frames demote");
  const nBefore = sc.calls.setSolveRes.length;
  for (let i = 0; i < 5; i++) {
    sc.dirty = false;
    clock.t += 16;
    w.step(clock.t);
  }
  assert.equal(sc.calls.setSolveRes.length, nBefore, "idle gap adds no sample");
  stop();
  w.cleanup();
});

test("zero-visible-gem bench rejected; pointer skipped after empty clear", async () => {
  const w = makeWorld();
  const stop = initSiteCaustics(w.root as never, depsFor());
  w.idleQ.shift()!();
  await w.flush();
  const sc = FakeScene.created[0];
  (w.win as unknown as { scrollY: number }).scrollY = 100000;
  const docQ = w.doc as unknown as {
    querySelector: (s: string) => { rect: { top: number } };
  };
  for (const key of [".hero h1", ".context-strip", ".about-strip"]) {
    docQ.querySelector(key).rect.top = -98000;
  }
  w.win.dispatch("scroll");
  assert.ok(
    sc.calls.setGemVisible.slice(-3).every(([, v]) => v === false),
    "all gems culled",
  );
  (window as unknown as { __gemBench: (n: number) => void }).__gemBench(30);
  const solvesAfterReject = sc.calls.solve;
  for (let i = 0; i < 10; i++) {
    w.step(2000 + i * 16);
  }
  assert.ok(sc.calls.solve - solvesAfterReject <= 1, "at most one clearing render");
  const lightCalls = sc.calls.setLight;
  w.win.dispatch("pointermove", { clientX: 100, clientY: 100 });
  assert.equal(sc.calls.setLight, lightCalls, "pointer ignored while all hidden");
  const clearedSolves = sc.calls.solve;
  w.win.dispatch("scroll");
  w.step(2500);
  assert.equal(sc.calls.solve, clearedSolves, "repeated hidden scroll skips GPU work");
  stop();
  w.cleanup();
});

test("narrowing disposes GPU; widening creates fresh scene", async (t) => {
  const w = makeWorld();
  const stop = initSiteCaustics(w.root as never, depsFor());
  t.after(() => { stop(); w.cleanup(); });
  w.idleQ.shift()!();
  await w.flush();
  const first = FakeScene.created[0];
  w.win.innerWidth = 1024;
  w.mainEl.rect.left = 40;
  w.mainEl.rect.right = 984;
  w.win.dispatch("resize");
  assert.equal(first.calls.disposed, 1);
  assert.equal(w.root.dataset.mode, "static");
  w.win.innerWidth = 1432;
  w.mainEl.rect.left = 160;
  w.mainEl.rect.right = 1272;
  w.win.dispatch("resize");
  await w.flush();
  assert.equal(FakeScene.created.length, 2);
  assert.equal(w.root.dataset.mode, "live");
});

test("pending import rechecks available gutters before allocating GPU", async (t) => {
  const w = makeWorld();
  let resolveMod: (v: unknown) => void = () => {};
  const stop = initSiteCaustics(w.root as never, depsFor(() => new Promise(r => { resolveMod = r; })));
  t.after(() => { stop(); w.cleanup(); });
  w.idleQ.shift()!();
  w.win.innerWidth = 1024;
  w.mainEl.rect.left = 40;
  w.mainEl.rect.right = 984;
  w.win.dispatch("resize");
  resolveMod({ CausticsScene: FakeScene });
  await w.flush();
  assert.equal(FakeScene.created.length, 0);
  assert.equal(w.root.dataset.mode, "static");
});

test("throwing renderer factory falls back to static", async (t) => {
  const w = makeWorld();
  const stop = initSiteCaustics(w.root as never, depsFor(async () => ({
    CausticsScene: { create() { throw new Error("GPU unavailable"); } },
  })));
  t.after(() => { stop(); w.cleanup(); });
  w.idleQ.shift()!();
  await w.flush();
  assert.equal(w.root.dataset.mode, "static");
  assert.equal(FakeScene.created.length, 0);
});
