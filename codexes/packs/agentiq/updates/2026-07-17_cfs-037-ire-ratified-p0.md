# CFS-037 / PRD-IRE-001 — the Invariant Resolution Engine: ratified + Phase 0 built

**Date:** 2026-07-17
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`
**Spec:** `codexes/packs/irl/foundation/CFS-037_invariant-resolution-engine.md`

The architecture crystallized: **resolution precedes reasoning.** The stage
*before* the engine — determining WHICH invariants matter for an intent — is now
its own constitutional runtime primitive. Operator ratified same day ("Go
straight into p0. Ratified.") and Phase 0 shipped.

## The spec (authored + ratified)

- **The split:** the **IRE** constructs the constitutional field an intent
  requires (the query-planner front-end); **CFS-035 is reframed as the
  Invariant Projection Engine (IPE)** — it projects fields, never resolves them
  (rename = its own increment; 120 refs, low code risk; CFS-035 gains a pointer).
- **Five phases:** Qualify → Resolve (Universal Invariant Library, 16 candidate
  baseline nodes, unseeded) → Expand (domain) → Calibrate (**Constitutional
  Coordinates** in three classes: structural / constitutional / operational) →
  Field Assembly (the **Resolved Constitutional Field**).
- **Code-truth reconciliation:** ~70% of the substrate already existed
  (`perception.groundFromInput` → `buildInvariantSlice` → `FieldSnapshot`);
  genuinely new = intent Qualification, the per-invariant coordinate vector,
  reuse-before-create (→ KRE). Filed as CFS-037 carrying the PRD-IRE-001
  designation (no parallel numbering).
- **Extension, not replacement** (operator directive): coordinates extend
  `IQubeScoreBlock`'s calibrated-axis+provenance pattern; the 4-C lifecycle
  (Curate/Calibrate/Consume/**Cultivate**) maps onto the existing
  `IQubeLifecycleState`; "iQube as constitutional realisation" refines, never
  supersedes, CFS-002. Naming collision with the Observatory's field
  visualization resolved by register (global field vs per-intent Resolved field).
- **Follow-on PRD family queued:** KRE (reuse→compose→create→register) · IPE
  (rename + resolved-field consumption) · CFO (coordinate observatory) · CCR
  (coordinates registry + library seeding).

## Phase 0 (built, shadow)

- **`services/invariants/resolution.ts`** — `resolveConstitutionalField(intent)`:
  the five phases composed. Qualification = v0 perception (honest keyword
  estimator); the universal pass grounds in constitutional/epistemology as the
  named proxy until the library seeds; structural coordinates derived from each
  invariant's seeded axes (confidence→verifiability, standing→evidenceDensity,
  reach→adoption) with `basis` provenance on every value; constitutional-class
  coordinates carried as **null** (they need actor context — never fabricated);
  operational coordinates (coverage / reusePotential / timeToValue) with named
  proxy bases; output marked `phase: 'p0-shadow'`.
- **First proving ground:** the Horizen pipeline's step 1 now folds the IRE
  trace line in via an optional `resolveField` dep — observe-only, gates
  nothing, fails silent to the prior detail.
- **Verified 17/17** (inlined pure-logic drill): library shape, qualification
  (extracts the ranking/standing/governance region; honest empty on nonsense),
  calibration values + bases + clamps + never-faked constitutional coords,
  operational math incl. empty-field zeros, confidence weighting, trace line.

## Honest limits

- Qualification is the v0 keyword heuristic; semantic qualification
  (embeddings/LLM) is the named drop-in. Objectives/constraints/success-criteria
  on the resolved intent are typed but null until the IntentQube extension.
- The Universal Invariant Library is **unseeded** — the universal pass is a
  named proxy; seeding + ratification is the CCR increment.
- Constitutional-class coordinates are null by design until the CCR defines
  their actor-context basis.
- Shadow-only: nothing consumes the resolved field authoritatively yet; the IPE
  consumption increment (PRD-IPE-001) is queued.
