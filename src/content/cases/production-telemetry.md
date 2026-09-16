---
order: 1
title: Production Telemetry
category: Internship · Data Engineering
accent: blue
summary: MQTT ingestion from an IBM Maximo Visual Inspection system into SQL Server, built and taken through deployment at RoyOMartin.
outcome: Approved scope → production ingestion
stack: C#/.NET · MQTTnet · SQL Server · Databricks · PySpark
role: Built ingestion service and downtime modeling; coordinated security, architecture, and deployment reviews.
status: Production ingestion · Internship work
diagram: production
links:
  - label: Experience on LinkedIn
    href: https://www.linkedin.com/in/brandon-randle-link/
---
## The Problem

An IBM Maximo Visual Inspection system produced machine telemetry. Operations needed that stream in SQL Server to analyze downtime and its dollar cost. Getting there required an ingestion service and agreement across security, architecture, and deployment teams.

## What I Built

C#/.NET worker subscribed to the edge system’s internal MQTT broker over TLS. Retry/reconnect handling and parameterized SQL Server writes supported ingestion; connecting directly removed a planned third-party broker layer.

I drove the pipeline from approved statement of work to production, coordinating the reviews needed to deploy it.

## Turning Alerts into Events

Downtime is an interval problem: individual alerts need to become meaningful fault events. I used window functions and gaps-and-islands logic to resessionize alerts.

In a separate Databricks/PySpark modeling exercise, **32.4 million synthetic alerts became 868 fault events**. Those numbers describe the synthetic workload, not production traffic or customer impact.

## Scope of This Case Study

This account summarizes my internship contribution. Employer source code and internal deployment details are not published here. Production throughput and cost savings are not claimed.
