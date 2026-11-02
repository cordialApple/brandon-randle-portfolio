export interface SpringState {
  position: number;
  velocity: number;
}

export interface MotionSample {
  t: number;
  x: number;
  y: number;
}

export const VELOCITY_WINDOW_MS = 80;

export function rubberBand(distance: number, limit = 240) {
  return distance / (1 + Math.abs(distance) / limit);
}

export function advanceSpring(state: SpringState, seconds: number, damping: number, response = 0.42): SpringState {
  const omega = 2 * Math.PI / response;
  const t = Math.max(0, seconds);
  if (damping >= 1) {
    const decay = Math.exp(-omega * t);
    const c = state.velocity + omega * state.position;
    return {
      position: (state.position + c * t) * decay,
      velocity: (state.velocity - omega * c * t) * decay,
    };
  }
  const a = damping * omega;
  const b = omega * Math.sqrt(1 - damping * damping);
  const c = (state.velocity + a * state.position) / b;
  const decay = Math.exp(-a * t);
  const cosine = Math.cos(b * t);
  const sine = Math.sin(b * t);
  return {
    position: decay * (state.position * cosine + c * sine),
    velocity: decay * (state.velocity * cosine - (a * c + b * state.position) * sine),
  };
}

export function releaseVelocity(samples: MotionSample[], now: number) {
  const recent = samples.filter(s => s.t >= now - VELOCITY_WINDOW_MS && s.t <= now);
  if (recent.length < 2) return { x: 0, y: 0 };
  const mean = { t: 0, x: 0, y: 0 };
  for (const sample of recent) {
    mean.t += sample.t;
    mean.x += sample.x;
    mean.y += sample.y;
  }
  mean.t /= recent.length;
  mean.x /= recent.length;
  mean.y /= recent.length;
  let variance = 0;
  let x = 0;
  let y = 0;
  for (const sample of recent) {
    const dt = sample.t - mean.t;
    variance += dt * dt;
    x += dt * (sample.x - mean.x);
    y += dt * (sample.y - mean.y);
  }
  return variance < 1 ? { x: 0, y: 0 } : { x: x / variance * 1000, y: y / variance * 1000 };
}
