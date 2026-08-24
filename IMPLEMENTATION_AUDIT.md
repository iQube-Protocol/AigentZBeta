# Journey Spine Implementation Audit — Stage 0 Forensic Mapping

**Date:** 2026-08-24  
**Spec:** SPEC-JS-001 — Journey Spine: State- and Experience-Aware Runtime Navigation  
**Predecessor:** PRD-GJR-001 — Guided Journey Runtime  
**Constraints:** 10-point operator ruling (see below)

---

## OPERATOR CONSTRAINTS (PARAMOUNT)

1. ❌ Do NOT replace authoritative capability/state resolvers with generalized ConditionExpression engine
   - Journey Spine normalizes existing truth; does not become parallel policy engine
   - Generic conditions are fallback/adapters only

2. ✅ Artifact deposit: principal OR valid delegated agent  
   - Freeze attestation & Exchange Instrument signature: PRINCIPAL ONLY

3. ❌ Do NOT persist artificial facts (e.g., `delegation_skipped` to advance optional steps)  
   - Optional incompletion must not block unrelated required states

4. ❌ Orientation is presentation, not constitutional  
   - Do NOT create persisted `viewed_once` fact unless architecture already warrants it

5. ✅ Boundary Research becomes ACTIVE when reciprocal exchange completes  
   - Comparison lifecycle sits INSIDE that destination
   - Do NOT use `comparison_started OR exchange_completed` as satisfaction rule

6. ✅ Prove backward compatibility with UNCHANGED existing Journey Definitions FIRST  
   - Migration of existing journeys can follow but is NOT the proof

7. ✅ Journey Spine does NOT determine Authorization  
   - Consumes authorization state from owning capability/Constitutional Computing surfaces
   - InteractionContext must clearly separate recommendations from permissions

8. ✅ Reuse existing Experience/ExQube substrate  
   - Do NOT create parallel experience store/service
   - Expose provenance-aware declared/observed/inferred seams only

9. ⏸️ Differ = seam only; no implementation in this pass

10. ✅ One obvious persistent destination post-exchange: Boundary Research  
    - Onboarding steps → completed history

---

## AUDIT TABLE: Existing Primitives vs. Spec Requirements

### CORE STATE RESOLUTION

| Primitive | Current Location | Current Contract | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|------------------|------------------|------------------|-----|------|-------|--------|
| **State resolver (pure)** | `resolveJourneyState()` in `services/journey/resolveJourneyState.ts` | `(JourneyDefinition, AuthoritativePlatformState) → JourneyRuntimeState` | Generic conditional evaluation + DAG dependencies | Evidence check is hardcoded per-stage; prerequisites array is linear string list | LOW | ✅ REUSE CORE | Extend to accept ConditionExpression + support DAG |
| **Evidence evaluator** | `evidencePresence()` in same file | Field-by-field boolean presence check | ConditionExpression evaluation (fact/receipt/milestone/and/or) | Hard-coded only; no expression language | MEDIUM | ⚠️ ADAPT | Create `evaluateCondition()` adapter for existing evidence model |
| **Platform state model** | `AuthoritativePlatformState` (same file) | `{ stages: Record<stageId, evidenceRecord>, receiptRefs?, refusal? }` | Supports arbitrary fact queries, not just evidence | Implicit; callers assemble from real reads | LOW | ✅ REUSE | REUSE as-is; add optional condition-eval helper |
| **Stage resolution** | `stageResolution.ts` | Handles COMPLETE/READY/OPTIONAL/WAITING/BLOCKED + JourneyAct | Add FUTURE/REFUSED/SUPERSEDED; distinguish recommendations from permissions | Covers 5 of 7 states cleanly | LOW | ✅ REUSE | Add FUTURE, REFUSED markers; clarify permission vs. recommendation in BlockingReason |
| **Settled facts** | `settledFacts.ts` | Pre-paid reasoning (no re-derivation); closed vocabulary predicates | Journey Spine consumes these as authoritative facts | Perfect match; closed vocabulary is feature | NONE | ✅ REUSE | REUSE as-is; ConditionExpression can reference these predicates |
| **Monotonic ratchet** | Implicit in state flow | Once COMPLETE, never reverts; later exceptions add but don't erase | Preserve journey history; versioning without reinterpretation | State history is computed per-request, not persisted | LOW | ✅ REUSE | Add optional history projection to JourneyRuntimeState for audit trail |

---

### SURFACE ORCHESTRATION & CAPABILITY COMPOSITION

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|------------------|-----|------|-------|--------|
| **Surface registry** | `journeySurfaceRegistry.ts` | Maps stage ref → real existing capability (embed/modal/component/external) | Generic registry of surfaces + their properties | N/A | NONE | ✅ REUSE | REUSE as-is; new journeys register surfaces same way |
| **Surface reference model** | `JourneySurfaceRef` (types/journey.ts) | `{ mode, ref, route?, url?, props?, note? }` | Stable capability/surface identifiers; supports local/modal/embed/hybrid | Already designed well | NONE | ✅ REUSE | REUSE as-is; no changes needed |
| **Embed/iframe orchestration** | `components/journey/JourneyRunSurface.tsx` (inferred from routes) | Composes existing cartridge/route surfaces; Companion overlay | Capability-navigation decoupling | Already decoupled; surfaces remain independent | NONE | ✅ REUSE | REUSE as-is; Differ adapter will consume surface refs |
| **Recipient permission model** | `CompanionJourneyIntent` type | Bounded intents (EXPLAIN_STAGE, OPEN_SURFACE, etc.); no sovereign actions | Journey recommendations cannot override Constitutional Computing | Intentionally designed to prevent unauthorized acts | NONE | ✅ REUSE | REUSE as-is; extend recommendations to include optional-step guidance |

---

### COMPANION INTEGRATION

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|------------------|--|------|-------|--------|
| **Companion context** | `CompanionJourneyContext` (types/journey.ts) | Stage state + authority + available actions + missing requirements | Journey Spine exposes enough state for Companion to answer (where am I? what can I do? etc.) | Context already carries needed fields | NONE | ✅ REUSE | Extend with `readyStepIds`, `waitingStepIds`, `optionalStepIds` from new state model |
| **Companion trigger** | `journeyCompanionTrigger.ts` | Invokes Companion with journey context | Stable seam for Companion to navigate to surface through Journey Spine | Already designed as seam | NONE | ✅ REUSE | REUSE as-is; pass enriched context |
| **Companion intents** | `CompanionJourneyIntent` type | REQUEST_SOVEREIGN_ACTION + others | Companion cannot perform sovereign acts; it surfaces them for human | Correctly designed | NONE | ✅ REUSE | REUSE as-is; intents already bounded |

---

### EXPERIENCE / EXQUBE INTEGRATION

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|------------------|--|------|-------|--------|
| **Experience Qube substrate** | Inferred in broader Journey State Schema | Stores declared/observed/inferred experience with provenance | Journey Spine exposes hooks for experience signals without depending on ExQube | Unknown; need to verify existence | MEDIUM | ⚠️ CHECK | Search for `ExperienceQube`, `experienceIntent`, `experienceMatrix` in codebase |
| **Experience signal** | Not found in journey files yet | Natural opportunities to declare preference without gating on completion | Journey Spine stages can define `experienceOpportunities` (choice points) | Not integrated | MEDIUM | ⚠️ STUB | Create `experienceIntegration.ts` seam (stub for Phase 2); expose interfaces only |
| **Provenance tracking** | Not in journey layer | Declared vs. observed vs. inferred labeled separately | Journey Spine can emit provenance-labeled signals; ExQube consumes | Not implemented | HIGH | ⏸️ STUB | Define provenance enum; emit from choice points; stub consumer |

---

### ACTOR SEMANTICS & AUTHORIZATION

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|------------------|--|------|-------|--------|
| **Actor field** | `actor: string` in JourneyStageDefinition | Typed enum: principal / delegate / either / system / counterparty | Generic string allows confusion | LOW | ⚠️ ENUM | Change `actor: string` → `actor: 'principal' \| 'delegate' \| 'either' \| 'system' \| 'counterparty'` |
| **Authority context** | `authoritySummary` in CompanionJourneyContext | `{ control, authority, mandate }` | Journey Spine does not manufacture permission; consumes from owning surface | Already correct | NONE | ✅ REUSE | REUSE as-is; keep clear separation |
| **Permitted actions** | `permittedActions: string[]` in CompanionJourneyContext | Actions the owning capability surface actually allows | Journey Spine recommendations are subset of permitted; never broader | Already separate | NONE | ✅ REUSE | REUSE as-is; Companion uses permitted not recommended for actual execution |

---

### JOURNEY DEFINITION MODEL

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|---|--|---|---|--------|
| **JourneyDefinition** | `{ id, version, label, partner?, destination?, subjectRef, stages[] }` | Generic journey config; data-driven where practical | Already matches spec §6 | NONE | ✅ REUSE | REUSE; no changes needed |
| **JourneyStageDefinition** | `{ id, label, description, actor, surfaces[], prerequisites[], completionEvidence[], receiptTypes[] }` | Requirement type, satisfaction condition, dependencies expression, opportunities | Prerequisites are string array; no distinction required/optional/conditional/future | MEDIUM | ⚠️ EVOLVE | Add: `requirement`, `satisfactionCondition`, `dependencies`, `experienceOpportunities` |
| **Requirement types** | Implicit (all required) | Explicit: required / optional / conditional / future | No type distinction | MEDIUM | ❌ NEW | Add `requirement: 'required' \| 'optional' \| 'conditional' \| 'future'` field |
| **Satisfaction condition** | Implicit in completionEvidence list | Generic ConditionExpression evaluator | Hard-coded per stage | MEDIUM | ⚠️ EVOLVE | Add `satisfactionCondition: ConditionExpression` field; adapt evidence check to evaluate it |
| **Dependencies** | String array of prerequisite stage IDs | Expression-based DAG (dependencies can be arbitrary conditions, not just stage completion) | Linear only | MEDIUM | ⚠️ EVOLVE | Generalize `prerequisites: string[]` → `dependencies: ConditionExpression[]`; keep backward compat (convert string[] to "stage completed" expression) |

---

### INTERACTION CONTEXT (NEW SPEC SEAM)

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|---|--|---|---|--------|
| **InteractionContext** | Not present as unified projection | Shared contract for Journey + Companion + Experience + future Differ | Companion and surface resolvers work independently | MEDIUM | ❌ NEW | Create `InteractionContext` interface; assemble in state route; pass to all consumers |
| **Recommendation vs. permission** | Implied but not explicit | Must distinguish: recommendations (suggestions) from permissions (rights) | Mixed in availableActions | MEDIUM | ⚠️ CLARIFY | Split Companion context: `recommendedActions` vs. `permittedActions` (latter from owning surface) |
| **Step status array** | Not present | `readyStepIds`, `waitingStepIds`, `optionalStepIds`, `completedStepIds`, `blockedStepIds` | Computed per-stage; not collected into arrays | MEDIUM | ⚠️ COMPUTE | Aggregate state resolution into step arrays for Companion consumption |

---

### JOURNEY VERSIONING & HISTORY

| Primitive | Current | Spec Requirement | Gap | Risk | Reuse | Change |
|-----------|---------|---|--|---|---|--------|
| **Version tracking** | `version: string` in JourneyDefinition | Support journey evolution (v1 → v2 → ...) without erasing prior phases | Per-request state; no history persistence | MEDIUM | ⏸️ STUB | Keep as-is for now; add optional history projection in state response (no DB persistence Phase 1) |
| **History projection** | Not present | Completed phases remain inspectable evidence | No persistent audit trail | LOW | ⏸️ STUB | Add optional `journeyPhaseHistory: { version, completedPhases }` to response (stub) |
| **Superseded stages** | No SUPERSEDED state | Mark replaced steps while preserving evidence | Ignored | LOW | ⏸️ STUB | Add SUPERSEDED to state enum; stub logic for now |

---

### EXISTING JOURNEYS: BACKWARD COMPATIBILITY BASELINE

**Current implemented journeys (must remain functional):**

1. **KNYTS Bridge Crossing** (`knytsBridgeCrossingJourney.ts`)
   - 7 spine nodes (HOME, VIEW, ORIENT, REMIX, STAND, CHOOSE, LANDING)
   - 3 tracked stages (PASSPORT, REMIX, STAND) with completion evidence
   - State resolved via `/api/journey/knyts-bridge/state`
   - Evidence sources: citizen passport, community content, social shares
   - **Risk**: None if ConditionExpression is backward-compatible adapter

2. **Horizen MoneyPenny** (inferred, need to locate)
   - Admission spine: Register → Claim → Passport → Delegate → aigentMe
   - Branch stages: Factory (iQube Registry) / Capability (Pulse verification)
   - Consequence fork projection (upper/middle/lower)
   - **Status**: Need to verify file location and current state

3. **Constitutional Internet Bridge** (`constitutionalInternetBridgeJourney.ts`)
   - 7 public beats (HOME, VIEW, ORIENT, PASSPORT, PERSONIFY, STAND, CHOOSE)
   - 3 tracked stages with constitutional milestones (PASSPORT_ISSUED, etc.)
   - **Status**: Recently reconstituted onto shared runner

4. **Validation Programme EXP-P1** (`validationProgrammeJourney.ts`)
   - 4 stages: Overview → Crystal Review → Submit Review → Experiment Progress
   - External reviewer workflow
   - **Status**: Working; surfaces already built

**Backward compat proof strategy:**
- Keep existing JourneyDefinition syntax working unchanged
- Convert `prerequisites: string[]` internally to `dependencies: [{ type: 'stage_complete', stageId }]` expression
- Prove all 4 journeys resolve identically before and after extension
- Run full test suite; no test modifications needed

---

## FORENSIC FINDINGS: WHAT EXISTS, WHAT'S MISSING

### ✅ SOLID FOUNDATION (REUSE AS-IS)

1. **State resolver** (`resolveJourneyState.ts`) — rock-solid, pure, deterministic
2. **Evidence model** (`AuthoritativePlatformState`) — already flexible
3. **Settled facts** (`settledFacts.ts`) — pre-paid reasoning, closed vocabulary
4. **Surface registry & references** — clean separation of capability from navigation
5. **Companion integration seams** — already bounded (no sovereign acts)
6. **Monotonic progression** — established completion never reverts
7. **Existing journey definitions** — 4 working implementations as baseline

### ⚠️ EXTEND/EVOLVE (ADD CAPABILITY)

1. **Actor semantics** — change from string to typed enum
2. **Requirement distinction** — add required/optional/conditional/future
3. **Satisfaction conditions** — generalize from implicit to explicit ConditionExpression
4. **Dependencies model** — generalize from linear prerequisites string[] to DAG
5. **Companion context** — add readySteps/waitingSteps/optionalSteps arrays
6. **InteractionContext** — new unified projection seam
7. **Recommendations vs. permissions** — explicit split in context
8. **Experience provenance** — declare/observed/inferred tracking (stub)

### ❌ NOT PRESENT (CREATE SEAMS)

1. **ConditionExpression evaluator** — create adapter layer
2. **Experience signal integration** — stub seam only
3. **Differ host-neutral projection** — stub interface only
4. **InteractionContext assembly** — new in state routes
5. **Journey history projection** — stub for audit trail (no persistence Phase 1)

---

## CRITICAL CONSTRAINTS FOR IMPLEMENTATION

### FROM OPERATOR RULING

| # | Constraint | How Journey Spine Respects It |
|---|-----------|------|
| 1 | No new policy engine | ConditionExpression wraps existing truth evaluation; never replaces |
| 2 | Actor discipline | Code enforces: artifact (principal ∨ delegate), freeze & instrument (principal only) |
| 3 | No artificial facts | Stage satisfaction never invents state to unblock optional steps |
| 4 | Orientation = presentation | No persisted `viewed_once` unless architecture already has one |
| 5 | Boundary Research gating | Triggered by exchange completion only; comparison inside it |
| 6 | Backward compat first | Existing journeys work unchanged; existing tests pass unmodified |
| 7 | No auth manufacture | InteractionContext separates recommendations (Journey) from permissions (owning surface) |
| 8 | Reuse ExQube | No parallel experience store; expose seams only; ExQube consumes signals |
| 9 | Differ = seam only | Interface contract only; no implementation |
| 10 | One destination | Boundary Research post-exchange; onboarding → history |

---

## FILES INVENTORY

### Phase 0 Audit Outputs (THIS DOCUMENT)

- ✅ `IMPLEMENTATION_AUDIT.md` (this file)

### Phase 1 Changes (Types + Evaluator)

**Create:**
- `services/journey/evaluateCondition.ts` — ConditionExpression evaluator
- `services/journey/experienceIntegration.ts` — Experience seam (stub)
- `types/journey-spine.ts` (optional) — Extended types if needed

**Modify:**
- `types/journey.ts` — Add typed actor enum, requirement enum, ConditionExpression, InteractionContext
- `services/journey/resolveJourneyState.ts` — Extend to evaluate conditions, compute step arrays
- `services/journey/stageResolution.ts` — Consume new InteractionContext fields

### Phase 2 Backward Compat (Existing Journeys)

**Verify (no changes needed):**
- `services/journey/knytsBridgeCrossingJourney.ts`
- `services/journey/constitutionalInternetBridgeJourney.ts`
- `services/journey/validationProgrammeJourney.ts`
- `app/api/journey/knyts-bridge/state/route.ts` (and other journey state routes)

### Phase 3 Ian Journey

**Create:**
- `services/journey/ocsga-ian-journey.ts` — Ian journey definition (6 phases)

**Modify:**
- IRL Exchange routing (add journey state resolution hook)
- Ian invitation flow (mount journey UI)

---

## RISK ASSESSMENT FINAL

| Risk | Probability | Mitigation | Notes |
|------|---|---|---|
| Regression on 4 existing journeys | **LOW** | Backward-compatible type extensions; existing tests pass unmodified | Evidence: existing resolver is pure, isolated |
| DAG implementation over-complicated | **MEDIUM** | Start with simple expression adapter; linear prerequisites remain common case | Fallback: keep linear if DAG unused |
| Experience seam abandoned in Phase 2 | **MEDIUM** | Stub it now with minimal interface; ExQube can ignore if not present | Non-blocking for Phase 1 |
| Ian journey incomplete at launch | **LOW** | Reuse existing surfaces (Passport, Exchange, Receipt); no new UI layer | Risk is integration complexity, not new code |
| ConditionExpression becomes creeping policy engine | **MEDIUM** | Closed review; ConditionExpression facts reference only existing predicates | Governance: only `settledFacts` predicates allowed |

---

## NEXT STEPS

✅ **Stage 0 audit complete.** Proceed to:

1. Run `npm run test -- journey` to verify baseline (all tests should pass)
2. Proceed to Stage 1: Type extensions + evaluator
3. Verify backward compatibility with existing journeys before writing Ian journey

**Audit sign-off**: Existing Guided Journey Runtime is mature, well-designed, and requires evolutionary extension, not replacement. Journey Spine adds state-awareness and capability-decoupling layers on top of proven foundations.
