# EXP-P3 — Capability Validation

**Chrysalis Foundation · Validation Programme v1 · Experiment C (Capability) · Status: DESIGN — pre-registration draft v0.1**
**Hypothesis class:** Capability (see `foundation/IRL_VALIDATION_ROADMAP.md`).
**Constitutional anchor:** `foundation/CFS-033_constitutional-evaluation.md`. Runs on the live IRL OS + AgentiQ OS instrument.
**Owner:** The Invariant Research Lab (demonstration).

## Designation note

A Capability experiment **assumes** the substrate and demonstrates what becomes *practical* because reasoning has been compressed into reusable structural invariants. It is deliberately **not** a proof of the substrate (that is EXP-P2) and **not** a comparative benchmark against a frontier model (that is EXP-P1). Its success criterion is *"a capability that was not previously practical is now practical, measured on held-out cases"* — the evidence investors remember. Per Aletheon's sequencing discipline: **run one strong demonstration first**; the remaining domains are a staged slate, not a batch.

## Hypothesis

Once reasoning is stored as a reusable structural invariant field, a class of tasks becomes practical that similarity-retrieval / raw-context systems cannot do well, because the task requires the field's **relations** (enables / constrains / contradicts / supersedes), not just its content. The point shifts from *"does it work?"* to *"what becomes possible that wasn't previously practical?"*

## Primary demonstration (run first): D1 — Consequence Engineering

**The capability:** given a proposed change or intent, **project it into the invariant field and forecast the downstream consequences** — the set of invariants/decisions it affects, the contradictions it introduces, and the repair paths — before acting. This is a capability a RAG/vector system structurally cannot deliver, because it requires the governance graph, not semantic similarity.

**Why it's the strongest first demo:** the machinery is already live (`services/research/invariantFieldQuery::forecastConsequences` / `projectInvariantFieldCounterfactual`, surfaced anonymously at `POST /api/public/irl/invariant-field` and in the IRL OS **Consequence Engineering** tab), so D1 measures an existing capability rather than building one; and consequence forecasting is directly monetisable (governance, finance, engineering change-management).

**Measured protocol (held-out, pre-registered, hash-committed):**
1. Assemble a held-out set of ≥20 changes with **known** downstream effects — e.g. superseding a specific invariant, or a policy/parameter change — where the actually-affected invariant set is established by ground truth *before* any forecast (sealed until scoring).
2. **Field-projection arm:** forecast the affected set + introduced contradictions + repair paths by projecting the change into the field.
3. **Baseline arm:** the same forecast by similarity/keyword retrieval over the flattened corpus at matched tokens.
4. **Metrics:** precision / recall / F1 of the predicted affected set vs ground truth; contradiction-detection rate; time-to-value (wall-clock) and tokens; and a blind-judged usefulness score of the repair-path narrative (via `--judge-config`).
5. **Success = capability demonstrated** if the field-projection arm materially exceeds the baseline on affected-set F1 **and** on time/token economy (pre-agreed thresholds, variance-banded), on held-out cases. This is a demonstration of practicality, reported with the same statistical discipline as the other programmes (medians + bootstrap CIs), but interpreted as capability, not as proof of structure.

## The capability slate (Phase 3 — staged, not batched)

D1 first. Each subsequent demonstration reuses the same discipline (held-out, hash-committed, variance-banded) and its own live seam:

| Demo | Capability | Live seam it reuses |
|---|---|---|
| **D1 Consequence Engineering** (first) | Forecast downstream effects + repair paths of a change | `forecastConsequences` / `/api/public/irl/invariant-field` · Consequence Engineering tab |
| D2 Forecasting | Project an intent into the field to anticipate outcomes/risks | `projectInvariantFieldCounterfactual` (counterfactual what-if) |
| D3 Software Engineering | Invariant-grounded artifact production with cited invariants | `runArtifact` (CVR-003) grounding + cited-invariant recording |
| D4 Finance | Governed financial-intelligence under constitutional constraints | CRP-003a Financial Services pipeline (`financialIntelligenceExecutor`) |
| D5 Legal / Scientific reasoning | Reason from a ratified substrate rather than regenerating each time | grounding + projection surfaces |
| D6 Invariant prediction (frontier) | Predict invariants humans have not yet discovered, from field structure | the field-metrics + projection stack (EXP-P2 B5 feeds this) |

## Pre-registered predictions (D1, locked at freeze)

- P-CAP-1: field-projection affected-set **F1 > baseline F1** at the pre-agreed threshold on held-out changes.
- P-CAP-2: field-projection **contradiction-detection rate > baseline** (the baseline structurally cannot see `contradicts` edges).
- P-CAP-3: field-projection **time-to-value and tokens materially lower** than an equivalent from-scratch analysis.
- **Null discipline:** if field-projection ≈ baseline on F1, the capability is *not yet practical at current scale* — published as such, no capability claimed.

## Reuse / build surface

- **Reuse (built):** `forecastConsequences` + `projectInvariantFieldCounterfactual` (`services/research/invariantFieldQuery`), `/api/public/irl/invariant-field`, the Consequence Engineering tab, `runArtifact` (D3), the CFSP pipeline (D4), `evaluate-exp001.mjs --judge-config` (usefulness scoring), the `experiment_results` + DVN publication path.
- **Build (new):** the held-out change-set + ground-truth affected sets (D1); a **baseline retrieval forecaster** (similarity over the flattened corpus); the D1 scoring harness (F1 / contradiction-rate / economy) + the shared bootstrap-CI stats module.

## Interpretation table (signed before any run)

| Outcome | Agreed interpretation |
|---|---|
| Field-projection ≫ baseline on F1 + economy (D1) | **Consequence engineering is a practical capability** the substrate uniquely enables. Lead demonstration for the capability thesis. |
| Field-projection > baseline on contradictions only | The *relational* value (seeing `contradicts`) is real even where affected-set recall isn't yet — partial capability, named precisely. |
| Field-projection ≈ baseline | Capability not yet practical at current corpus scale; staged demos paused pending EXP-P2 structural evidence + corpus growth. |

## Honest limits

- A capability demo **cannot** validate the substrate — a strong D1 result with a null EXP-P2 means "useful engine, structural claim still open." Report both truthfully.
- D1's credibility rests entirely on the held-out affected sets being ground-truthed *before* forecasting; any leakage voids it.
- Demonstrations are scale-bounded like EXP-P2: a null is "not yet practical," not "impossible."

## Ratification record

- [x] DESIGN drafted 2026-07-17 by operator direction (one strong demo first: D1).
- [ ] D1 held-out change-set + ground-truth affected sets sealed + hashed.
- [ ] Baseline forecaster + D1 scoring harness built.
- [ ] Predictions locked; interpretation table signed; bundle hashed + published.
- [ ] D1 executed; results published hash-consistent with the bundle. Subsequent demos staged.
