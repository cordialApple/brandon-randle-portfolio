---
order: 5
title: battery diagnostics
category: applied data analysis
accent: mint
summary: Repeatable analysis of an 84-cell Formula SAE battery pack, separating persistent cell anomalies from session-specific noise.
outcome: named cell outliers across sessions
stack: Python · pandas · NumPy · Jupyter
role: Built shared loading and diagnostic functions, session notebooks, and cross-session comparisons.
status: Completed analysis · March 2026 logs
image:
  src: /assets/bms-heatmap.png
  alt: Cross-session heatmap of standardized cell voltages in an 84-cell battery pack
  caption: Per-cell z-scores across healthy sessions. Fault session excluded from trend comparison so extreme failure does not flatten other signals.
links:
  - label: source & notebooks
    href: https://github.com/cordialApple/tiger-racing-bms-analysis
---
## the problem

one unusual reading cannot tell you whether a battery cell is weak. i compared voltage behavior across sessions to identify persistent outliers, with shared loading and diagnostic functions keeping notebooks consistent.

## method

per-cell z-scores, rank stability, and loaded-voltage residuals gave different views of pack behavior. the March 11 fault session was excluded from trend metrics: a failed cell’s extreme value would otherwise compress differences among remaining cells.

## findings

cell 43 was a high-side voltage outlier on March 3, then fell to approximately zero volts on March 11. the earlier recording contained a warning signature one session before collapse.

cells 31 and 67 were persistent outliers associated with the P0A80 weak-cell fault. recorded discharge-current limit fell from **198 A to 100 A**.

these are findings from recorded logs. this case does not claim a deployed predictive model or that analysis prevented the failure.
