---
order: 5
title: Race Telemetry Pipeline
category: Data Engineering
accent: blue
summary: Two Formula SAE cars, different logger formats, one pipeline from raw CSV exports to a TimescaleDB warehouse, typed API, and Power BI dashboards.
outcome: Repeatable ingestion across two car platforms
stack: Python · TimescaleDB · FastAPI · Power BI · GitHub Actions
role: Designed and built parsing, ingestion, database model, API, dashboards, and validation.
status: Implemented · Historical 2023 and 2026 datasets
image:
  src: /assets/telemetry.png
  alt: Power BI overview of 18 sessions from the 2023 Formula SAE combustion car
  caption: 2023 example — 18 sessions from one evening at UTA Autocross; not a full season of track events.
secondaryImage:
  src: /assets/telemetry-findings.png
  alt: Historical oil pressure, lateral grip, coolant temperature, and channel-health dashboard
  caption: 2023 diagnostic views. Findings describe recorded data; they do not establish that engine damage was prevented.
links:
  - label: Source Code
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline
  - label: Findings & Dashboards
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline/tree/main/reports
  - label: Tests & CI
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline/actions/workflows/tests.yml
---
## The Problem

The 2023 combustion car used an AiM logger; the 2026 electric car used CAN exports with a different channel set. Raw files needed a consistent path into analysis without treating the two cars as identical.

Current corpus covers **18 sessions from October 7, 2023**, and **26 files from the July 18, 2026 drive day**. File count and session count are different units.

## Engineering Decisions

- **Safe Reruns.** Content hashes identify previously ingested files. Source-path attribution preserves where duplicate files came from.
- **Isolated Failures.** A malformed file fails independently so remaining sessions can load.
- **One Serving Contract.** A TimescaleDB hypertable and 1 Hz aggregate feed typed FastAPI responses. Power BI contract tests check requested columns against response models.
- **Different Cars, Explicit Identity.** Platform and event fields distinguish datasets; sensor specifications stay specific to each car.

## Verification

CI runs lint, database-free checks, and the full suite against a pinned TimescaleDB service. A preflight assertion prevents database tests from silently skipping. Database tests use a separate test database.

Committed data profiles capture channel sets, sample spacing, duplicate groups, and extremes. CI compares fresh profiles with those baselines to catch changes in incoming data.

## What the Data Showed

Historical 2023 analysis surfaced oil-pressure dips under cornering, cooling limits, and dead channels. 2026 analysis surfaced low coolant flow, inverter overcurrent trips, and a channel labeled `Pack_SOC` that represented temperature. These findings show why validation matters before dashboard interpretation.
