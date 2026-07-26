---
order: 3
title: Peekbar
tag: SYSTEMS OPTIMIZATION
accent: p
tileTag: C++23 · Win32 · ETW
tileNum: 539 → 95 ms · 5.7×
tileImage: /assets/peekbar-dash.png
tileAlt: ETW profiler dashboard
lede: >-
  Tab activation was walking the whole UIA tree on the hot path. I replaced it
  with a ring-hop planner and built my own ETW profiler to prove the win —
  <em>539&nbsp;ms → 95&nbsp;ms, 5.7×</em>, keystroke-hop latency 137&nbsp;→&nbsp;20&nbsp;ms,
  0% fail over the measured window.
heroImage: /assets/peekbar-dash.png
heroAlt: ETW ring-hop profiler dashboard
meta:
  - k: Stack
    v: C++23 · Win32 · ETW
  - k: Role
    v: Profiled, re-architected the hot path, measured it
  - k: Result
    v: 5.7× faster activation, 0% failures
delta:
  before:
    v: 539 ms
    label: UIA tree-walk baseline
  after:
    v: 95 ms
    label: ring-hop planner · 5.7×
    accent: p
links:
  - label: repo ↗
    href: "#"
  - label: demo ↗
    href: "#"
---
