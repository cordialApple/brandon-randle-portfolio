---
order: 4
title: Peekbar
category: systems performance
accent: purple
summary: Native Windows tool that keeps minimized browser tabs visible in the taskbar gap, with a measured rewrite of the tab-activation path.
outcome: median activation 539 ms → 95 ms
stack: C++23 · Win32 · UI Automation · ETW
role: Built shell tool and profiler; traced latency, redesigned activation, and measured the change.
status: Working Windows 11 release
image:
  src: /assets/peekbar-dash.png
  alt: ETW dashboard showing 95 ms median tab activation and 5.7 times speedup
  caption: Ring-hop benchmark — 24-tab window, 66 clicks, zero observed failures. Values describe this measured sample.
links:
  - label: source & demo
    href: https://github.com/cordialApple/Peekbar
  - label: performance evidence
    href: https://github.com/cordialApple/Peekbar/tree/main/docs/dashboard
  - label: Windows release
    href: https://github.com/cordialApple/Peekbar/releases/latest
---
## the problem

minimizing a browser hides the tabs inside it. Peekbar leaves a glanceable set of tab chips in unused taskbar space, so a user can find and restore the tab they need.

## finding the bottleneck

tab activation felt slow. i built a separate ETW profiler and dashboard, then traced the dominant cost to a UI Automation tree walk on the activation path.

## changing the path

a ring-hop planner computes the shortest keyboard sequence to the target tab and sends it through one batched `SendInput`. activation skips the UI Automation walk; UI Automation still supplies tab information elsewhere.

median activation dropped from **539 ms to approximately 95 ms**, a **5.7× speedup**. the injection step dropped from roughly 137 ms to 20 ms.

## measurement scope

the displayed ring-hop capture used a 24-tab window and recorded 66 clicks with no observed failures. it demonstrates the improvement on that workload, not a universal latency guarantee. repository keeps earlier profiling runs and the separate profiler for inspection.
