---
order: 3
title: Battery Diagnostics
category: Applied Data Analysis
accent: mint
summary: Repeatable analysis of an 84-cell Formula SAE battery pack, separating persistent cell anomalies from session-specific noise.
outcome: Named cell outliers across sessions
stack: Python · pandas · NumPy · Jupyter
role: Built shared loading and diagnostic functions, session notebooks, and cross-session comparisons.
status: Completed analysis · March 2026 logs
image:
  src: /assets/bms-heatmap.png
  alt: Cross-session heatmap of standardized cell voltages in an 84-cell battery pack
  caption: Per-cell z-scores across healthy sessions. Fault session excluded from trend comparison so extreme failure does not flatten other signals.
links:
  - label: Source & Notebooks
    href: https://github.com/cordialApple/tiger-racing-bms-analysis
---
## The Problem

One unusual reading cannot tell you whether a battery cell is weak. I compared voltage behavior across sessions to identify persistent outliers, with shared loading and diagnostic functions keeping notebooks consistent.

## Method

Per-cell z-scores, rank stability, and loaded-voltage residuals gave different views of pack behavior. The March 11 fault session was excluded from trend metrics: a failed cell’s extreme value would otherwise compress differences among remaining cells.

## Findings

Cell 43 was a high-side voltage outlier on March 3, then fell to approximately zero volts on March 11. The earlier recording contained a warning signature one session before collapse.

Cells 31 and 67 were persistent outliers associated with the P0A80 weak-cell fault. Recorded discharge-current limit fell from **198 A to 100 A**.

These are findings from recorded logs. This case does not claim a deployed predictive model or that analysis prevented the failure.
