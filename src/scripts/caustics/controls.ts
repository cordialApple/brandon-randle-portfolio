export interface GemPose {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export const initialGemPose = (): GemPose => ({ x: 0, y: 0, rx: 0, ry: 0 });

export function createGemControls(labels: string[], poses: GemPose[], changed: () => void) {
  const layer = document.createElement("div");
  layer.className = "gem-interactions";
  const help = document.createElement("p");
  help.id = "gem-controls-help";
  help.className = "sr-only";
  help.textContent = "Drag to move. Drag rotation handle or Shift-drag to rotate. Arrow keys move; Shift plus arrows rotate. Home or double-click resets. Escape cancels drag.";
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
  } | null = null;

  const finish = (cancel = false) => {
    if (!drag) return;
    const previous = drag;
    drag = null;
    groups[previous.index].dataset.dragging = "false";
    if (previous.button.hasPointerCapture(previous.id)) {
      previous.button.releasePointerCapture(previous.id);
    }
    if (cancel) {
      Object.assign(poses[previous.index], previous.pose);
      changed();
    }
  };

  const groups = labels.map((label, index) => {
    const group = document.createElement("div");
    group.className = "gem-control";
    group.hidden = true;
    const reset = () => {
      finish();
      Object.assign(poses[index], initialGemPose());
      changed();
    };
    for (const rotate of [false, true]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = rotate ? "gem-rotate" : "gem-move";
      button.textContent = rotate ? "↻" : "";
      button.setAttribute("aria-label", `${rotate ? "Rotate" : "Move"} ${label} gem`);
      button.setAttribute("aria-describedby", help.id);
      button.title = rotate ? "Drag to rotate · Double-click to reset" : "Drag to move · Shift-drag to rotate · Double-click to reset";
      listen(button, "pointerdown", (event) => {
        const e = event as PointerEvent;
        if (e.button !== 0 || drag) return;
        e.preventDefault();
        button.focus({ preventScroll: true });
        button.setPointerCapture(e.pointerId);
        drag = { index, id: e.pointerId, button, rotate: rotate || e.shiftKey,
          x: e.clientX, y: e.clientY, scrollY: window.scrollY, pose: { ...poses[index] } };
        group.dataset.dragging = "true";
      });
      listen(button, "pointermove", (event) => {
        const e = event as PointerEvent;
        if (!drag || drag.id !== e.pointerId || drag.button !== button) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        const pose = poses[index];
        if (drag.rotate) {
          pose.rx = drag.pose.rx + dy * 0.012;
          pose.ry = drag.pose.ry + dx * 0.012;
        } else {
          pose.x = drag.pose.x + dx;
          pose.y = drag.pose.y + dy + window.scrollY - drag.scrollY;
        }
        changed();
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
        listen(button, type, (event) => {
          if (drag?.id === (event as PointerEvent).pointerId && drag.button === button) {
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
        }
        changed();
      });
      group.appendChild(button);
    }
    layer.appendChild(group);
    return group;
  });
  listen(window, "blur", () => finish(true));
  listen(document, "visibilitychange", () => { if (document.hidden) finish(true); });
  document.body.appendChild(layer);

  return {
    get active() { return drag !== null; },
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
      finish();
      removers.forEach(remove => remove());
      layer.remove();
    },
  };
}
