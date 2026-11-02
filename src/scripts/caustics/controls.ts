import {
  advanceSpring,
  releaseVelocity,
  rubberBand,
  VELOCITY_WINDOW_MS,
  type MotionSample,
  type SpringState,
} from "./spring.ts";

export interface GemPose {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export const initialGemPose = (): GemPose => ({ x: 0, y: 0, rx: 0, ry: 0 });

export function createGemControls(
  labels: string[],
  poses: GemPose[],
  changed: () => void,
  now = () => performance.now(),
  resetPoses = poses.map(pose => ({ ...pose, x: 0, y: 0 })),
) {
  const layer = document.createElement("div");
  layer.className = "gem-interactions";
  const help = document.createElement("p");
  help.id = "gem-controls-help";
  help.className = "sr-only";
  help.textContent = "Drag to stretch; release to spring home. Drag rotation handle or Shift-drag to rotate. Arrow keys nudge; Shift plus arrows rotate. Home or double-click resets. Escape cancels drag.";
  layer.appendChild(help);
  const removers: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, fn: EventListener) => {
    target.addEventListener(type, fn);
    removers.push(() => target.removeEventListener(type, fn));
  };
  let drag: {
    index: number;
    id: number;
    button: HTMLButtonElement;
    rotate: boolean;
    x: number;
    y: number;
    scrollY: number;
    pose: GemPose;
    samples: MotionSample[];
  } | null = null;
  const springs: ({ x: SpringState; y: SpringState; damping: number; time: number } | null)[] = poses.map(() => null);
  const beginReturn = (index: number, velocity = { x: 0, y: 0 }) => {
    const pose = poses[index];
    springs[index] = {
      x: { position: pose.x, velocity: velocity.x },
      y: { position: pose.y, velocity: velocity.y },
      damping: 1 - Math.min(Math.hypot(velocity.x, velocity.y) / 1200, 1) * 0.12,
      time: now(),
    };
    changed();
  };

  const finish = (cancel = false, animate = true) => {
    if (!drag) return;
    const previous = drag;
    drag = null;
    groups[previous.index].dataset.dragging = "false";
    if (previous.button.hasPointerCapture(previous.id)) {
      previous.button.releasePointerCapture(previous.id);
    }
    if (cancel) {
      Object.assign(poses[previous.index], previous.pose);
    }
    const velocity = cancel || previous.rotate ? { x: 0, y: 0 } : releaseVelocity(previous.samples, now());
    if (animate) beginReturn(previous.index, velocity);
  };

  const groups = labels.map((label, index) => {
    const group = document.createElement("div");
    group.className = "gem-control";
    group.hidden = true;
    const reset = () => {
      finish();
      springs[index] = null;
      Object.assign(poses[index], resetPoses[index]);
      changed();
    };
    for (const rotate of [false, true]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = rotate ? "gem-rotate" : "gem-move";
      button.textContent = rotate ? "↻" : "";
      button.setAttribute("aria-label", `${rotate ? "Rotate" : "Move"} ${label} gem`);
      button.setAttribute("aria-describedby", help.id);
      button.title = rotate ? "Drag to rotate · Double-click to reset" : "Drag to stretch · Release to spring home · Shift-drag to rotate";
      listen(button, "pointerdown", (event) => {
        const e = event as PointerEvent;
        if (e.button !== 0 || drag) return;
        e.preventDefault();
        button.focus({ preventScroll: true });
        button.setPointerCapture(e.pointerId);
        springs[index] = null;
        drag = { index, id: e.pointerId, button, rotate: rotate || e.shiftKey,
          x: e.clientX, y: e.clientY, scrollY: window.scrollY, pose: { ...poses[index] },
          samples: [{ t: e.timeStamp || now(), x: poses[index].x, y: poses[index].y }] };
        group.dataset.dragging = "true";
      });
      const move = (e: PointerEvent) => {
        if (!drag || drag.id !== e.pointerId || drag.button !== button) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const pose = poses[index];
        if (drag.rotate) {
          pose.rx = drag.pose.rx + dy * 0.012;
          pose.ry = drag.pose.ry + dx * 0.012;
        } else {
          pose.x = drag.pose.x + rubberBand(dx);
          pose.y = drag.pose.y + rubberBand(dy + window.scrollY - drag.scrollY);
        }
        const time = e.timeStamp || now();
        drag.samples.push({ t: time, x: pose.x, y: pose.y });
        drag.samples = drag.samples.filter(s => s.t >= time - VELOCITY_WINDOW_MS).slice(-64);
      };
      listen(button, "pointermove", (event) => {
        const e = event as PointerEvent;
        if (!drag || drag.id !== e.pointerId || drag.button !== button) return;
        const samples = e.getCoalescedEvents?.();
        for (const sample of samples?.length ? samples : [e]) move(sample);
        changed();
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        listen(button, type, (event) => {
          if (drag?.id === (event as PointerEvent).pointerId && drag.button === button) {
            if (type === "pointerup") move(event as PointerEvent);
            finish(type !== "pointerup");
          }
        });
      }
      listen(button, "dblclick", reset);
      listen(button, "keydown", (event) => {
        const e = event as KeyboardEvent;
        let dx = 0;
        let dy = 0;
        switch (e.key) {
          case "Escape":
            finish(true);
            return;
          case "Home":
            e.preventDefault();
            reset();
            return;
          case "ArrowLeft":
            dx = -1;
            break;
          case "ArrowRight":
            dx = 1;
            break;
          case "ArrowUp":
            dy = -1;
            break;
          case "ArrowDown":
            dy = 1;
            break;
          default:
            return;
        }
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        finish();
        const pose = poses[index];
        if (rotate || e.shiftKey) {
          pose.rx += dy * Math.PI / 12;
          pose.ry += dx * Math.PI / 12;
        } else {
          pose.x += dx * 10;
          pose.y += dy * 10;
          beginReturn(index);
        }
        changed();
      });
      group.appendChild(button);
    }
    layer.appendChild(group);
    return group;
  });
  listen(window, "blur", () => finish(true));
  const settle = () => {
    finish(true, false);
    poses.forEach((pose, index) => {
      pose.x = 0;
      pose.y = 0;
      springs[index] = null;
    });
  };
  listen(document, "visibilitychange", () => {
    if (document.hidden) { settle(); changed(); }
  });
  document.body.appendChild(layer);

  return {
    get active() { return drag !== null; },
    get animating() { return springs.some(Boolean); },
    advance(time: number) {
      let advanced = false;
      springs.forEach((spring, index) => {
        if (!spring) return;
        const dt = Math.max(0, (time - spring.time) / 1000);
        spring.x = advanceSpring(spring.x, dt, spring.damping);
        spring.y = advanceSpring(spring.y, dt, spring.damping);
        spring.time = Math.max(spring.time, time);
        const pose = poses[index];
        pose.x = spring.x.position;
        pose.y = spring.y.position;
        if (Math.hypot(pose.x, pose.y) < 0.1 && Math.hypot(spring.x.velocity, spring.y.velocity) < 1) {
          pose.x = 0;
          pose.y = 0;
          springs[index] = null;
        }
        advanced = true;
      });
      return advanced;
    },
    update(index: number, bounds: { left: number; top: number; width: number; height: number } | null) {
      const group = groups[index];
      group.hidden = !bounds;
      if (!bounds) {
        if (drag?.index === index) finish(true);
        return;
      }
      group.style.left = `${bounds.left}px`;
      group.style.top = `${bounds.top}px`;
      group.style.width = `${bounds.width}px`;
      group.style.height = `${bounds.height}px`;
    },
    dispose() {
      settle();
      removers.forEach(remove => remove());
      layer.remove();
    },
  };
}
