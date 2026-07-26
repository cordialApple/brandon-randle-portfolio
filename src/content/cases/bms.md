---
order: 2
title: BMS Analysis
tag: PRESCRIPTIVE ANALYTICS
accent: m
tileTag: Jupyter · pandas · 84-cell pack
tileNum: dead cell called a session early
tileImage: /assets/bms-heatmap.png
tileAlt: Cross-session z-score heatmap
lede: >-
  An 84-cell HV pack throwing noise. I ran per-cell z-scores, rank-stability
  across sessions, and a load-residual IR proxy — and called cell 43 dead a full
  session early. Cells 31 &amp; 67 drove a P0A80 fault that throttled the pack
  198&nbsp;A → 100&nbsp;A.
heroImage: /assets/bms-heatmap.png
heroAlt: Per-cell z-score heatmap
meta:
  - k: Stack
    v: Jupyter · pandas · NumPy
  - k: Role
    v: Analysis, from raw pack telemetry to the call
  - k: Result
    v: Flagged the failing cell before the hardware faulted
delta:
  before:
    v: 84 cells
    label: noisy, all "fine"
    accent: m
  after:
    v: 1 dead cell
    label: called a session early
links:
  - label: repo ↗
    href: https://github.com/cordialApple/tiger-racing-bms-analysis
---
