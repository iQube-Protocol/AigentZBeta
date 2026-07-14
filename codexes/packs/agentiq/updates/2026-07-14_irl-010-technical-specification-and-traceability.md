# IRL-010 Technical Specification v0.1 + IRL-010A Claims Traceability Matrix — authored (implementation witness)

**Date:** 2026-07-14 · **Trigger:** first external technical diligence on the IRL paper set (reviewer: Austin Ambrozi, Autonomi Solutions — falsifiability, methods, implementation detail, and traceability requested) · **Direction:** operator + advisor review adopting Claude Code as *implementation witness* — "do not speculate or describe intended architecture; inspect the current implementation."

## What was produced

1. **`codexes/packs/irl/foundation/IRL-010_constitutional-runtime-technical-specification.md`** — the Constitutional Runtime specified from the code, RFC-style:
   - Part I scientific context, incl. the two category distinctions the reviewer surfaced (descriptive structural vs normative constitutional; QA vs discovery);
   - Part II **formal definitions from the actual stored representations** (`InvariantRecord` quoted verbatim from `types/invariants.ts`; lifecycle, Law XII standing/reach split, 12 edge types, composition laws, InvariantQube weakest-link manifest, receipts, T0/T1/T2 tiers, CapabilityEvidence, consequence classes);
   - Part III runtime architecture — 14 subsystems, each with principal files and status (✅/◐/○);
   - Part IV ten algorithms as pseudocode traceable to source (slice selection, weakest-link aggregation, coherence scoring, composition validation, initialization, evidence commitment + freshness, decision floor, validation fork, canonical publication, T2 commitments);
   - Part V experimental methods **with the previously unstated specifics**: EXP-003's baseline IS the cold arm (same 5 tasks/18-invariant collection/provider/ceiling, provider-reported tokens); EXP-001's adjudication protocol (per-question consistency/correctness/hallucination judge + 0/1/2 contradiction judge over 4 artifacts × 15 questions) — and the honest scoping of every headline number (n=1, internal LLM adjudication);
   - Part VI **falsification framework** — general falsification statement + per-hypothesis (H0–H5) prediction/control/disconfirmation table. The reviewer's "any provider-agnostic prompt scaffold" alternative is *adopted as the H4 control*;
   - Part VII implementation-status inventory incl. what does NOT exist (external replication, variance bands, identity continuity, D2 execution).
2. **`codexes/packs/irl/foundation/IRL-010A_claims-traceability-matrix.md`** — every substantive IRL-000/001/002 claim classified I/D/P/F with code + experiment anchors; ⚑ flags wherever the papers' phrasing outruns current evidence, each with the precise supportable statement; a §4 honest register of claims with no implementation/evidence (incl. "all adjudication internal to date").

Both registered in `codexes/packs/irl/collections.json` (col_foundation, top of the list after the constitutional record).

## Witness notes

- IRL-001 Executive Summary PDF is image-only; its claims were witnessed from the rendered pages (4-page deck) + IRL-000/IRL-002 prose. All three documents' claims are covered in the matrix.
- Everything cited was verified to exist in the repo at witness date (types, services, migrations, experiment configs — e.g. `exp003-tasks.json` 5 tasks/18 seeds, `exp001-config.json` 4 artifacts/15 questions/18 seeds, `publishResult.ts` serialize-once + sha256 + receipt).
- Deliberately NOT included: filed-IP status (operator-held), NDA posture (operator decision), and any reconstruction of run data from memory — per-experiment deep reports should be generated from the canonical `experiment_results` rows, which store the full serialized results.

## Suggested next steps (operator)

- Respond to the reviewer per the advisor's holding pattern; IRL-010 + IRL-010A are the "package under preparation" and are already shareable in draft.
- Priority controls named by the framework: EXP-001 ungrounded arm (H1), EXP-004 scaffold-only arm (H4), EXP-003 multi-run variance — all runnable on existing infrastructure.
- Consider extracting Part VI as standalone IRL-003 (Falsification Framework) for the public paper series, per the advisor's suggestion.
