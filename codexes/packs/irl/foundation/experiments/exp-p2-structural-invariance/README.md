# EXP-P2 — Structural Invariance

**Chrysalis Foundation · Validation Programme v1 · Experiment B (Structural) · Status: DESIGN — pre-registration draft v0.1**
**Hypothesis class:** Structural (see `foundation/IRL_VALIDATION_ROADMAP.md`).
**Constitutional anchor:** `foundation/CFS-033_constitutional-evaluation.md`; tests `inv.reasoning.323` (intelligence is a property of fields, not models — proposed/under-test) and `inv.reasoning.322` (value scales with relationships, not count).
**Owner:** The Invariant Research Lab. **Not a benchmark against a frontier model — this is science.**

## Designation note

EXP-P2 is the companion experiment EXP-P1 §14 names ("Layer 1 vs Layer 2 / the medicine-style design"). It tests the Institute's *primary* hypothesis, which EXP-P1 explicitly does **not** touch. It runs under identical rigor (pre-registration, hashed bundle, blind judge, variance bands, signed interpretation table) but answers a different question, so no result here can be cited as a comparative benchmark win, and no EXP-P1 result can be cited as evidence about structure. Roles: the Institute owns this hypothesis; an external reviewer may harden the methodology but does not design the science.

## Hypothesis

**Can structural invariants be discovered, composed, and reused as a reasoning substrate *independently of prompt engineering and context engineering*?** Concretely: does organising a source corpus into an **invariant field** — a set of discrete, typed, decomposed statements with explicit relations — yield reasoning properties that the *same corpus* does not exhibit in raw or conventionally-summarised form at equal token budget, and are those properties **corpus-intrinsic** (a discovered structure) rather than artifacts of curation?

This is the empirical test of `inv.reasoning.323`: if intelligence is a property of structured invariant fields and the transformations between them (not of the model), then the field representation should carry reasoning capacity that neither the raw text nor an expert summary of the identical knowledge carries at matched tokens — and that capacity should localise to the field's **structure** (its relations), not merely its content.

## The load-bearing control (EXP-P1 §14)

**The invariant substrate MUST be extracted from the same corpus the raw arm uses**, by a documented, hash-committed extraction procedure — never hand-authored for the tasks, never drawn from a different or richer source. Otherwise the comparison silently becomes *corpus-vs-corpus* (proving nothing about representation) instead of *representation-vs-representation* of one fixed body of knowledge. This control is non-negotiable and is what makes EXP-P2 a structural experiment rather than a curation experiment.

## Arms (all at matched token budget, all derived from ONE source corpus `Corpus vP2`)

| Arm | Representation of the same knowledge | Built from |
|---|---|---|
| **R — Raw** | A token-matched slice of the raw source corpus (unstructured excerpts, no decomposition, no relations). | `Corpus vP2` directly |
| **S — Summary** | A conventional expert summary of the same corpus (continuous prose; standard compression). | `Corpus vP2`, human-summarised without the invariant collection |
| **I — Invariant field** | The invariant substrate extracted from the same corpus by the documented procedure: discrete typed statements + their relations, exported verbatim. | `Corpus vP2` → extraction → `Crystal vP2` slice |

Token budget matched across R/S/I on the final rendered prompt (EXP-P1 §9 rule). The **only** difference between arms is how the identical knowledge is represented.

## The structural battery (five sub-experiments)

**B1 — Discovery & structural convergence.** Extract invariants from `Corpus vP2` by a documented procedure; run the extraction independently ≥2 times (distinct providers per the Independence Protocol). Measure convergence: do independent extractions recover the same invariants (statement-level agreement) and the same relations (edge-level agreement)? *Prediction: extraction converges materially above chance — invariants are discovered, not invented.*

**B2 — Minimal sufficiency (K*).** Sweep the size of the invariant set grounding the derivation tasks from small to full; plot accuracy vs |set|. *Prediction: a compression floor K* exists — accuracy is preserved down to a small set, then collapses — and K* is far below the raw-token budget that achieves the same accuracy in Arm R.* (Tests `inv.reasoning.322`: value in relationships, not count.)

**B3 — Reasoning ablation.** Remove or perturb specific invariants from Arm I vs remove matched-token spans from Arm R, and measure which degrades reasoning more. Ablate **by structural role** (high-standing / high-degree nodes vs peripheral ones). *Prediction: ablating structurally central invariants degrades reasoning disproportionately vs random-token removal from Raw — reasoning rides the structure, not the bulk.*

**B4 — Projection vs retrieval.** Ground each intent two ways at matched tokens: (i) **projection** — select the governing invariants by projecting the intent into the field; (ii) **retrieval** — similarity search over the raw corpus. *Prediction: projection > retrieval on selection-sensitive derivation tasks* (the empirical test of `inv.reasoning.313`: governance-retrieval vs similarity-retrieval). Reuses the CFO counterfactual/field-query surface.

**B5 — Field properties.** Compute structural metrics on the extracted invariant graph vs a raw-corpus co-occurrence graph of the same corpus: degree distribution (scale-free-ness), connected structure / attractors, and compressibility as a function of corpus maturity. *Prediction: the invariant graph exhibits structure (heavier-tailed degree, higher compressibility) absent from the co-occurrence baseline.* Observe-only; reuses `/api/public/irl/invariant-field` + `services/research/invariantFieldQuery`.

## Pre-registered predictions (locked at freeze)

- P-IRL-S1 (representation): **I > R** on derivation accuracy at matched tokens; **I ≳ S** on derivation (structure preserves generative capacity a summary loses).
- P-IRL-S2 (sufficiency): a K* floor exists (B2); below it accuracy collapses; K*-tokens ≪ Raw-tokens for equal accuracy.
- P-IRL-S3 (structure carries reasoning): structural-role ablation (B3) degrades more than matched random-token removal.
- P-IRL-S4 (projection): projection > retrieval on selection-sensitive tasks (B4).
- P-IRL-S5 (discovery): independent extractions converge above chance (B1).
- **Null discipline (Principle 004):** any of these coming out null is a finding, published as such. In particular, **I ≈ R on derivation** would falsify the structural claim at current scale and reprice the programme's thesis — pre-committed here, before data.

## Materials, pinning, statistics, judging

Identical discipline to EXP-P1: single pinned model + parameters; `Corpus vP2` + `Crystal vP2` frozen and hash-committed (EXP-009 freeze fields); extraction procedure + its output hash-committed; held-out task set (12 recall / 12 derivation minimum) with pre-committed answer keys, sealed until adjudication; blind external-specifiable judge via `evaluate-exp001.mjs --judge-config`, dual-run + hash-compared; k=5 reps; medians + bootstrap 95% CIs; the same signal threshold (non-overlapping CIs **and** ≥5-point median delta). Token equality on the final rendered prompt across R/S/I.

## Reuse / build surface

- **Reuse (built):** `export-grounding-slice.mjs` (Arm I), `evaluate-exp001.mjs --judge-config` (blind dual-run judge), `services/research/invariantFieldQuery` + `/api/public/irl/invariant-field` (B4/B5), the `experiment_results` + DVN publication path, the crystal freeze fields (EXP-009).
- **Build (new, composes on the above):** a **corpus-slice exporter** (Arm R token-matched raw slices + manifest/sha256, sibling to the invariant exporter); a **documented extraction procedure** run harness (`Corpus vP2` → invariants, receipted, ≥2 independent runs for B1); the **sufficiency-sweep** runner (B2); the **structural-role ablation** runner (B3); the **projection-vs-retrieval** runner (B4); a **graph-metrics** module (B5); and the shared bootstrap-CI stats module (also needed by EXP-P1).

## How to run (once built + frozen)

```
# freeze Corpus vP2 + extract Crystal vP2 (documented procedure, ≥2 providers)
node scripts/freeze-corpus.mjs --corpus vP2                 # NEW
node scripts/extract-invariants.mjs --corpus vP2 --provider <a>   # NEW (B1, run twice)
# arms at matched tokens
node scripts/export-corpus-slice.mjs --corpus vP2 --tokens <N>    # NEW (Arm R)
node scripts/export-grounding-slice.mjs --broad ...              # EXISTS (Arm I)
# battery + judge
node scripts/run-structural-battery.mjs --exp p2 ...            # NEW (B2–B5)
node scripts/evaluate-exp001.mjs --judge-config <austin-or-jointly-specified>.json   # EXISTS
```

## Interpretation table (signed before any run)

| Outcome | Agreed interpretation |
|---|---|
| I > R and I ≳ S on derivation | **Structural invariance supported at current scale.** Representation carries generative reasoning capacity beyond raw text and expert summary of the same corpus. First empirical support for `inv.reasoning.323`. |
| I ≈ S, both > R | Compression helps but the *invariant structure* adds nothing beyond good summarisation; value is content-compression, not structure. Reprice the structural claim; `323` stays a hypothesis. |
| I ≈ R on derivation | **Structural claim falsified at current scale.** The field, at this corpus size, does not yet exhibit corpus-intrinsic reasoning structure. Published as a null; the thesis reprices to lifecycle/governance value (per the two-layer doctrine). |
| K* floor exists (B2) | Reasoning is preserved by a small invariant core — evidence for compression-to-invariants and `inv.reasoning.322`. |
| Structural-role ablation ≫ random-token ablation (B3) | Reasoning rides structure, not bulk — the strongest single piece of structural evidence. |
| Projection > retrieval (B4) | Governance-retrieval beats similarity-retrieval — empirical support for `inv.reasoning.313`; the iQube-vs-vector-DB distinction is real. |
| Extraction converges (B1) | Invariants are discovered, not authored — supports the substrate's objectivity. |
| Invariant graph shows structure absent from co-occurrence (B5) | The field has emergent topology — motivates the Phase-2 discovery-science questions (attractors, scale-free-ness, maturity-compressibility). |

## Honest limits

- **Scale caveat:** current corpus size may be below the threshold where field structure dominates; a null is scale-bounded, not a permanent refutation (state this in any negative result).
- **Extraction dependence (B1):** convergence depends on the documented procedure; the procedure itself is an experimental artifact and must be published and hash-committed, or B1 is unfalsifiable.
- **The same-corpus control is the whole experiment:** any leak of out-of-corpus knowledge into Arm I voids the comparison. Attest and audit.
- **This experiment does not benchmark against any external system** — a frontier model outscoring all three arms is irrelevant to the structural question.

## Ratification record

- [x] DESIGN drafted 2026-07-17 by operator direction (companion to EXP-P1 §14).
- [ ] Extraction procedure documented + hash-committed.
- [ ] `Corpus vP2` frozen; `Crystal vP2` extracted (≥2 providers) + hashed.
- [ ] Predictions locked; interpretation table signed.
- [ ] Battery runners + stats module built; pre-registration bundle hashed + published.
- [ ] Runs executed; results published hash-consistent with the bundle.
