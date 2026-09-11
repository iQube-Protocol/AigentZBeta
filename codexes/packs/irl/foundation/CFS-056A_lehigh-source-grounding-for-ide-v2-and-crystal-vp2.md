# CFS-056A — Lehigh Source Grounding for IDE v2 and Crystal vP2

**Status:** SOURCE-GROUNDED ADDENDUM · 2026-08-12  
**Parent:** CFS-056 — Risk-Field Invariant Discovery and Crystal vP2  
**Purpose:** extract stable, computable primitives from the recovered Lehigh/metaMe risk research without promoting historical demonstration coefficients into canon.

---

## 1. Source set recovered

The following source artefacts were supplied by the operator on 2026-08-12 and are the evidence basis for this addendum:

| Source | Role | SHA-256 |
|---|---|---|
| `Final_Report_metaMe(1).pdf` | original Lehigh GBUS 485 quantitative data-risk report | `d1eb8f10ae86de3edad770163a49d4662f4c4486787002cd2b035feb87a59084` |
| `Capstone Project Plan - Data Risk  Pricing.pdf` | risk → underwriting → pricing project plan | `8a8d8854747e0c05fb788db3d0ce80bb916037c33174bcbbf3a922653c18a0d2` |
| `metatMe_DataRisk.ipynb` | executable ancestor / prototype risk matrix and vectorized scoring notebook | `6c809698ed1997bacadb6afa43808d5c7b040ab6e8864bc903bca2a2eec1573f` |
| `DATA RISK FOR MARKETPLACES_v2 Pt 1.pdf` | June 2025 expanded risk/value/governance framework | `9f18b56959c861604e108dab20749ea4c7e12683702a2524e5ffdb18c62ddde3` |

These hashes identify the exact research inputs used here. The source PDFs and notebook are evidence, not canonical runtime configuration.

---

## 2. Important correction: do not encode a remembered 34-class taxonomy

The recovered original report explicitly defines **23 core risk dimensions**:

`Identifiability, Sensitivity, Confidentiality, Competitiveness, Reputation, Compliance, Financial, Political, Diplomatic, Emotional, Commercial, Legal, Geopolitical, Military, Intelligence, Social, Public Welfare, Strategic, Operational, Environmental, Security, Health & Safety, Verifiability`.

The June 2025 v2 document then extends that core with additional **families** of dimensions:

- temporal;
- contextual;
- technical;
- positive-value / opportunity dimensions.

The recovered material does **not** presently establish one clean, authoritative 34-item canonical list. Therefore IDE v2 MUST NOT encode `34` as a truth merely because it was remembered in discussion. The code core shall preserve the 23-source core and allow additive family-qualified dimensions until the later taxonomy is reconciled from the complete source lineage.

This is a useful scientific result: the taxonomy is versioned, not timeless. Crystal vP2 must carry the taxonomy version/source hashes used for each risk-field run.

---

## 3. What the Lehigh work already contained that IDE v2 should reuse

### 3.1 Intent is already a risk primitive

The capstone plan explicitly proposes translating **intent and context into a quantifiable risk score**. The v2 framework advances this into explicit intent-based risk modulation, distinguishing beneficial, neutral, questionable and harmful intent bands.

IDE v2 changes the role of that insight:

```text
OLD: intent → modulate aggregate risk score
NEW: intent → establish risk field → expand causal search → discover/resolve invariants → residual risk/value projection
```

Intent modulation remains available downstream, but intent relevance becomes upstream search geometry.

### 3.2 Context-specific risk weighting is foundational

The original report states that different use-cases care about different risk dimensions and assigns Qube × risk-type weights. It also acknowledges that the demonstration implementation used seeded random weights and recommends calibration from historical incidents, regulatory fine schedules and insurance premiums.

The v2 paper strengthens this with five proposed weight sources:

1. historical incident analysis;
2. expert consensus / Delphi;
3. regulatory fine structures;
4. insurance premium data;
5. machine-learning optimization.

IDE v2 should therefore treat **risk relevance/weight as evidence-backed context**, never a hard-coded global constant.

### 3.3 Verifiability is not binary

The original report already made verifiability a risk adjustment. The v2 framework turns it into a continuous product of:

```text
verification strength × recency × authority credibility
```

and applies a context-dependent `VerificationImpact`.

For IDE v2 this matters twice:

- **risk-field formation:** weak or stale verification can create data-integrity/repair paths;
- **invariant evidence:** verification quality affects how strongly evidence may support an invariant.

The same signal MUST NOT be conflated with truth. High verification confidence can strengthen provenance while a verified fact may still increase exposure or identifiability. This is the beginning of the paper's stated “verification paradox.”

### 3.4 Risk is compositional and can be non-linear

The original experiment exhaustively evaluated all non-empty combinations of 16 flagship Qubes and found concentration/toxicity effects: certain sensitive records can dominate a bundle, while combinations can amplify exposure through cross-reference and re-identification.

The v2 framework makes non-linear combination models an explicit requirement.

This is directly relevant to invariant discovery: **risk vectors are not independent features**. A risk field must be capable of representing interaction/propagation edges, because a repair path may exist only when two otherwise tolerable conditions co-occur.

For Crystal vP2, stress cases SHOULD include compositional failures rather than only single-variable risk cases.

### 3.5 Risk is temporal

The v2 framework introduces data lifecycle risk, regulatory velocity and time-dependent risk / half-life models. Risk can decay or grow with time rather than remaining fixed.

IDE v2 implication:

```text
risk field = f(intent, context, evidence, composition, time)
```

A candidate invariant should not be rejected merely because its triggering risk is dormant at `t0`; the system must distinguish structural invariance from time-varying activation.

Crystal vP2 should therefore separate:

- invariant stability;
- risk-vector activation;
- evidence freshness;
- time-to-consequence.

### 3.6 Risk and value were already conceived as a joint decision surface

The v2 framework adds positive-value dimensions including innovation opportunity, operational efficiency, strategic decision support, competitive advantage and relationship enhancement. It defines an aggregate value score and a research `RiskAdjustedValue` projection.

This aligns strongly with the new IDE thesis:

```text
Time-to-Value  ← invariant field → Risk-of-Repair
```

The important upgrade is that value and risk should no longer meet only in a final scalar formula. They should meet first in the **invariant field**, where the system asks which minimal causal conditions both accelerate useful outcome and contain future repair.

### 3.7 Risk should map to action, not merely classification

Both reports connect risk outputs to governance: access controls, verification gates, monitoring, anonymization, differential privacy, encryption, usage restrictions and review/escalation. The v2 framework formalizes `Risk-to-Mitigation Mapping` and automated governance.

IDE v2 should therefore model a risk vector as capable of producing:

```text
risk vector → repair path → invariant requirement → governed action/control
```

Controls are consequences of the invariant/risk analysis; they are not themselves automatically invariants.

### 3.8 Explainability is part of the scientific surface

The v2 document proposes factor contributions, SHAP, benchmarking and natural-language explanations. These are not all required for the first IDE implementation, but the underlying requirement is important: a risk result should expose **why** it is material.

For IDE v2, provenance is stronger than post-hoc explanation:

```text
intent
→ risk vector
→ evidence
→ repair path
→ candidate invariant
→ validation
→ decision
```

Factor attribution may be added later, but this causal/provenance trace is mandatory for Crystal vP2 reviewability.

### 3.9 Underwriting is a downstream test of causal legibility

The capstone plan explicitly envisages pricing and underwriting risk profiles without exposing raw data, with actuarial participation, probabilistic models, insurance scenarios, SMPC and smart-contract execution.

This provides a useful future falsification surface: if an invariant-anchored risk field is genuinely more causally legible, it should support better underwriting/calibration than a flat aggregate risk score. That is a future experiment, not a current claim.

---

## 4. What NOT to carry forward uncritically

The source corpus also contains prototype choices and contradictions that must remain evidence rather than canon:

- seeded/random weights in the original demonstration;
- fixed Low/Medium/High numeric mapping as if universal;
- k-means as the universal risk classifier;
- hard-coded intent multipliers;
- historical verification coefficients treated as universally valid;
- direct assumption that higher risk should simply command a higher price;
- claims of non-linearity where some presented aggregate plots are not themselves sufficient proof of the claimed mechanism;
- individual regulatory summaries as authoritative legal interpretation without current legal-source verification.

The engineering rule is therefore:

> **Encode the data model, provenance, dimensions and pure transforms first; inject calibrated coefficients through versioned policy/configuration later.**

---

## 5. IDE v2 computational model after source grounding

The working object becomes:

```text
Intent
  ↓
Constitutional Constraints
  ↓
Risk Taxonomy Version + Context
  ↓
Intent Risk Field
  ├─ dimension relevance
  ├─ confidence
  ├─ likelihood / severity where available
  ├─ verification state
  ├─ temporal activation
  ├─ interaction / composition edges
  └─ provenance
  ↓
Repair Paths
  ↓
Bidirectional Discovery
  ├─ forward_ttv
  └─ reverse_ror
  ↓
Candidate Invariant Convergence
  ├─ ttv-only
  ├─ ror-only
  └─ dual-bearing
  ↓
Validation / Compression
  ↓
Invariant Field
  ↓
Risk · Value · Mitigation · Underwriting · Price projections
  ↓
Execution / Consequence / New Evidence
```

The **risk taxonomy supplies bearings**; it does not dictate the invariant set.

---

## 6. Crystal vP2 design consequences

Crystal vP2 SHALL be constituted using cases that make the recovered Lehigh insights testable.

### Required case properties

The frozen intent set should contain cases that exercise:

- data quality / erroneous information;
- operational or execution failure;
- security / unauthorized action;
- legal/compliance boundary conditions;
- verification quality and stale evidence;
- cross-dataset / cross-source interaction;
- temporal change;
- positive opportunity/value trade-offs;
- ordinary benign operation as controls.

### Required candidate provenance

Every risk-derived candidate should record:

```text
risk taxonomy version
risk dimension/family
intent/context
source evidence
materiality decision
repair path
forward/reverse discovery bearing
time state where relevant
interaction dependencies where relevant
```

### Required evaluation separation

The source papers may be used to constitute the vP2 discovery method and training/source corpus only under the experiment's declared contamination rules. Evaluation cases used to compare Crystal vP1 and vP2 must be held out from the evidence used to build vP2.

### New vP2 metrics worth preregistering

Beyond existing inference/performance measures:

- **repair-path coverage** — proportion of preregistered material adverse paths for which the Crystal retrieves a causally relevant invariant;
- **risk-field recall** — materially relevant risk dimensions recovered for a held-out intent;
- **false materiality burden** — irrelevant risk dimensions/invariants injected into context;
- **dual-bearing utility** — downstream performance of dual-bearing vs single-bearing invariants;
- **composition robustness** — performance when risk emerges only from combinations;
- **temporal robustness** — performance when risk activation changes with time/evidence freshness;
- **repair-envelope ablation delta** — change in adverse-outcome/repair exposure when a candidate invariant is removed;
- **TTV/RoR joint efficiency** — useful performance gain per unit of repair-risk burden.

These metrics are proposals until preregistered.

---

## 7. Code landed with this addendum

`services/invariants/riskField.ts` now provides the first additive code core:

- canonical recovered 23-dimension core list;
- extensible risk-dimension families;
- `IntentRiskVector` and `IntentRiskField`;
- `RepairPath`;
- continuous verification factor structure;
- caller-calibrated verification and intent modulation;
- explicit material vs unresolved risk-vector selection;
- TTV/RoR/dual-bearing convergence;
- the v2 paper's risk-adjusted-value equation retained as an explicitly labelled **research projection**, not final pricing canon.

`tests/risk-field.test.ts` establishes canaries for those semantics.

The next engineering slice should add a versioned Lehigh adapter and persistence/receipt shape, not a new parallel risk engine.

---

## 8. Immediate build sequence

1. **Land the typed risk-field primitive** — done in this change set.
2. Define a versioned `RiskTaxonomyManifest` with source hashes and dimension definitions.
3. Add risk-field receipts to IDE discovery runs without changing candidate lifecycle semantics.
4. Add `forward_ttv` / `reverse_ror` provenance to extraction/synthesis.
5. Define interaction edges and temporal activation as additive vector metadata.
6. Build the first Lehigh adapter against a reconstructed fixture from these exact source files.
7. Preregister the Crystal vP2 intent set and held-out evaluation set before vP2 constitution.
8. Only after calibration evidence exists, introduce empirical weights/intent factors/classification thresholds as versioned policy.

---

## 9. Canonical working principle

> **Risk is not merely an output of invariant reasoning. It is a field that helps determine where invariant discovery must look. Value supplies the forward pressure toward consequence; risk-of-repair supplies the adverse boundary; constitutional invariants constrain admissibility; structural invariants compress the causal conditions that govern both.**

This addendum grounds that principle in the recovered Lehigh research while keeping the empirical claims falsifiable and the coefficients replaceable.
