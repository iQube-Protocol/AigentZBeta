# CFS-056 — Risk-Field Invariant Discovery and Crystal vP2

**Status:** PROPOSED — methodological extension to CFS-048; operator direction 2026-08-12  
**Scope:** Invariant Discovery Engine (IDE v2), Lehigh risk/value/price integration, risk-of-repair, Crystal vP2 constitution methodology  
**Experimental boundary:** additive only. **Crystal vP1 remains frozen/governed by its existing constitution and MUST NOT be rewritten by this specification.**

---

## 0. Decision

Invariant discovery SHALL no longer be driven only by the positive causal question:

> What must remain true for the intended outcome to occur?

IDE v2 adds an equal and explicit negative/consequential question:

> What must remain true so that execution does not enter a materially adverse or costly-to-repair state?

The first question gives discovery a **vector**. The second gives discovery a **field**.

The resulting invariant set is therefore not merely the minimal structure that can produce an intended outcome. It is the minimal causally determining structure that can produce the intended outcome **while remaining inside an acceptable risk-of-repair envelope**.

This specification anchors that second search in the existing Lehigh intent-driven risk research: an intent is projected across the Lehigh risk taxonomy (currently described as 34 risk classes; this document does not reconstruct or rename that taxonomy). Material risk vectors form an **Intent Risk Field**. IDE then uses that field to expand causal search beyond the apparent outcome domain and compress both positive and negative causal paths into an invariant field.

---

## 1. Core model

The previous simplified flow was:

```text
Intent → Domain/Evidence → IDE → Candidate Invariants → Validation → Runtime
```

IDE v2 becomes:

```text
                    ┌──────────── Time-to-Value search ────────────┐
Intent → Constitution → Intent Risk Field → Causal Search → Compression
                    └──────────── Risk-of-Repair search ──────────┘
                                           ↓
                                    Invariant Field
                                           ↓
                         Evidence / Data / Tool Resolution
                                           ↓
                         Risk · Value · Price · Consequence
                                           ↓
                                      Execution
                                           ↓
                                  Observed Consequence
                                           └──────→ new evidence
```

The invariant field is the overlap between two optimization surfaces:

1. **Time-to-Value (TTV):** what minimally determines useful progress toward the intended consequence.
2. **Risk-of-Repair (RoR):** what minimally determines whether apparently useful progress creates future correction, reversal, loss, liability, rework, propagation, or irreversibility.

A candidate invariant is stronger when it is independently recovered from both searches.

Conceptually:

```text
I_candidate = I_TTV ∪ I_RoR
I* = minimal causally sufficient compression(I_candidate)
```

subject to:

```text
TTV(I*, X) ≤ acceptable TTV
RoR(I*, X) ≤ acceptable RoR
I* satisfies constitutional constraints C
```

The equations are methodological targets, not claims that TTV or RoR already have universally calibrated scalar forms.

---

## 2. Constitutional and structural invariants have different jobs

IDE v2 SHALL preserve the distinction already established in the IRL architecture:

- **Constitutional invariants define the permissible consequence space**: authority, rights, prohibitions, accountability, delegation, legitimacy, consent, jurisdiction and other non-negotiable boundaries.
- **Structural invariants describe the causal terrain inside that space**: conservation, dependency, sequencing, stability, feedback, execution conditions, information integrity and other descriptive constraints.

Therefore:

```text
Intent         = direction
Constitution   = permissible boundary
Risk Field     = bearings / danger map
Structural Set = causal terrain
Invariant Field= minimal determining overlap
```

The constitutional layer is not a parallel after-the-fact safety score. It constrains what counts as an admissible positive outcome before optimization occurs.

---

## 3. Lehigh integration: risk moves upstream and remains downstream

The Lehigh risk/value/price work is not replaced. IDE v2 changes its position in the computation.

### 3.1 Upstream role: form the Intent Risk Field

For each intent, the Lehigh risk taxonomy SHALL be evaluated for relevance before invariant selection is complete.

Each risk class should emit, at minimum:

```ts
interface IntentRiskVector {
  riskClassId: string;          // canonical Lehigh class identifier
  relevance: number;            // 0..1 or governed categorical equivalent
  confidence: number;           // confidence in relevance assessment
  severity?: number;
  likelihood?: number;
  detectability?: number;
  reversibility?: number;
  repairCost?: number;
  blastRadius?: number;
  timeToConsequence?: number;
  evidenceRefs: string[];
  rationale: string;
}
```

The existing Lehigh taxonomy remains authoritative for class identity. The additional dimensions above are the IDE v2 repair-field projection and may be introduced incrementally.

Material vectors form:

```ts
interface IntentRiskField {
  intentId: string;
  constitutionalConstraints: string[];
  vectors: IntentRiskVector[];
  materialVectorIds: string[];
  unresolvedVectorIds: string[];
  generatedAt: string;
  provenanceRefs: string[];
}
```

The risk field answers:

> Given what is being attempted, where can consequential failure originate?

It does **not** decide the outcome and does not itself produce invariants.

### 3.2 Downstream role: compute residual risk, value and price

After invariant compression and evidence resolution, the Lehigh models can operate on a more causally legible object.

Instead of assigning value/risk directly to undifferentiated information, the runtime can ask:

- Which invariant does this datum support or challenge?
- How much uncertainty around that invariant does it resolve?
- Which repair path does it close, expose or worsen?
- Which value-producing causal path does it accelerate?
- Does it alter the permissible action set?

This creates an invariant-anchored basis for **risk, value and ultimately price**.

Information value may arise because information:

1. establishes an outcome-producing invariant;
2. resolves uncertainty around an invariant;
3. detects breach of an invariant;
4. reduces a material repair pathway;
5. enables earlier/faster action without expanding the repair envelope.

---

## 4. Repair Path as a first-class IDE object

For each material risk vector, IDE v2 SHALL attempt to derive one or more repair paths.

```ts
interface RepairPath {
  id: string;
  riskClassId: string;
  adverseState: string;
  causalPrecursors: string[];
  detectionConditions: string[];
  containmentConditions: string[];
  reversalConditions: string[];
  irreversibleConditions: string[];
  evidenceRefs: string[];
  confidence: number;
}
```

A repair path asks:

> If this risk becomes real, what causal sequence makes the outcome costly, difficult or impossible to repair?

This is deliberately broader than loss probability. Examples include duplicated execution, stale or false information, unauthorized action, code failure, settlement failure, prohibited activity, privacy leakage, latent model error and blast-radius propagation.

The repair path is a search primitive, not an invariant. IDE searches the path for candidate conditions that must remain true to prevent, detect, contain or reverse it.

---

## 5. Bidirectional discovery algorithm

IDE v2 extends CFS-048 without replacing its evidence-first, candidate, synthesis, validation and canonicalization stages.

### Pass A — Forward / TTV discovery

For the intent and evidence corpus:

> What conditions minimally determine achievement of the desired consequence?

Outputs `I_TTV` candidate patterns.

### Pass B — Reverse / RoR discovery

For every material risk vector and repair path:

> What conditions minimally determine whether this adverse state is prevented, detected, contained or reversible?

Outputs `I_RoR` candidate patterns.

### Pass C — Convergence and compression

Merge:

```text
I_candidate = I_TTV ∪ I_RoR
```

Then classify candidate support:

```ts
type DiscoveryBearing =
  | 'ttv-only'
  | 'ror-only'
  | 'dual-bearing';
```

`dual-bearing` is an evidential strengthening signal, not automatic validity. Validation remains non-bypassable.

Compress overlapping candidates using the existing synthesis/duplicate/merge machinery, preserving provenance from both discovery bearings.

### Pass D — Minimal-sufficiency / repair-envelope ablation

For each candidate invariant, test conceptually or experimentally:

1. If removed, does desired-outcome sufficiency materially degrade?
2. If removed, does the risk-of-repair envelope materially expand?
3. If neither changes, is the candidate merely context, correlation or heuristic?

This gives IDE a principled stopping criterion:

> Discovery approaches sufficient compression when removing further candidates no longer materially changes either outcome sufficiency or the material risk-of-repair envelope.

This is a methodological hypothesis and must be tested, not assumed.

---

## 6. Runtime transaction shape

The target governed transaction object is:

```ts
interface InvariantAnchoredTransaction {
  intent: {
    id: string;
    statement: string;
    desiredConsequence: string;
    authorityRefs: string[];
    constitutionalConstraints: string[];
  };
  riskField: IntentRiskField;
  repairPaths: RepairPath[];
  invariantField: Array<{
    invariantId: string;
    bearing: DiscoveryBearing;
    supportedRiskVectorIds: string[];
    supportedRepairPathIds: string[];
    constitutionalRole?: 'boundary' | 'authority' | 'prohibition' | 'obligation';
  }>;
  evidenceBindings: Array<{
    evidenceRef: string;
    invariantId: string;
    relation: 'supports' | 'challenges' | 'detects-breach' | 'reduces-uncertainty';
  }>;
  projection: {
    timeToValue?: number;
    residualRiskOfRepair?: number;
    informationValue?: number;
    consequentialValue?: number;
    price?: number;
  };
  decision: 'act' | 'abstain' | 'verify' | 'shadow' | 'escalate';
}
```

No implementation is required to populate every optional scalar before the architecture is useful. The first requirement is traceability between **intent → risk → repair path → invariant → evidence → decision → consequence**.

---

## 7. Relationship to PoTS

PoTS becomes the human-centered consequence measure of the same architecture:

> Time-to-value saved is legitimate only where the action does not materially expand risk-of-repair.

IDE v2 moves that principle upstream. The system searches for the invariant set that makes both dimensions jointly tractable before execution rather than discovering exported repair only after the fact.

The resulting architecture is:

```text
Lehigh           → risk/value measurement apparatus
Invariant Intel  → causal compression apparatus
Constitutional   → permissible-boundary / execution-governance apparatus
PoTS             → human consequential-value measure
Crystal          → experimental substrate for falsification
```

---

# PART II — Crystal vP2 Plan

## 8. Experimental rule: do not contaminate vP1

Crystal vP1 SHALL remain unchanged. Its existing `financial-risk-value-systems` constitution, eligibility rules, provenance regime, freeze state and experimental records remain the historical baseline.

Crystal vP2 is a successor object constituted with a new discovery methodology.

The experiments test whether invariant representations improve inference/performance. They do **not** require invariant discovery itself to remain fixed across Crystal generations, provided each generation's constitution is explicit, frozen before testing and independently auditable.

Therefore the vP1 → vP2 comparison can later test whether a risk-field-informed constitution improves downstream performance, but IDE v2 SHALL NOT be described as validated merely because vP2 exists.

---

## 9. vP2 research question

Primary methodological question:

> Does a Crystal constituted through bidirectional, risk-field-informed invariant discovery provide better minimal causal coverage of financial decision systems under uncertainty than the vP1 constitution, without increasing context burden or risk-of-repair?

Secondary questions:

1. Does risk-field expansion recover material invariants outside the obvious positive-outcome domain?
2. Do dual-bearing invariants outperform TTV-only or RoR-only candidates in downstream usefulness/stability?
3. Does vP2 reduce failure on adverse, deceptive, execution, data-integrity and out-of-distribution cases?
4. At matched context/token budgets, does vP2 improve inference quality, constitutional compliance or repair burden relative to vP1?
5. Does minimal-sufficiency ablation show that vP2 contains less non-determining context per unit of performance?

---

## 10. vP2 constitution workflow

```text
1. Freeze representative intents
2. Bind constitutional constraints for each intent
3. Run Lehigh risk taxonomy → Intent Risk Fields
4. Select material vectors under an explicit threshold policy
5. Derive Repair Paths
6. Run forward TTV invariant discovery
7. Run reverse RoR invariant discovery
8. Merge + provenance-preserving compression
9. Classify ttv-only / ror-only / dual-bearing
10. Run existing validation lifecycle
11. Run minimal-sufficiency / repair-envelope ablation
12. Form Candidate Crystal vP2
13. Intrinsic readiness
14. Independent pre-freeze review
15. Operator freeze
16. Only then run vP2 experiments
```

No target invariant count SHALL be used to drive discovery. Size emerges from evidence, causal sufficiency, compression and experimental context constraints.

---

## 11. Representative-intent set

vP2 should use a deliberately heterogeneous financial intent set so the risk field can expose cross-domain causal dependencies. Candidate classes include:

- trade execution / portfolio action;
- credit or underwriting decision;
- payment / settlement;
- liquidity management;
- fraud or anomaly response;
- valuation / pricing decision;
- data-dependent financial recommendation;
- delegated financial-agent action.

The exact intents must be frozen before candidate selection begins. They should include both ordinary and stress/adverse cases but must not be authored after inspecting which invariants the process produces.

---

## 12. Lehigh dependency gate

Before vP2 constitution begins, recover and version the authoritative Lehigh artefacts:

- canonical risk-class taxonomy (expected 34 classes; verify count from source rather than encoding the recollection);
- intent-to-risk assessment method;
- risk profile / scoring semantics;
- value model;
- price model;
- any existing data-risk/value bindings.

Do not recreate missing class names from memory. If an artefact cannot be recovered, mark it explicitly `MISSING_SOURCE` and keep the vP2 workflow at design/readiness rather than silently substituting a new taxonomy.

---

## 13. Engineering slices

### Slice A — data model and pure functions

Add additive types/services, preferably adjacent to `services/invariants/discoveryEngine.ts` rather than forking the IDE:

- `IntentRiskField`
- `IntentRiskVector`
- `RepairPath`
- `DiscoveryBearing`
- risk-materiality selection
- repair-path provenance
- convergence of TTV/RoR candidate sets

Pure functions first; no UI dependency.

### Slice B — Lehigh adapter

Implement an adapter from the existing Lehigh risk assessment output into `IntentRiskField`. The adapter MUST preserve Lehigh class IDs and scoring semantics rather than duplicating them in IDE tables.

### Slice C — discovery orchestration

Extend IDE orchestration with two explicit passes and provenance tags:

```text
forward_ttv
reverse_ror
```

Candidate promotion remains governed by CFS-048. Risk relevance MUST NOT auto-canonicalize an invariant.

### Slice D — research observability

Expose, for internal IRL use:

- material risk vectors selected for an intent;
- repair paths generated;
- candidate invariants by bearing;
- dual-bearing convergence;
- unresolved risk vectors;
- ablation results;
- residual repair envelope.

This is a scientific inspection surface, not a new parallel source of truth.

### Slice E — Crystal vP2 constitution path

Add a new governed Crystal generation/configuration; do not mutate EXP-P1 vP1 rows. vP2 should carry its constitution methodology and source hashes so a reviewer can distinguish **what the Crystal contains** from **how it was discovered**.

---

## 14. Minimum receipts

Every vP2 candidate must be traceable to:

```text
intent
→ constitutional constraints
→ Lehigh risk vector(s) OR forward TTV path
→ repair path where applicable
→ evidence source(s)
→ extraction output
→ synthesis/compression decision
→ validation state
→ Crystal assignment decision
```

Absence of a risk-path relation is valid for a TTV-only candidate and must be represented as absence, not fabricated provenance.

---

## 15. vP2 evaluation design

Do not use the same observations both to constitute vP2 and to evaluate its superiority.

Recommended later comparison:

```text
Arm V1: Crystal vP1
Arm V2: Crystal vP2
```

under matched:

- task set;
- model family/version where feasible;
- context/token budget;
- tooling;
- scoring rubric;
- constitutional constraints.

Primary outcomes should include existing inference/performance measures plus:

- repair events / repair burden;
- adverse-state detection;
- false-success rate (appears successful but violates a governing condition);
- time-to-value;
- risk-of-repair expansion;
- context/compression efficiency;
- robustness on held-out risk classes or held-out adverse scenarios.

A stronger factorial can later compare `vP1`, `vP2`, flattened-vP2 statements and matched expert prose, preserving the existing programme's concern with separating invariant structure from generic context quality.

---

## 16. Falsification conditions

IDE v2 is weakened if any of the following hold under controlled testing:

1. risk-field discovery materially increases context without improving held-out performance or repair outcomes;
2. RoR-derived candidates are mostly redundant with ordinary forward discovery;
3. dual-bearing candidates show no greater stability/usefulness than single-bearing candidates;
4. the Lehigh risk field adds broad topical context rather than causally determining structure;
5. ablation shows many retained candidates can be removed without changing either outcome sufficiency or repair exposure;
6. vP2 gains disappear under matched context/token budgets.

Negative results are research results, not grounds to rewrite the frozen experimental record.

---

## 17. Immediate work order

1. **Recover Lehigh source artefacts** and verify the canonical taxonomy/count.
2. **Map Lehigh output schema** to `IntentRiskField`; do not invent a second risk ontology.
3. **Implement pure risk-field and repair-path types/functions** as additive IDE services.
4. **Add forward/reverse provenance to candidate extraction** while preserving CFS-048 lifecycle semantics.
5. **Define and freeze the representative intent set** for Crystal vP2 constitution.
6. **Run risk-field formation before vP2 candidate extraction.**
7. **Constitute Candidate Crystal vP2** using the bidirectional process.
8. **Run intrinsic readiness and independent review.**
9. **Freeze vP2 before any comparative experiment.**
10. **Preregister the vP1/vP2 comparison** so the discovery-method improvement is tested rather than narrated after the fact.

---

## 18. Naming correction

The experimental artefact is **Crystal**.

`CrysStal` is a transcription/typing error and MUST NOT be introduced into new documentation, code identifiers, experiment labels or UI. Existing historical occurrences may remain as provenance unless separately corrected through an explicit migration/editorial pass.

---

## 19. Canonical methodological statement proposed by this specification

> **Invariant discovery must search both for the conditions that produce the intended consequence and the conditions that prevent materially costly-to-repair unintended consequences. Intent supplies direction; constitutional invariants bound the permissible consequence space; risk analysis supplies bearings; structural invariants describe the causal terrain. The invariant field is the minimal causally determining overlap through which time-to-value can be collapsed without materially expanding risk-of-repair.**

This statement is **PROPOSED methodology**. The scientific claim that this method produces better invariant libraries remains falsifiable and must be tested through Crystal vP2 and subsequent controlled experiments.

---

## 20. Compatibility

This specification composes with, and does not supersede:

- **CFS-048** — Invariant Discovery Engine Charter: discovery-not-generation, evidence-first provenance, synthesis, validation and canonical lifecycle remain intact.
- **CFS-054** — Crystal Freeze Specification: vP2 must pass the same governed object/freeze discipline before experimental use.
- existing IRE/IPE/runtime architecture: IDE v2 changes how candidate invariant fields are constituted, not the constitutional rule that runtime selection and projection are downstream acts.

**Implementation principle:** compose, do not fork. Risk is a discovery bearing and a downstream projection; it is not a parallel invariant engine.
