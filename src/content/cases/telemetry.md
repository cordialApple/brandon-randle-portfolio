---
order: 2
title: race telemetry pipeline
category: data engineering
accent: blue
summary: Two Formula SAE cars, different logger formats, one pipeline from raw CSV exports to a TimescaleDB warehouse, typed API, and Power BI dashboards.
outcome: repeatable ingestion across two car platforms
stack: Python · TimescaleDB · FastAPI · Power BI · GitHub Actions
role: Designed and built parsing, ingestion, database model, API, dashboards, and validation.
status: Implemented · historical 2023 and 2026 datasets
image:
  src: /assets/telemetry.png
  alt: Power BI overview of 18 sessions from the 2023 Formula SAE combustion car
  caption: 2023 example — 18 sessions from one evening at UTA Autocross; not a full season of track events.
secondaryImage:
  src: /assets/telemetry-findings.png
  alt: Historical oil pressure, lateral grip, coolant temperature, and channel-health dashboard
  caption: 2023 diagnostic views. Findings describe recorded data; they do not establish that engine damage was prevented.
links:
  - label: source code
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline
  - label: findings & dashboards
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline/tree/main/reports
  - label: tests & CI
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline/actions/workflows/tests.yml
---
## the problem

the 2023 combustion car used an AiM logger; the 2026 electric car used CAN exports with a different channel set. raw files needed a consistent path into analysis without treating the two cars as identical.

current corpus covers **18 sessions from October 7, 2023**, and **26 files from the July 18, 2026 drive day**. file count and session count are different units.

## engineering decisions

- **safe reruns.** content hashes identify previously ingested files. source-path attribution preserves where duplicate files came from.
- **isolated failures.** a malformed file fails independently so remaining sessions can load.
- **one serving contract.** a TimescaleDB hypertable and 1 Hz aggregate feed typed FastAPI responses. Power BI contract tests check requested columns against response models.
- **different cars, explicit identity.** platform and event fields distinguish datasets; sensor specifications stay specific to each car.

## verification

CI runs lint, database-free checks, and the full suite against a pinned TimescaleDB service. a preflight assertion prevents database tests from silently skipping. database tests use a separate test database.

committed data profiles capture channel sets, sample spacing, duplicate groups, and extremes. CI compares fresh profiles with those baselines to catch changes in incoming data.

## what the data showed

historical 2023 analysis surfaced oil-pressure dips under cornering, cooling limits, and dead channels. 2026 analysis surfaced low coolant flow, inverter overcurrent trips, and a channel labeled `Pack_SOC` that represented temperature. these findings show why validation matters before dashboard interpretation.
