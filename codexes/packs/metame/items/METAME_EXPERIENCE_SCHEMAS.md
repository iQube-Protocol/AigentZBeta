# metaMe Experience Framework — Canonical Schemas v1

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

These are the v1 schemas for stack codification. All cartridge experience packs derive from these.

---

## Experience Strategy schema

```yaml
experience_strategy:
  lens: individual | organization | community
  what: string                    # core experience objective
  why: string                     # reason this objective matters
  who: string | list              # subject, audience, or beneficiary
  when: string                    # context, trigger, or timing
  success: string | list          # desired outcome or proving signal
  macro_intent: string            # higher-order transformation/destination
  # Optional
  sector: optional string
  cartridge: optional string
  entity: optional string
  constraints: optional list
  priority: optional string
  time_horizon: optional string
  risk_sensitivity: optional string
  trust_requirement: optional string
```

---

## Experience Model schema

```yaml
experience_model:
  structural:
    products: list
    services: list
    utilities: list
    channels: list
    content: list
    data: list

  emotional:
    personalization: list
    loyalty: list
    purpose: list
    trust_levers: list

  transactional:
    commerce: list
    rewards: list
    tokenomics: list

  governance_overlay:
    role_permissions: list
    access_rules: list
    trust_requirements: list
    disclosure_rules: list
    transition_conditions: list
```

---

## Governance / Policy Overlay schema

```yaml
governance_overlay:
  role_permissions: list          # who can do what
  access_rules: list              # what is visible to whom
  trust_requirements: list        # thresholds to access gated content/actions
  disclosure_rules: list          # what must be surfaced
  identity_requirements: list     # identity checks required
  contribution_requirements: list # what qualifies a contribution
  reward_eligibility_rules: list  # what earns rewards
  transition_conditions: list     # conditions for stage transitions
  risk_controls: list             # safeguards
```

---

## Experience Matrix schema

```yaml
experience_matrix:
  # Context
  lens: individual | organization | community
  sector: optional string
  cartridge: optional string
  entity: optional string
  macro_intent_supported: string

  # State
  entry_state: string             # see negative states below
  target_state: string
  trust_state: string
  motivation_state: string
  polarity: positive | neutral | negative

  # Moment
  journey_moment: string
  trigger: string
  timing_context: string

  # Orchestration
  active_structural_levers: list
  active_emotional_levers: list
  active_transactional_levers: list
  active_governance_rules: list

  # Signal / Response
  signal_to_capture: list
  signal_meaning: list
  system_response: list
  reward_effect: optional string
  permission_effect: optional string

  # Progression
  pcs_movement: optional string
  next_best_steps: list
  fallback_steps: optional list
  recovery_steps: optional list
```

### Valid negative entry states

`curious | neutral | confused | anxious | dissatisfied | skeptical | disinterested | scornful | critical | distrustful | hostile | burned`

### Canonical matrix archetypes

```
awareness → trust
awareness → patronage
participation → loyalty
participation → contribution
engagement → endorsement
dissatisfaction → repair
distrust → cautious_openness
utility → habit
learning → mastery
creator → contributor
contributor → steward
```

---

## Experience Ladder schema

```yaml
experience_ladder:
  # Canonical abstract form
  canonical_levels:
    - Recipient
    - Selector
    - Modifier
    - Producer
    - Builder
    - Steward

  # Context-specific rendered form
  rendered_levels:
    cartridge_or_sector_specific: list

  # User-specific state
  current_level: optional string
  target_level: optional string
  unlock_conditions: optional list
  reward_conditions: optional list
  contribution_conditions: optional list
```

### Rendered ladder instances

| Context | Levels |
|---------|--------|
| **Canonical abstract** | Recipient → Selector → Modifier → Producer → Builder → Steward |
| **metaMe default** | Consumer/Citizen → Curator → Remixer → Creator → Developer → Correspondent |
| **PCS (AgentiQ)** | Participant → Community → Correspondent → Operator → Creator → Upstream contributor |
| **KNYT** | Observer → Collector → Curator → Remixer → Creator → Correspondent → Steward → Franchise-aligned |
| **Healthcare** | Patient → Organizer → Self-advocate → Care contributor → Care designer → Community health steward |
| **Government** | Citizen → Navigator → Participant → Contributor → Service co-designer → Civic steward |

---

## Journey state fields (stack implementation)

These fields map to the `journey_states` Supabase table (created in `supabase/migrations/20260402000000_experience_model_journey_state.sql`):

```yaml
journey_state:
  persona_id: uuid
  stage: prospect | acolyte | keta | keji | first | zero            # + investor | collector | creator variants
  depth: integer                                                      # position in experience_matrices.depth_ladder
  goals: list
  blockers: list
  investment_status: string
  active_strategy_id: uuid                                            # → experience_strategies
  active_model_id: uuid                                               # → experience_models
  active_matrix_id: uuid                                              # → experience_matrices
  nbe_plan_id: uuid                                                   # → nbe_plans
```

---

## NBE Plan fields

```yaml
nbe_plan:
  persona_id: uuid
  disposition: ask | act | wait | escalate | deny
  next_experience: string
  depth_step: integer
  rationale: string
  receipt_eligible: boolean
```

---

## Frozen principles before stack codification

**A. Strategy always includes:**
lens, what, why, who, when, success, macro_intent

**B. Matrix always includes:**
entry_state, target_state, journey_moment, active levers (structural + emotional + transactional), signal_to_capture, system_response, next_best_steps, pcs_movement (if applicable)

**C. Negative states are always valid entry points** — no positive-funnel assumption

**D. Ladder remains canonical, rendered language is dynamic** — avoids hardwiring one sector's semantics

**E. Governance overlay is always present** — even if lightweight
