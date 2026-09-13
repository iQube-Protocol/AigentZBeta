# Threshold 007 — Factual Corrections Handoff for ARR Amendment

**Date:** 2026-09-13
**Prepared by:** Evidence Agent role (this session)
**For:** an independent reviewer session with no authoring context on this paper, to amend the
existing ARR record — not for self-certification by this session.
**Manuscript state at handoff:** `docs/qriptopian/thresholds/007-research-edition.md` on `dev`,
Supabase `content_publication_gates` row: `gate_status = arr_pending`, `evidence_resolved = true`,
`no_evidence_regression = true`, `arr_disposition = null`.

## Purpose

The operator's independent Adversary reviewer previously found several factual gaps in an earlier
manuscript state. Some of those findings are now stale relative to evidence this Evidence Agent role
has since verified. This document lists the specific factual corrections that should inform an
amendment to the ARR record — it does not itself amend the ARR, set a disposition, or advance the
publication gate.

## Corrections proposed, with verification status

### 1. "Zero experiments in this programme have produced a result of any kind" — **factually corrected, verified**

This is false as a blanket statement. **EXP-001 (Living KnowledgeQube), EXP-002 (invariant video), and
EXP-003 (rediscovery savings)** were authored 2026-07-03 (`dfbd730f`) and produced published evaluation
results 2026-07-04 through 2026-07-06 (`codexes/packs/irl/foundation/experiments/exp-001-living-knowledgeqube/evaluation-results-2026-07-04.json`,
`exp-002-invariant-video/run2-results-2026-07-05.json`, `exp-003-rediscovery-savings/results-2026-07-04.json`).
Verified directly against these artifacts and their commit history, not from retrospective prose.

**Correct characterization:** these remain **foundational/preliminary experiments — not validation of
H1b or H4.** They predate and are narrower in scope than the P1–P4 series that superseded them.

### 2. EXP-P1 execution state — **NOT independently verified; flagging a discrepancy rather than confirming**

The operator describes "multiple pre-ratification executions" of EXP-P1. **This Evidence Agent role
has not verified that claim.** What was verified directly: EXP-P1's own README
(`codexes/packs/irl/foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md`) contains
an unchecked checklist item — `[ ] Runs executed; results published hash-consistent with the bundle`
— as of the commit inspected. If run artifacts exist elsewhere (a different branch, an external
environment, or files not yet located in this repository) that verify pre-ratification executions,
those artifacts should be independently located and cited before this correction is made. **Do not
correct P1's execution state on the operator's recollection alone** — verify against the actual run
artifacts first, the same discipline applied to every other claim in this reconciliation.

If verified, the correct characterization is: **instrument/protocol-validation executions, explicitly
excluded from thesis-confirming scientific evidence pending independent protocol/Crystal review** —
never scientific confirmation of H1a/H1b.

### 3. Domain history — **factually corrected, verified**

P1–P3 were cross-domain from inception, not later broadened. The charter commit itself
(`afdd507e`, 2026-07-18) lists candidate demo domains: D1 Consequence Engineering, D3 Software
Engineering, **D4 Finance**, D5 Legal/Scientific reasoning — with Consequence Engineering explicitly
argued as "the strongest first demo." Finance was present in the domain slate the same day the
programme was chartered, not proposed later by Austin as a new addition; it was **deprioritized**, not
absent. Law/Legal reasoning was also present (D5) and should not be dropped from the record.

The September Vela/MoneyPenny/Golden Cycle work (`768035a7`, 2026-09-09 onward) is a **financial-
services consolidation/metrology environment** — roughly two months after the July 18 charter — not
the introduction of finance to the programme.

### 4. "Pre-experimental" language — **factually corrected, verified**

Given correction 1, "pre-experimental" is inaccurate. Proposed replacement language (consistent with
what this Evidence Agent role can actually support):

> Invariant Intelligence is empirically nascent but not pre-experimental. Foundational experiments
> have been executed and published, and subsequent protocol-validation runs have exercised parts of
> the formal research apparatus. The core frontier-extension, cross-domain-transfer and cybernetic-
> compounding hypotheses remain scientifically unvalidated.

## What this handoff does NOT do

- It does not amend the ARR record itself.
- It does not set `arr_disposition`.
- It does not advance `gate_status` beyond `arr_pending`.
- It does not resolve item 2 (EXP-P1 execution state) — that requires independent verification against
  actual run artifacts, not operator recollection or Evidence Agent assumption.
- It does not touch the B/C evidentiary-maturity judgment, the title, or the abstract — those are
  editorial/adversarial judgments for the independent reviewer to make or preserve, not evidence-agent
  corrections.

## Manuscript state this handoff corresponds to

The manuscript already reflects corrections 1, 3, and 4 in substance (see its own "Genealogy
Reconciliation Addendum" and Implementation-Evidence Register entries for EXP-001/002/003, the P1–P3
domain slate, and the OpenClaw/myGuard reclassification). Correction 2 is deliberately left open here
for the independent reviewer to resolve, rather than asserted.
