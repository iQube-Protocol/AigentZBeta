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

By construction the IPE's default axis is *derived from* the standing axis, so a well-behaved IPE should be **exactly reproducible** on a frozen substrate — this experiment confirms that construction holds live and surfaces any nondeterminism (caching, ordering, race) before it can contaminate a science result.

> **⚠ The 2026-07-18 run of this experiment is a pre-fix diagnostic (operator ruling, 2026-07-27).**
> The premise above was false when that run executed. `evidenceDensity` was `clamp01(standing)` over
> a 0–100 column, so the coordinate axis was not derived from standing but *saturated* against it —
> flat where standing is proportional. The coordinate weight vector was therefore a **presence
> indicator**, not a magnitude, and its cross-rep stability was identical by construction to the
> seed-set stability this same experiment reports separately. **`coordinateReproducibleRate` could
> not have failed**, which makes 1.0 a vacuous measurement rather than a mis-scaled one.
>
> ***Pre-fix diagnostic; invalid for confirmatory comparison and not numerically comparable with
> post-fix runs.*** Applies to `coordinateWeightsReproducible`, `meanAbsDelta`,
> `meanAbsDeltaVariance` and `divergesConsistent`. It does **not** apply to
> `standingWeightsReproducible` or `ireSeedSetStability`, which read raw standing and resolved seed
> ids respectively and were never touched by the defect.

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
- [x] Full IPV run (anchored band, 10 intents × 5 reps) — 2026-07-18. **standingReproducibleRate 1.0 · coordinateReproducibleRate 1.0 · seed-set stability 1.0 — 100% reproducible, zero nondeterminism.** `ipv-results-2026-07-18.json` sha256 `8f86238069142fcf…`. Calibration: `coordinates/v1-clamped`.
  - ⛔ **`coordinateReproducibleRate 1.0` — *Pre-fix diagnostic; invalid for confirmatory comparison and not numerically comparable with post-fix runs.*** (operator ruling 2026-07-27, IRE-6). `standingReproducibleRate` and `seed-set stability` are unaffected and stand.
- [ ] ⛔ **RERUN REQUIRED** — Stage 0 from a frozen configuration on `coordinates/v2-normalised`. Requirements + the copyable command: `../exp-p1-representation-runtime-gauntlet/STAGE-0_HANDOFF.md` § "Rerun requirements". The harness (`scripts/run-instrument-validation.mjs`) exits 2 rather than scoring IPV against a host that still serves the old calibration.
- [ ] IPE validated for EXP-P1 on the coordinate path — **NOT YET EARNED.** The 2026-07-18 record claimed it ("reproducibility confirmed live on the frozen substrate"); that claim is preserved as what was asserted then and is superseded for the coordinate path. Reproducibility remains necessary, not sufficient, either way.
