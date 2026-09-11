# Stage 1 Implementation Plan — Journey Spine Generic Core

**Date:** 2026-08-24  
**Status:** Ready for implementation  
**Predecessor:** IMPLEMENTATION_AUDIT.md (Stage 0)  
**Reference:** SPEC-JS-001 (Journey Spine specification)

---

## Overview

Stage 1 builds the smallest backward-compatible Journey Spine runtime capable of supporting multiple journey definitions without duplicating capability logic.

The implementation strictly observes the 10 operator constraints from Stage 0, especially:
1. ConditionExpression is adapter-only, NOT a policy engine
2. All authoritative state flows from existing sources (settledFacts, receipts, etc.)
3. Backward compatibility proven first on existing journeys
4. InteractionContext clearly separates recommendation from authorization

---

## Key Constraints Governing This Stage

| # | Constraint | Implementation Impact |
|---|---|---|
| 1 | No generalized policy engine | ConditionExpression evaluator maps conditions to authoritative sources; never manufactures permission |
| 2 | Actor semantics (principal vs delegate) | Extend `actor` enum; freeze/instrument signatures remain principal-only |
| 3 | No artificial facts | Don't persist delegation_skipped or viewed_once unless architecture already requires it |
| 4 | Orientation is presentation, not constitutional | No new persisted orientation_ritual_completed fact |
| 5 | Boundary Research ACTIVE after exchange | Use exchange_completed as trigger, not comparison_started |
| 6 | Prove backward compatibility first | Existing 4 journeys run unchanged before any are migrated |
| 7 | Authorization consumed, not created | InteractionContext exposes permissions from owning surface, never manufactures them |
| 8 | Reuse Experience/ExQube substrate | Expose declared/observed/inferred seams only; no parallel experience store |
| 9 | Differ = seam only | No implementation; only interface stub |
| 10 | One destination post-exchange | Boundary Research is persistent next step, not throwaway completion screen |

---

## Deliverables for Stage 1

### 1. Type Extensions — `types/journey.ts`

Add to existing JourneyDefinition/JourneyStageDefinition:

```typescript
// New enums
export enum ActorRole {
  PRINCIPAL = 'principal',
  DELEGATE = 'delegate',
  EITHER = 'either',
  SYSTEM = 'system',
  COUNTERPARTY = 'counterparty',
}

export enum StepRequirement {
  REQUIRED = 'required',
  OPTIONAL = 'optional',
  CONDITIONAL = 'conditional',
  FUTURE = 'future',
}

export enum StepState {
  COMPLETE = 'complete',
  READY = 'ready',
  OPTIONAL = 'optional',
  WAITING = 'waiting',
  BLOCKED = 'blocked',
  FUTURE = 'future',
  REFUSED = 'refused',
  SUPERSEDED = 'superseded',
}

// Condition expression (generic, adapter-only)
export type ConditionExpression = {
  type: 'settled-fact' | 'receipt' | 'composite' | 'boolean'
  value?: string // field name / receipt type
  operator?: 'and' | 'or' | 'not'
  operands?: ConditionExpression[]
}

// Enhanced stage definition
export interface JourneyStageDefinition {
  // Existing fields preserved
  id: string
  label: string
  description: string
  actor: string // EXTEND to use ActorRole enum; preserve as string for backward compat
  subjectRef: string
  surfaces: JourneySurfaceRef[]
  prerequisites: string[] // Keep existing; also add satisfactionCondition
  permittedActions: string[]
  completionEvidence: string[] // Keep existing; also add satisfactionCondition
  receiptTypes: string[]
  companion: { before: string; during?: string; complete: string; refused?: string }

  // New fields
  requirement?: StepRequirement // 'required' | 'optional' | 'conditional' | 'future'
  satisfactionCondition?: ConditionExpression // Generic condition evaluator
  dependencies?: ConditionExpression[] // DAG support (vs. linear prerequisites)
  actorRole?: ActorRole // Explicit actor typing (principal vs delegate)
  receiptsScopedToSubjectAgent?: boolean // Existing, keep
  milestone?: JourneyMilestone // Existing, keep
  forkPosition?: 'upper' | 'middle' | 'lower' // Existing, keep
  branch?: 'factory' | 'capability' // Existing, keep
  nextStageId?: string // Existing, keep
}

// Experience intent projection
export interface ExperienceIntentProjection {
  declaredPreferences?: Record<string, unknown>
  observedBehavior?: Record<string, unknown>
  inferredPreferences?: {
    preference: Record<string, unknown>
    confidence: number
    rationale: string
  }[]
  provenance: {
    declared: string[] // sources
    observed: string[] // event types / behavior signals
    inferred: string[] // inference rule ids
  }
}

// Interaction context (mutual awareness without coupled authority)
export interface InteractionContext {
  participantRef: string
  personaRef?: string
  journeyId: string
  journeyVersion: string
  currentStageId: string
  targetStageId: string
  readyStageIds: string[]
  completedStageIds: string[]
  waitingStageIds: string[]
  blockedStageIds: string[]
  optionalStageIds: string[]
  
  // Explicitly separate recommendation from authorization
  availableCapabilities: string[] // What surfaces exist
  requiredConditions: ConditionExpression[] // What must be true
  authorityContext?: {
    permitted: boolean
    reason?: string
    principalRequired?: boolean
    delegateMayAssist?: boolean
  }
  delegationContext?: {
    active: boolean
    agentId?: string
    scope?: string
  }
  
  // Experience (distinct signals)
  experienceIntent?: ExperienceIntentProjection
  
  // Recommendations (clearly labeled)
  recommendedNextActions?: string[]
  
  // Companion seam
  companionGuidance?: {
    currentPhase: string
    explanation: string
    nextSteps?: string[]
  }
  
  // Presentation hints (for future Differ)
  presentationHints?: {
    layout?: 'linear' | 'dag' | 'graph'
    density?: 'compact' | 'normal' | 'detailed'
    mode?: 'modal' | 'embedded' | 'cartridge'
  }[]
}

// Journey phase for versioning/history
export interface JourneyPhase {
  version: string
  activeSince: string
  title: string
  stageIds: string[]
  completionCondition: ConditionExpression
  supersededBy?: string
}

export interface JourneyRuntimeState {
  // Existing fields preserved
  journeyId: string
  journeyVersion: string
  subjectRef: string
  currentStageId: string
  stages: JourneyStageRuntimeState[]
  complete: boolean

  // New fields
  phases: JourneyPhase[] // Versioning/history
  targetStageId?: string // Declared destination
  lastUpdateAt?: string // When state changed
  interactionContext?: InteractionContext // Mutual awareness projection
}
```

### 2. Condition Evaluator — `services/journey/conditionEvaluator.ts`

```typescript
// Evaluate ConditionExpression against authoritative state
// Maps conditions to existing sources (settledFacts, receipts, etc.)
// Never manufactures permissions
export function evaluateCondition(
  condition: ConditionExpression,
  authoritativeState: AuthoritativePlatformState
): boolean

// Validate that a condition doesn't manufacture permission
export function validateConditionIsNonAuthoritativeAdapter(
  condition: ConditionExpression
): { valid: boolean; reason?: string }
```

Key principle: The evaluator is a **bridge to existing truth sources**, not a new policy engine.

### 3. Extended State Resolver — `services/journey/resolveJourneyState.ts`

Update the existing function to:

1. **Accept satisfactionCondition alongside completionEvidence**
   - If both exist: evaluate satisfactionCondition first (preserve evidence-first order)
   - For backward compat: empty satisfactionCondition means use completionEvidence as before

2. **Support dependency graph (DAG) not just linear prerequisites**
   - Evaluate all dependencies for each stage
   - Preserve the `prerequisites: string[]` array for backward compat
   - Add optional `dependencies: ConditionExpression[]` evaluation

3. **Distinguish stage requirement types**
   - `required`: COMPLETE or IN_PROGRESS or READY, never OPTIONAL or FUTURE
   - `optional`: may be OPTIONAL or FUTURE even if dependencies satisfied
   - `conditional`: treated as required if its condition is true, optional otherwise
   - `future`: always FUTURE unless explicitly activated

4. **Preserve existing resolution order**
   - Evidence presence → COMPLETE (existing, unchanged)
   - Prerequisites check → BLOCKED if unmet (existing, enhanced)
   - Surface/capability availability
   - Actor/authority availability
   - DEFAULT: READY or OPTIONAL based on requirement type

### 4. Interaction Context Assembly — `services/journey/interactionContextAssembly.ts`

Build the bounded shared projection:

```typescript
export function assembleInteractionContext(
  journey: JourneyDefinition,
  state: JourneyRuntimeState,
  authorityContext: AuthorityProjection,
  experienceIntent?: ExperienceIntentProjection
): InteractionContext
```

Explicitly separate:
- `availableCapabilities` (what surfaces exist)
- `requiredConditions` (what must be true for progression)
- `authorityContext.permitted` (am I allowed? from owning capability, not from Journey Spine)
- `recommendedNextActions` (what I suggest, vs. what you can do)

### 5. Journey Phase/History Support

Extend `JourneyRuntimeState` with `phases: JourneyPhase[]` to track versioning:

```typescript
// v1 → v2 → v3 → v4 → v5 progression
// Each phase shows its own stages; completed phases remain visible
// No silent reinterpretation of completed evidence
```

### 6. Backward Compatibility Adapters

For the 4 existing journeys, create lightweight mapping functions that:
- Accept existing `JourneyDefinition` (string[] prerequisites, string[] completionEvidence)
- Create equivalent `satisfactionCondition` and `dependencies` expressions
- Preserve all existing test behavior
- Never modify the existing journey objects themselves

```typescript
export function adaptLegacyJourneyDefinition(
  legacyDef: JourneyDefinition
): JourneyDefinition
// Returns a new def with satisfactionCondition computed from completionEvidence
// prerequisites mapped to dependencies
// requirement types inferred from completion semantics
```

---

## Implementation Order

1. **Extend types** — add new enums/interfaces without breaking existing ones
2. **Create evaluator** — ConditionExpression bridge to authoritative sources
3. **Enhance resolver** — update state resolution with new semantics
4. **Assemble context** — InteractionContext projection
5. **Phase support** — versioning/history infrastructure
6. **Test backward compat** — run existing tests; adapt journeys if needed
7. **Verify no regressions** — all 4 existing journeys pass

---

## Testing Strategy

### Backward Compatibility Baseline

Before writing new functionality, establish baseline:

```bash
# Existing tests that MUST pass unchanged
npm run test -- journey-admission-spine
npm run test -- journey-companion-trigger
npm run test -- constitutional-internet-bridge-journey
npm run test -- validation-programme-journey
# And all other journey-* tests
```

### New Tests (Post-Implementation)

1. **Condition evaluator**
   - Evaluate settled fact conditions
   - Evaluate receipt conditions
   - Composite (and/or/not) conditions
   - Validation that conditions don't manufacture permissions

2. **DAG dependencies**
   - Parallel optional steps don't block required ones
   - Diamond dependencies resolve correctly
   - Circular dependencies caught/reported

3. **Interaction context**
   - Recommendation vs. authorization clearly separated
   - Authority context from owning surface, not Journey Spine
   - Experience seams properly exposed but optional

4. **Phase progression**
   - Journey v1 → v2 maintains history
   - No silent reinterpretation of completed evidence
   - Completed phases remain visible

---

## Files Created/Modified

### New Files
- `services/journey/conditionEvaluator.ts`
- `services/journey/interactionContextAssembly.ts`
- Test files for new functionality

### Modified Files
- `types/journey.ts` — add new types (backward compatible)
- `services/journey/resolveJourneyState.ts` — enhance (backward compatible)
- Journey definitions (lightweight adapters, no rewrites)

### Unchanged
- All existing journey definitions (reuse as-is)
- Surface registry
- Settled facts
- Companion integration
- Receipt machinery

---

## Non-Goals for Stage 1

- ❌ Experience Guide / Experience Matrix implementation (seam only)
- ❌ Differ rendering engine (seam only)
- ❌ Adaptive journey branches (future versioning support prepared)
- ❌ Multi-party journeys (fan-out prepared, not implemented)
- ❌ Ian journey definition (Stage 3)

---

## Success Criteria

✅ All existing journey tests pass unchanged  
✅ No breaking changes to existing JourneyDefinition files  
✅ ConditionExpression evaluator maps to authoritative sources only  
✅ InteractionContext clearly separates recommendation from permission  
✅ Dependency graph (DAG) demonstrated with test case  
✅ Actor semantics (principal vs delegate) properly typed  
✅ Phase/history infrastructure in place  
✅ Companion seam documented and available  
✅ Differ seam documented but not implemented  

---

## Next: Stage 2

After Stage 1 acceptance, Stage 2 will:
- Migrate at least one existing journey (e.g., Horizen MoneyPenny)
- Demonstrate backward compatibility through migration
- Prepare for Stage 3 (Ian journey definition)
