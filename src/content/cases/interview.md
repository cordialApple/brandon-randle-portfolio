---
order: 4
title: Interview Platform
category: Backend Software
accent: pink
summary: Three related tools for career evidence and interview practice, with explicit storage contracts and coding endpoints between them.
outcome: 19 MCP tools · Markdown and SQLite backends
stack: C#/.NET 10 · MCP · SQLite · Electron · React · TypeScript
role: Built Recall-Seed, STARfolio, and Scroll; defined storage and endpoint contracts.
status: Implemented · Active personal projects
diagram: platform
links:
  - label: Recall-Seed
    href: https://github.com/cordialApple/Recall-Seed
  - label: STARfolio
    href: https://github.com/cordialApple/STARfolio
  - label: Scroll
    href: https://github.com/cordialApple/Scroll
  - label: Example Runs
    href: https://github.com/cordialApple/Recall-Seed/blob/main/docs/PROOF.md
---
## The Problem

Interview practice needs concrete evidence about what someone has done. I wanted career notes, retrieval, and coding exercises to work across tools without coupling every feature to one desktop app.

## Distinct Responsibilities

**Recall-Seed** is a C#/.NET MCP server. Its 19 tools retrieve and store career evidence, check citation identifiers, and seed coding challenges into Scroll. The calling model generates language; the server supplies source material and validation.

**STARfolio** is the Electron desktop surface for career notes and mock interviews. SQLite FTS5 and sqlite-vec support keyword and vector search.

**Scroll** is an implemented editor with sync server and agent-facing endpoints. Relative viewport anchoring keeps edits above the visible region from moving the reader’s screen.

## Backend Decisions

One `IExperienceStore` interface supports Markdown-vault and SQLite implementations. Tools use that interface rather than knowing how each backend stores notes. The SQLite path uses WAL mode and a stable read/write contract.

Coding challenges cross a separate boundary: Recall-Seed provides the problem schema; Scroll hosts the editor and grader, then posts the verdict back with a correlation identifier.

## Verification and Limits

Recall-Seed CI builds Release, runs xUnit tests, and exercises the stdio protocol from initialization through a tool call. Source-linked example runs show how thin evidence produces a gap question.

Citation checks verify that referenced identifiers exist. They are not a guarantee that every generated statement is true.

Scroll’s treap has differential property tests against a simpler reference structure. A targeted sweep of **20 hand-built mutants** reached near-total detection; the separate whole-suite mutation run reported **86–95% on covered code**. Those measurements assess test sensitivity, not production reliability.
