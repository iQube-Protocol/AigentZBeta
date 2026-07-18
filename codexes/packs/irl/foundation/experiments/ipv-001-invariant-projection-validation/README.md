# IPV-001 — Invariant Projection Validation

**Chrysalis Foundation · Stage 0 (Instrument Validation) · Status: READY TO RUN**
**Hypothesis class:** Operational (instrument validation — see `foundation/IRL_VALIDATION_ROADMAP.md`).
**Constitutional anchor:** `foundation/CFS-033_constitutional-evaluation.md`; validates the IPE (`services/invariants/projectionBridge.ts`, CFS-039).

## Why this runs first

The sibling of IRV-001: before the **Invariant Projection Engine (IPE)** carries a live experiment, its projections must be shown to be **stable and reproducible**. IRV-001 validates *Synthetic-Expert → IRE*; IPV-001 validates *IRE → IPE*. Together they clear the instrument before any science.

## The question (engineering)

For a resolved field, does the IPE produce the **same projection** every time?
- **Reproducibility** — running the same intent repeatedly yields identical dimension weights (standing-path AND coordinate-path) and identical `diverges`.
- **Projection stability** — `meanAbsDelta` (standing vs coordinate weights) has near-zero variance across reps.
- **Seed-set stability** — the underlying IRE resolution is stable (shared with IRV-001).

By construction the IPE's default axis equals the standing axis, so a well-behaved IPE should be **exactly reproducible** on a frozen substrate — this experiment confirms that construction holds live and surfaces any nondeterminism (caching, ordering, race) before it can contaminate a science result.

## Method

Run the IPE through the same public route as IRV-001: `POST /api/public/irl/resolve` returns the `ipeProjection` block (standing weights, coordinate weights, `meanAbsDelta`, `diverges`). Run `--reps` times per intent; compare projections for exact reproducibility + variance. Same 20-intent config, same harness.

## How to run

```
node scripts/run-instrument-validation.mjs --host=https://dev-beta.aigentz.me --exp ipv --reps 5
# or run IRV + IPV together in one pass:
VENICE_API_KEY=... node scripts/run-instrument-validation.mjs --host=https://dev-beta.aigentz.me --exp both --reps 3
```
Writes `results/ipv-results-<date>.json` + `.manifest.json` (sha256).

## What "passing" looks like

- **Reproducibility = 100%** of intents (standing + coordinate weights identical across reps; `diverges` consistent).
- **meanAbsDelta variance ≈ 0.**
- Any intent that is NOT exactly reproducible is a nondeterminism bug to fix before the live experiments (the whole point of Stage 0).

## Honest limits

- IPV validates *reproducibility*, not *correctness of the projection semantics* (that is what EXP-P2 B4 tests). A perfectly reproducible-but-wrong projection would still pass IPV — reproducibility is necessary, not sufficient.
- On the standing axis today, IRE↔IPE agree by construction; divergence only appears once CCR constitutional-class coordinates shift the axis (EXP-P2 territory).

## Ratification record

- [x] READY TO RUN — chartered 2026-07-17 (operator direction; Stage-0 shake-down).
- [x] Sibling IRV-001 shakedown (2026-07-18) confirmed the shared substrate: **IRE seed-set stability = 1.0** across all reps (the reproducibility precondition IPV depends on). The one pathology found there (unscoped-fallback discovery pollution) is fixed in `resolution.ts`.
- [ ] Full IPV run (`--exp ipv`, anchored band): standing/coordinate reproducibility = 100% confirmed or nondeterminism triaged — run alongside the IRV record run.
- [ ] IPE cleared for EXP-P1/P2/P3 (expected: reproducible by construction on the frozen substrate; the run confirms no caching/ordering nondeterminism).
