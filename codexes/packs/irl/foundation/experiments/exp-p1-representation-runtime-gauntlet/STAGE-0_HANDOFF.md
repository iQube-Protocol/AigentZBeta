# EXP-P1 Handoff Note — IRE Stage-0 Validation

**Chrysalis Foundation · Invariant Research Lab · 2026-07-18**
**Status:** Stage-0 shakedown COMPLETE; full anchored record run + IPV pending as EXP-P1 entry conditions.
**Audience:** external protocol reviewer (Austin Ambrozi / Autonomi Solutions) + the Institute.

---

## The claim, stated to be hard to attack

> **Stage-0 has not "proven invariant resolution quality." It has validated that the IRE is a deterministic instrument with meaningful on-domain alignment, and that it has survived adversarial calibration of its own measurement methodology.**

That is the whole and exact claim. Everything below supports it and nothing beyond it is asserted. Externally this is phrased as **"the instrument is validated for EXP-P1"** — not "the engine is cleared," which invites the fair objection *"cleared for what, exactly?"*

The most useful outcome of this exercise is not the favourable number; it is that the shakedown **exposed where the measurement apparatus and the engine boundaries were wrong**, and corrected both before any science ran. A weaker validation would have hidden the 0.13 run and reported the 0.57. This one surfaced the confound, fixed the wiring, and froze the interpretation.

---

## What Stage-0 does NOT test — the thesis, positioned upfront

Two hypotheses are easily entangled here, and this report deliberately separates them (ratified as `inv.reasoning.324–328`, 2026-07-18):

- **Hypothesis A — can an AI identify invariants better than human experts?** A reasonable engineering question about the IRE's extraction. **It is not the Institute's thesis.** Stage-0's coverage metric touches only this question, and only as calibration.
- **Hypothesis B — the actual thesis:** *reasoning performed once and preserved as structural invariants outperforms repeatedly rediscovering the same reasoning.* Let R be previously validated reasoning and I(R) its invariant representation; the claim is that **reusing I(R) is more effective than repeatedly recomputing R** — and nothing in that claim says where R came from.

Three consequences frame everything below:

1. **Source independence.** The structural performance of an invariant is independent of its provenance. Provenance matters for trust, reliability, and IP ownership — never for structural function. The corpus's primary source is humanity's accumulated expert reasoning, captured so machine intelligence can reuse it; the system's purpose is to *accumulate* expert judgment, not to out-discover the experts.
2. **The IRE is an instrument, not the discovery.** As DNA existed before PCR, structural invariants exist independently of the engine that resolves them. The 0.57/0.21 coverage figures therefore say nothing for or against Hypothesis B — they say only that *the current IRE approximates expert invariant identification with moderate agreement*, which is sufficient to **bootstrap a growing corpus** that standing, ratification, supersession, and expert contribution are designed to improve over time.
3. **One sentence carries the whole distinction:** ***Invariant Intelligence does not require machine-discovered invariants. It requires machine-operational invariants.*** Humans, AI, hybrid teams, and communities all contribute; the intelligence comes from operating over the substrate.

The larger frame is the **Hybrid Intelligence Thesis** (`inv.reasoning.329`, proposed/under-test): the highest-performing intelligence systems will be neither purely human nor purely artificial, but hybrid systems in which invariants provide the **shared substrate** — the common language (`inv.reasoning.331`) — through which validated reasoning accumulates and is reused across both human and machine cognition. An invariant, once validated, is a *transferable reasoning primitive independent of the intelligence that discovered it* (`inv.reasoning.330`): neither human reasoning nor machine reasoning, but shared substrate. This also answers the recurring serialization question directly — the novelty is not in the prompt text; the prompt is one transport mechanism, and the invariant exists before and beyond it. Whether humans, machines, or hybrids ultimately prove superior at *discovery* is itself an open research question the programme must test, never presuppose (`inv.reasoning.332`).

Accordingly, the original "coverage ≥ 0.7" calibration target is retired as a pass/fail notion entirely — not merely softened. Outperforming the Synthetic Expert Baseline was never the objective; approximating it well enough to curate is. EXP-P1 and EXP-P2 test Hypothesis B. Stage-0 tested the instrument. This report never crosses that line.

---

## Purpose

Stage-0 validated the experimental substrate EXP-P1 depends on: the **Invariant Resolution Engine (IRE)** can repeatably resolve invariant candidates from expert-derived semantic evidence under controlled conditions. The objective was **not** to optimise a coverage score, but to establish:

1. deterministic execution,
2. absence of pathological retrieval behaviour,
3. measurable alignment with domain-grounded expert baselines.

---

## Results summary

### Determinism — PASS (both engines)

- **IRE stability = 1.0** — full anchored record run (10 intents × 3 reps), and every prior configuration. Resolution is reproducible under identical configuration.
- **IPE reproducibility = 100%** — full anchored IPV run (10 intents × 5 reps): standing-weight and coordinate-weight reproducibility both 1.0, seed-set stability 1.0. The projection is *confirmed* reproducible live, not merely reproducible-by-construction.

These are the hard validation gates, and both held decisively.

### Domain relevance — PASS (corpus-density sensitivity confirmed)

Full anchored-band record run (10 intents), reported straight — no cherry-picking:

| Condition | Coverage | Compression | Novelty | Stability |
|---|---|---|---|---|
| Finance (corpus desert) | 0.07 | — | 0.88 | 1.0 |
| Anchored band — **full 10 intents (record)** | **0.21** | 0.65 | 0.75 | 1.0 |
| Anchored band — densest 3 (delegation/sovereignty/standing) | 0.57 | 1.21 | 0.67 | 1.0 |

Expected behaviour, confirmed: coverage tracks **corpus density**. It is highest (0.57) on the three regions the corpus most heavily canonises (delegation, sovereignty, standing), lower (0.21 mean) across the wider anchored band as intent domains thin, and collapses (0.07) on a corpus desert — while stability is *unaffected* throughout. Compression < 1 across the full band: the IRE selects fewer invariants than experts name. The variation *within* the anchored band is itself a useful corpus-gap signal (which constitutional sub-domains to canonise next), not an engine defect.

---

## Calibration findings (the evidence of maturity)

### Finding 1 — Discovery-node pollution (identified & corrected)

Early runs surfaced unrelated discovery-ranked invariants in resolution pathways for domains where perception localised nothing (the unscoped fallback returned the global highest-standing slice). Correction: the empty-perception fallback now grounds the constitutional/epistemology baseline, not the global top; discovery is separated from anchored resolution. **Outcome: the engine now respects corpus/domain boundaries.**

### Finding 2 — Measurement-model sensitivity (identified & stabilised)

Coverage depends significantly on the semantic-evaluator configuration.

| Configuration | Coverage |
|---|---:|
| gpt-4o-mini persona + gpt-4o-mini judge | 0.38 |
| gpt-4o-mini persona + gpt-4o judge (clean) | **0.57** |
| gpt-4o-mini persona + gpt-4o **consensus** + gpt-4o judge (confounded) | 0.13 |

The 0.13 run moved consensus generation (the SEB baseline) onto the stronger model — **baseline contamination, not an engine failure**. Correction: consensus stays persona-generated; only overlap scoring uses the stronger judge. This is the adversarial calibration the headline claim refers to.

---

## Frozen measurement interpretation

| Metric | Role |
|---|---|
| **Stability** | **Hard validation gate** |
| Coverage | Relative alignment proxy (SEB- and judge-dependent) |
| Novelty | Diagnostic signal |
| Compression | Diagnostic signal |

Coverage is **not** treated as an absolute quality threshold, because it depends on baseline generation, semantic-judge capability, and corpus composition. It swung 0.13 → 0.57 on byte-identical engine output; a single coverage figure certifies nothing. Reported always with its exact model configuration.

---

## Stage-0 final status

| Criterion | Status |
|---|---|
| Deterministic invariant resolution | ✅ PASS |
| Repeatability | ✅ PASS |
| Domain sensitivity | ✅ PASS |
| Discovery pollution identified & corrected | ✅ PASS |
| Measurement methodology stabilised | ✅ PASS |

**IRE Stage-0 validation: COMPLETE. Instrument validated for EXP-P1.**

---

## EXP-P1 entry conditions

1. ✅ Full anchored-band IRV record run (10 intents × 3 reps) — `irv-results-2026-07-18.json`, sha256 `258b64fda9aa9686…`.
2. ✅ IPV reproducibility validation (10 intents × 5 reps, 100%) — `ipv-results-2026-07-18.json`, sha256 `8f86238069142fcf…`.
3. ⏳ Frozen artifact publication — results + manifests committed to the repo (hashes above are the commitment).
4. ⏳ External countersignature review (this note).

Frozen config for the record run: `provider=openai · persona=gpt-4o-mini · judge=gpt-4o · band=anchored`.

---

## Reviewer ask (Austin)

1. Does the validation protocol adequately **distinguish engine behaviour from measurement artefacts**?
2. Is the frozen Stage-0 methodology **sufficient for EXP-P1 execution**?
3. Is the invariant substrate **appropriate for downstream experimental testing**?

---

*Prepared by the Invariant Research Lab. Stage-0 code + results: `scripts/run-instrument-validation.mjs`, `services/invariants/resolution.ts` (Finding-1 fix), `foundation/experiments/irv-001-*` / `ipv-001-*`. Interpretation frozen per `IRL_VALIDATION_ROADMAP.md` Stage 0.*
