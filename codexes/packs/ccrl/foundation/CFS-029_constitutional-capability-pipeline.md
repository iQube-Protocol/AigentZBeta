# CFS-029 — The Constitutional Capability Pipeline (completion)

**Chrysalis Foundation Specification · v1.0 · Status: ADOPTED by operator direction 2026-07-13; core increments built same day.**
Companions: CFS-015 (the pipeline's PRD — this spec completes its constitutional lifecycle), CFS-016 (deployment), CFS-025 (Artifact Runtime), CS-001 (the grounding case study).

## 1. The threshold this spec marks

Until now the Capability Pipeline prepared better *instructions for implementation*. With this spec it **reasons constitutionally about capability before implementation**: the pack is no longer the end of the reasoning process but one artifact within it. Operator framing, adopted verbatim as the design intent:

> "Here's what constitutional capability should emerge" — not "here's what Claude should build."

## 2. The completed stage sequence

```
IntentQube
   ↓
ContextPack
   ↓
CapabilityGapReport        (the DCC Gap Analysis — existing/missing/reuse)
   ↓
CapabilityEvidence         ← PERSISTED constitutional primitive (evidence outlives sessions)
   ↓
ConsequenceCanvas
   ↓
Constitutional Decision    ← explicit: HOW is the capability realized? (nine mechanisms + 'none')
   ↓
Implementation Pack        (one artifact of the reasoning, not its terminus)
```

## 3. Capability Evidence — evidence persists; sessions don't

`SessionFindings` (the transport object of the 2026-07-13 workflow-gap fix) is re-homed as **CapabilityEvidence**, a first-class persisted primitive:

- Leaf module `services/constitutional/capabilityEvidence.ts` (type + pure folding helpers + store; legacy `SessionFindings` aliases retained).
- Table `capability_evidence` (migration `20260713010000`): keyed by a one-way goal hash — T2-safe, capability facts only, no subject identifiers.
- Pack generation **persists** fresh evidence and **reads persisted evidence back** when none is supplied — a pack generated outside the originating session still knows what exists. A constitutional pipeline never "forgets" constitutional state between stages (the CS-001 defect class, eliminated).
- The pack carries `capabilityEvidence` + `capabilityEvidenceId` (the durable pointer).

## 4. The Constitutional Decision stage

Before any pack is drafted, `decideRealizationMechanism(goal, evidence)` explicitly decides **how the capability should be realized**, over the vocabulary:

`none` (capability exists — compose, build nothing) · `code` · `configuration` · `registry` · `prompt` · `policy` · `schema` · `knowledge` · `automation` · `documentation`

- Two-tier: LLM decision through the constitutional router (`callStage 'capability'`), with a PURE deterministic floor (`heuristicDecision`, canary-pinned) that never fabricates.
- The decision is recorded ON the pack (`constitutionalDecision`: mechanism, `noBuildRequired`, rationale, alternatives weighed, decidedBy) — auditable, never implicit.
- The decided mechanism is authoritative over the draft's; a `none` decision empties `areasToTouch` and instructs the draft to plan **composition, not construction**.
- Sometimes the answer is *no code required* — that is what makes this a **capability** pipeline.

## 5. Constitutional semantics (renames)

Pack renders now say **Constitutional Validation** and **Constitutional Receipt** (was: Validation plan / Receipt plan) — these are constitutional evidence, not implementation artifacts. Internal field names (`validationPlan`, `receiptPlan`) are unchanged (extend, don't break).

## 6. Classification: Constitutional Blindness

`empty-canon` is reclassified from *defect* to **Constitutional Blindness**: the reasoning pipeline running ahead of the constitutional knowledge graph. Resolved separately the same day (seed advancement `proposed → validated`, 12-namespace widening). The healthy reading stands: implementation capability should never wait for the canon, and the canon should catch up — visibly.

## 7. Follow-ons (each its own ratification)

1. **DCC "Decision" stage capsule** — surface the Constitutional Decision as a first-class ICE stage in the Dev Command Center strip (today it renders inside the pack).
2. **CapabilityEvidence as a full ConstitutionalObject** — standing, lifecycle, provenance receipts (today: durable row + pack pointer).
3. **Evidence freshness policy** — when persisted evidence is stale relative to the capability graph (CFS-028), prompt for a re-inventory instead of grounding on it silently.
4. **CS-001 formal publication** through the CPS when the operator schedules it.

## Ratification record

- [x] **ADOPTED 2026-07-13 by operator direction** (the "three things happening" review). Built same day: CapabilityEvidence primitive + store + migration, Constitutional Decision stage (LLM + pure floor + canary), pack fields + markdown sections, semantic renames, CS-001 case study.
- [ ] Follow-ons §7.1–7.4 — separately ratified.
