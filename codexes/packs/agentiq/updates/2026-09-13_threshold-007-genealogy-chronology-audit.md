# Threshold 007 — Genealogy Chronology Audit (Closed)

**Date:** 2026-09-13
**Status:** Closed. No further searching for the OpenClaw PRD; that item is unresolved and
non-load-bearing by operator instruction.

## Purpose

The operator proposed a candidate genealogy for the research programme — Experience Vibing → Dev
Vibing → Consequence Engineering/OpenClaw → media coherence discovery → structural/constitutional
invariance separation → P1–P4 → finance as candidate domain → Vela/MoneyPenny/Golden Cycle
convergence → vertical integration — and asked for it to be tested against primary git history rather
than accepted as narrated. This required first discovering that the working checkout was a **shallow
clone** (227 commits from 2026-05-22) and running `git fetch --unshallow` to recover the full
9,441-commit history back to 2024-12-24.

## Resolved dates (verified against primary commits, not retrospective prose)

| Event | Date | Commit | Note |
|---|---|---|---|
| OpenClaw named (forward-looking only) | 2026-02-24 | `1dcdd941` | "Future phase will extend this control plane to OpenClaw..." — aspirational, not built |
| OpenClaw wrapper implemented | 2026-02-27 | `68251f68` | Real code (`mcpInvoker.ts`, `artifactStore.ts`) — a generic MCP tool-invocation wrapper, **no risk/consequence-assessment logic found** |
| "Experience Vibing" first named | 2026-04-27 | `5754b4ff` | UI explainer text; no distinct "became operational" commit located |
| Media/coherence experiments (EXP-001/002/003) authored | **2026-07-03** | `dfbd730f` | Corrects an earlier "unresolved" finding — traced via `git log --follow` through a later CCRL→IRL rename that obscured the true origin |
| EXP-003 results published | 2026-07-04 | (results json) | |
| EXP-002 results backfilled into canonical record | 2026-07-06 | "Add Report tab + backfill historical runs" | |
| Consequence Engineering grounded in doctrine | 2026-07-04 | `82bd64b2` | CFS-006a §7, "Ground consequence engineering in Law XV" |
| CS-001 case study | 2026-07-13 | (per its own header) | Same window as the CCRL→IRL platform rename |
| Structural/Constitutional Invariance formally separated | 2026-07-16 | `519730ff` | Same commit also ratifies CFS-036 "Three Computational Compressions" — these are one event, not two sequential stages |
| EXP-P1/P2/P3 chartered | **2026-07-18** | `afdd507e` | Domain slate in the charter itself: D1 Consequence Engineering, D3 Software Engineering, **D4 Finance**, D5 Legal/Scientific — Consequence Engineering explicitly prioritized as "the strongest first demo," finance present but deprioritized |
| Golden Cycle / Vela pilot first appears | **2026-09-09** | `768035a7` | ~7-8 weeks after the P1–P4 charter |
| Vela/MoneyPenny baseline confirmed | 2026-09-10/12 | — | |

## What this corrects in the operator's remembered sequence

1. Finance was **not** absent from P1–P4 at charter and later proposed by Austin — it was in the
   domain slate (D4) in the same commit that chartered the programme, just deprioritized behind
   Consequence Engineering as the recommended first demonstration.
2. Structural and Constitutional Invariance were **not** separated as two sequential stages — they
   are the same commit (2026-07-16).
3. OpenClaw's February 2026 implementation performed **no** consequence or risk assessment; if it
   later gained that capability, no dated evidence for it exists in this repository, and no PRD
   documenting the intended constraint was found after a real search (filenames, all PRD-* content in
   `codexes/packs/irl/foundation/` and `codexes/packs/agentiq/items/`, and the three real ClawHack
   docs). **Closed as unresolved, non-load-bearing, per operator instruction — not searched further.**

## What this confirms

The single load-bearing claim — **finance became the primary consolidated domain only in September
2026, roughly two months after the P1–P4 charter, as a metrology/convergence environment rather than
the programme's origin** — holds up strongly under dated primary evidence.

## Disposition

Closed. The six preserved distinctions from this audit are carried into the manuscript's own
"Genealogy Reconciliation Addendum" section (`docs/qriptopian/thresholds/007-research-edition.md`).
This document is the working-notes record; the addendum is the load-bearing, manuscript-facing
statement. No further heritage or genealogy searching is planned unless separately requested.
