# EXP-006 instrument calibration — comparator baselines + graded scorer

**Date:** 2026-07-20 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha`

Two additions turn the EXP-006 first run from a bare number into an interpretable, self-diagnosing measurement — both from the Aletheon review of the first live run (F1 0.284).

## 1. Comparator arms — "43% compared to what?"
`services/experiments/exp006Baselines.ts` + opt-in `{ baselines: true }` on the route. Each arm predicts exactly k=|reference| labels from the shared field vocabulary (no arm sees the per-intent answer), scored against the SAME CIRS: **random** (seeded chance floor), **keyword** (lexical), **semantic** (embedding cosine; degrades to unavailable with no provider). First run: sovereign F1 0.284 clears random (0.151) and keyword (0.154) but not semantic (0.431) — a legitimate, non-confirmatory result. Human baseline is a separate annotation pass (not run).

## 2. Graded scorer — the exact-match evaluator was miscalibrated
The Stage-A scorer matches EXACT normalised labels, so morphological / separator variants scored ZERO overlap AND were double-counted as **both** a missing AND a redundant delta:
`accessibility`/`accessible` · `data collection`/`data_collection` · `root cause`/`root_cause` · `transparency`/`transparent` · `engaging`/`engagement`. That understated the sovereign arm — a measurement defect, not a projection failure (Aletheon).

`services/experiments/gradedProjectionScore.ts` reports the run at rising tolerance:
- **exact** — the raw Stage-A baseline, unchanged and never overwritten (the published record stands).
- **normalized** — separator folding + light morphological stemming; the variants above fold, so they stop being double-counted.
Genuine (still-unmatched-after-normalization) missing/redundant deltas are preserved. `graded` rides alongside `aggregate` in the route response and renders as an exact-vs-normalized table in the runner + saved/copied payload.

**Deferred (documented):**
- **Semantic-equivalence tier** (embedding cosine) + **subsumption tier** — a higher-order invariant subsuming several operational refinements (`security` ⊇ secure-access + token-validation + audit-logging; `delegation` ⊇ scope-limitation + consent + revocation). Subsumption needs the CIRS reference encoded as a hierarchy (it is flat today) — this connects directly to the CFS-048 Phase 1a domain→sub-domain ladder: the sovereign arm projects domain-level invariants while the reference lists sub-domain refinements. That is projection *depth*, a first-class EXP-006 research variable, not a bug.
- This run is retained as the raw Stage-A baseline; the graded/semantic pass is a corrected reading beside it, never an overwrite.

## Files
- New: `services/experiments/exp006Baselines.ts`, `services/experiments/gradedProjectionScore.ts`, canaries `tests/exp006-baselines.test.ts`, `tests/graded-projection-score.test.ts`.
- Modified: `app/api/experiments/irl-exp001/route.ts` (opt-in baselines + always-on graded), `components/composer/Exp006ProjectionRunner.tsx` (comparison table, graded table, save+copy footer).
