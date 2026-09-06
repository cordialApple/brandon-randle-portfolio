---
order: 3
title: interview platform
category: backend software
accent: pink
summary: Three related tools for career evidence and interview practice, with explicit storage contracts and coding endpoints between them.
outcome: 19 MCP tools · markdown and SQLite backends
stack: C#/.NET 10 · MCP · SQLite · Electron · React · TypeScript
role: Built Recall-Seed, STARfolio, and Scroll; defined storage and endpoint contracts.
status: Implemented · active personal projects
diagram: platform
links:
  - label: Recall-Seed
    href: https://github.com/cordialApple/Recall-Seed
  - label: STARfolio
    href: https://github.com/cordialApple/STARfolio
  - label: Scroll
    href: https://github.com/cordialApple/Scroll
  - label: example runs
    href: https://github.com/cordialApple/Recall-Seed/blob/main/docs/PROOF.md
---
## the problem

interview practice needs concrete evidence about what someone has done. i wanted career notes, retrieval, and coding exercises to work across tools without coupling every feature to one desktop app.

## distinct responsibilities

**Recall-Seed** is a C#/.NET MCP server. its 19 tools retrieve and store career evidence, check citation identifiers, and seed coding challenges into Scroll. the calling model generates language; the server supplies source material and validation.

**STARfolio** is the Electron desktop surface for career notes and mock interviews. SQLite FTS5 and sqlite-vec support keyword and vector search.

**Scroll** is an implemented editor with sync server and agent-facing endpoints. relative viewport anchoring keeps edits above the visible region from moving the reader’s screen.

## backend decisions

one `IExperienceStore` interface supports markdown-vault and SQLite implementations. tools use that interface rather than knowing how each backend stores notes. the SQLite path uses WAL mode and a stable read/write contract.

coding challenges cross a separate boundary: Recall-Seed provides the problem schema; Scroll hosts the editor and grader, then posts the verdict back with a correlation identifier.

## verification and limits

Recall-Seed CI builds Release, runs xUnit tests, and exercises the stdio protocol from initialization through a tool call. source-linked example runs show how thin evidence produces a gap question.

citation checks verify that referenced identifiers exist. they are not a guarantee that every generated statement is true.

Scroll’s treap has differential property tests against a simpler reference structure. a targeted sweep of **20 hand-built mutants** reached near-total detection; the separate whole-suite mutation run reported **86–95% on covered code**. those measurements assess test sensitivity, not production reliability.
