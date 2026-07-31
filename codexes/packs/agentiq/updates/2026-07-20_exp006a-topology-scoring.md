# EXP-006A — topology / abstraction-aware projection scoring (graph-truth subsumption)

**Date:** 2026-07-20 · **Branch:** `claude/agentiq-onboarding-docs-jrbeha`

EXP-006's exact-set metric plateaued because the sovereign router projects invariants *one abstraction level higher* than the flat CIRS reference (router `{authentication, delegation, security}` subsumes reference `{token-validation, scope-limitation, secure-access, …}` → F1 0.0, which is an abstraction mismatch, not a failure). EXP-006A scores **causal** agreement instead of lexical, and — per the operator — points its subsumption oracle at the **`specializes` graph as ground truth**.

## What it does
`services/experiments/topologyProjectionScore.ts` — a pure classifier (`classifyProjection`, canary-tested with a synthetic relation) + an embedding-backed runner. Each disagreement is reclassified:
- **vocabulary** — folds under canonical normalization (from the graded scorer)
- **abstraction** — predicted subsumes/generalizes a reference item (same family, different level)
- **omission** — reference item with no predicted relation (a genuine gap)
- **redundant** — predicted item with no reference relation

**Subsumption oracle — graph-first.** `buildGraphSubsumptionOracle()` loads the invariant graph (proposed/validated/canonical + their `specializes`/`generalizes` edges — the topology CFS-048 parent-linking produces), resolves each label to invariant nodes by canonical-token containment, and returns `subsumes(pred, ref)` = *predicted resolves to an ANCESTOR of reference*. That is **ground truth**. Where a label doesn't resolve to a registry node, the classifier falls back to **embedding cosine** in the family band [0.62, 0.82) as a proxy. Every abstraction delta carries its `source` (`graph` | `embedding`), and the aggregate reports `graphConfirmedAbstractions` vs `embeddingAbstractions` — the two are never conflated.

**Projection Fidelity** is a composite: `0.35·structural(lexical) + 0.45·causalCoverage + 0.2·minimality`, so a low lexical F1 can coexist with high causal agreement (the whole point).

## Wiring
- Route `app/api/experiments/irl-exp001` — opt-in `{ topology: true }` (rides with the baselines run since both need embeddings); returns `topology` alongside `graded`/`comparison`.
- Runner — the embedding-heavy button is now **"Run with baselines + topology (EXP-006A)"**; a topology panel shows composite fidelity + structural/causal/minimality + the four delta classes with the graph-vs-embedding split. Folded into the saved/copied payload.
- Canary `tests/topology-projection-score.test.ts` — graph-truth preferred over cosine; source never conflated; genuine deltas survive; high cosine = semantic match not abstraction.

## Honest scope
The current EXP-006 CIRS uses **generic reasoning vocabulary** ("authentication", "negotiate") that is not yet in the invariant registry, so most labels won't resolve to graph nodes and correctly fall back to the embedding proxy — the panel will show a low `graphConfirmed` count today. The graph signal *bites* as the registry grows into that vocabulary, and fully when a future CIRS expresses its references AS registry invariants (the destination — then subsumption is pure graph-truth). The seam is built graph-first so that transition needs no rework.

## Next
- Express CIRS references as registry invariant nodes (or resolve them through the IRE) so the graph oracle dominates over the embedding proxy.
- Aletheon's Invariant Stability / Recurrence Index (evidence × regulations × sub-domains × domains × time) — after cross-domain runs exist.
