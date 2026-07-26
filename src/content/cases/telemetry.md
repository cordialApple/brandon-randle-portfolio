---
order: 1
title: Race Telemetry
tag: SYSTEMS · DATA ENGINEERING
accent: b
tileTag: Python · TimescaleDB · Power BI
tileNum: 18 sessions → queryable
tileImage: /assets/telemetry.png
tileAlt: Power BI season overview
lede: >-
  One night at UTA autocross, 18 sessions of raw CAN logs. I built the whole
  path: content-hash idempotent ingest with per-file error isolation, a
  1&nbsp;Hz continuous aggregate on a TimescaleDB hypertable, a star schema,
  typed FastAPI serving, and CI that runs against a real database.
heroImage: /assets/telemetry.png
heroAlt: Power BI season overview dashboard
finding:
  title: ⌐ what the aggregate caught — oil starvation
  body: >-
    At 8k+ RPM under peak lateral G, minimum oil pressure fell to
    <strong>0.00 bar</strong> — <strong>187 s</strong> of oil dip across the
    night, and coolant kept climbing past 100 °C (112 s over the line). The
    1 Hz aggregate made the starvation obvious session-over-session — before it
    turned into engine damage.
media2:
  image: /assets/telemetry-findings.png
  alt: Oil pressure vs grip, coolant-over-time, and channel-health findings
meta:
  - k: Stack
    v: Python · TimescaleDB · FastAPI · Power BI
  - k: Role
    v: Designed & built the pipeline end to end
  - k: Result
    v: Aggregate exposed oil starvation, cooling limits & dead channels
delta:
  before:
    v: 18 sessions
    label: raw CAN logs, one night
    accent: b
  after:
    v: 1 queryable layer
    label: decision-ready, CI-guarded
links:
  - label: repo ↗
    href: https://github.com/cordialApple/tiger-racing-telemetry-pipeline
---
