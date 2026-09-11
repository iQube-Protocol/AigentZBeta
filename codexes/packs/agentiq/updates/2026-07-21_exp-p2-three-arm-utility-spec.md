# EXP-P2 — Financial-Services utility experiment (three-arm spec)

**Date:** 2026-07-21 · **Status: SPECIFICATION — do NOT run yet** (Aletheon 2026-07-21)

Tests whether the discovery methodology produces a **better reasoning substrate**
than both no curation and expert/manual curation — and, via ablation, whether a
proposed root is **causally load-bearing** rather than merely recurrent.

## Arms (fixed model, tasks, token ceiling, judge across all three)
1. **Cold** — no invariant substrate (task alone).
2. **Manual baseline** — the original five Financial-Services invariants (the
   hand-authored CRP-003 set).
3. **Earned substrate** — the recursively-compressed invariants produced from
   sub-domain recurrence (Compare → recursive-compression roots + derived,
   promoted to `proposed`).

The shipped `services/experiments/expP2Utility.ts` implements arms 1 & 3 (`cold`,
`discovered`) with a blind judge. This spec adds **arm 2 (manual)** and the full
metric + ablation apparatus. Keep the blind judge (no arm label, no library
shown) so no arm is rewarded for restatement.

## Metrics (per arm, per task; aggregated + per sub-domain)
- **grounded claim share** — fraction of substantive claims entailed by / grounded
  in a supplied invariant (arms 2 & 3) or, for cold, in the domain corpus.
- **contradictions** — claims that conflict with a supplied invariant.
- **reasoning tokens** — output tokens spent to reach the answer.
- **regulatory coverage** — fraction of the task's required governing principles
  the answer actually addresses (rubric-scored).
- **unsupported conclusions** — asserted conclusions with no grounding.
- **invariant citations** — distinct invariants cited (arms 2 & 3).
- **failure by sub-domain** — where each arm degrades (payments / trading /
  banking / custody / cross-border), so gains/losses are localised.
- **minimum sufficient set (K\*)** — via ablation (below).

## Ablation — the most important addition
Once the earned root set exists, **remove one root at a time** and re-run the
task battery. Observe which **task classes degrade** when a given root is absent.
A root whose removal degrades a task class is **causally load-bearing**; a root
whose removal changes nothing is merely recurrent and a candidate for demotion.
This reuses the pre-registered **EXP-P2 B2 (minimal sufficiency / K\*) + B3
(ablation)** design over `buildInvariantSlice({ domains:['financial-services'],
statuses:['proposed'] })`.

## Fixed conditions (pre-register before running)
- One model + one judge model, pinned; temperature 0; identical token ceiling
  per arm; identical task set + rubrics; identical run count per (arm, task).
- Arms differ ONLY in the invariant substrate supplied.
- Publish results content-hashed + DVN-anchored like the other experiments; the
  three-arm comparison + ablation table is the deliverable.

## Why three arms, not two
"Emergent vs manual" alone can't separate *curation helps* from *this curation
helps*. Cold isolates the substrate's marginal value; manual isolates whether the
DISCOVERY method beats expert hand-authoring; ablation isolates which specific
roots carry the load. Together they make the topology **experimentally meaningful
rather than merely visually elegant.**

## Build order (when ratified to run)
1. Add arm 2 (manual baseline library) to `expP2Utility.ts` + config the original
   five FS invariants as a fixed baseline set.
2. Add the metric extractors (grounded-claim / contradiction / citation counters
   reuse the EXP-003 judge pattern; coverage + unsupported reuse the rubric judge).
3. Add the ablation runner (drop-one-root sweep) over the earned root set.
4. Runner UI (replace the vp2 design-stage panel) + publication.
