---
order: 1
title: production telemetry
category: internship · data engineering
accent: blue
summary: MQTT ingestion from an edge computer-vision inspection system into SQL Server, built and taken through deployment at RoyOMartin.
outcome: approved scope → production ingestion
stack: C#/.NET · MQTTnet · SQL Server · Databricks · PySpark
role: Built ingestion service and downtime modeling; coordinated security, architecture, and deployment reviews.
status: Production ingestion · internship work
diagram: production
links:
  - label: experience on LinkedIn
    href: https://www.linkedin.com/in/brandon-randle-link/
---
## the problem

an edge inspection system produced machine telemetry. operations needed that stream in SQL Server to analyze downtime and its dollar cost. getting there required an ingestion service and agreement across security, architecture, and deployment teams.

## what i built

C#/.NET worker subscribed to the edge system’s internal MQTT broker over TLS. retry/reconnect handling and parameterized SQL Server writes supported ingestion; connecting directly removed a planned third-party broker layer.

i drove the pipeline from approved statement of work to production, coordinating the reviews needed to deploy it.

## turning alerts into events

downtime is an interval problem: individual alerts need to become meaningful fault events. i used window functions and gaps-and-islands logic to resessionize alerts.

in a separate Databricks/PySpark modeling exercise, **32.4 million synthetic alerts became 868 fault events**. those numbers describe the synthetic workload, not production traffic or customer impact.

## scope of this case study

this account summarizes my internship contribution. employer source code and internal deployment details are not published here. production throughput and cost savings are not claimed.
