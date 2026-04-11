# metaMe Experience Framework v1

**Status:** canonical  
**Authority:** product owner  
**Last updated:** 2026-04-06

---

## Purpose

The metaMe Experience Framework is the canonical architecture for defining, orchestrating, and evolving experiences across the AgentiQ ecosystem.

It answers four core questions:

1. What is the intended experience outcome?
2. What assets and levers are available to deliver it?
3. How should those assets and levers be orchestrated across moments and journeys?
4. How should the system respond as users progress, regress, participate, or contribute?

This is not a sector-specific model. It is a canonical meta-framework that can be semantically rendered for: individuals, organizations, communities, sectors, cartridges, and specific entities.

---

## Design principles

### 1. Macro intent, micro moments

Every experience is composed of:

- **Macro experience intent** — the higher-order outcome or transformation being pursued
- **Micro experience moments** — touchpoints, prompts, interactions, pathways, and interventions that move a person toward that intent

The framework decides: which micro moments matter, for which person, in which state, at which moment, in service of which macro intent.

### 2. State transition is the core unit

Experiences are designed around state movement, not just journeys.

Examples:
```
confusion → clarity
disengagement → curiosity
distrust → cautious openness
passive use → active curation
curation → remix
remix → creation
creation → contribution
```

### 3. Canonical structure, dynamic semantics

The architecture is stable. The language and rendering adapt. The same canonical framework renders differently for media, healthcare, government, education, finance, transportation, individual self-direction, or organization-led delivery.

### 4. Lens-aware by design

Active lenses:
- **Individual lens** — self-direction, personal goals, personal sovereignty
- **Organization lens** — orchestration, delivery, user experience design

Optional future lens: Community / Network lens.

### 5. Policy and signal are first-class

The framework explicitly supports:
- Policy/perimeter boundaries
- Role-based progression
- Permissions and trust conditions
- Signal capture
- Reward/response logic
- PCS movement

---

## Framework structure

Four primary blocks:

```
1. Experience Strategy   — what are we trying to do and why
2. Experience Model      — what assets and levers exist to deliver it
3. Experience Matrix     — how to orchestrate state transitions through moments
4. Experience Ladder     — how progression in agency and contribution works
```

Two cross-cutting layers:

```
+ Governance / Policy Overlay   — who can do what, what is gated, what is trusted
+ Semantic Rendering Layer      — how canonical structure adapts to context
```

---

## 1. Experience Strategy

Defines the top-level intent of the experience.

### Required fields

| Field | Description |
|-------|-------------|
| `lens` | individual \| organization \| community |
| `what` | the core experience objective |
| `why` | the reason this objective matters |
| `who` | intended subject, audience, or beneficiary |
| `when` | context, trigger, timing, or moment |
| `success` | desired outcome or signal proving success |
| `macro_intent` | higher-order transformation or destination |

### Optional fields

`constraints`, `priority`, `time_horizon`, `risk_sensitivity`, `trust_requirement`, `sector`, `cartridge`, `entity`

Experience Strategy is the governing brief for all downstream design and orchestration.

---

## 2. Experience Model

Defines the assets, levers, and capabilities available to deliver the strategy.

### Structural tier — the hard operating components

`products`, `services`, `utilities`, `channels`, `content`, `data`

This is the inventory of usable experience infrastructure.

### Emotional tier — the relational and motivational layer

`personalization`, `loyalty`, `purpose`, `trust_levers`

This is how the experience becomes meaningful, sticky, identity-aligned, and credible.

### Transactional tier — the exchange and incentive layer

`commerce`, `rewards`, `tokenomics`

This is how value exchange, participation incentives, contribution incentives, and economic progression work.

---

## 3. Governance / Policy Overlay

Cross-cutting overlay on Strategy, Model, Matrix, and Ladder.

Defines: who can see what, who can do what, what is allowed, what is gated, what is trusted, what is disclosed, what must be earned or verified.

### Fields

`role_permissions`, `access_rules`, `trust_requirements`, `disclosure_rules`, `identity_requirements`, `contribution_requirements`, `reward_eligibility_rules`, `transition_conditions`, `risk_controls`

This is the architectural expression of **policy as perimeter** inside the experience system.

---

## 4. Experience Matrix

The state-and-moment orchestration layer. Defines how available assets and levers should be used to move a person from one state to another at the right moment.

### Context fields
`lens`, `sector`, `cartridge`, `entity`, `macro_intent_supported`

### State fields
`entry_state`, `target_state`, `trust_state`, `motivation_state`, `polarity`

### Moment fields
`journey_moment`, `trigger`, `timing_context`

### Orchestration fields
`active_structural_levers`, `active_emotional_levers`, `active_transactional_levers`, `active_governance_rules`

### Signal / response fields
`signal_to_capture`, `signal_meaning`, `system_response`, `reward_effect`, `permission_effect`

### Progression fields
`pcs_movement`, `next_best_steps`, `fallback_steps`, `recovery_steps`

### Negative entry states

The matrix must explicitly support negative and adverse entry states:
curious, neutral, confused, anxious, dissatisfied, skeptical, disinterested, scornful, critical, distrustful, hostile, burned/failed-before.

Many users enter from damaged trust, low belief, or active negativity.

### Matrix archetypes (reusable)

```
awareness → trust
awareness → patronage
participation → loyalty
participation → contribution
engagement → endorsement
dissatisfaction → repair
distrust → cautious openness
utility → habit
learning → mastery
creator → contributor
contributor → steward
```

Cartridges instantiate these archetypes in their own semantic language.

---

## 5. Experience Ladder

Defines progression through increasing agency, participation, sovereignty, and contribution.

The longitudinal spine connecting moments, journeys, permissions, and contributor pathways.

### Abstract canonical ladder

```
Recipient → Selector → Modifier → Producer → Builder → Steward
```

### metaMe default rendered ladder

```
Consumer / Citizen → Curator → Remixer → Creator → Developer → Correspondent
```

### Semantic rendering examples

| Context | Ladder |
|---------|--------|
| KNYT | Observer → Collector → Curator → Remixer → Creator → Correspondent → Steward |
| Healthcare | Patient → Organizer → Self-advocate → Care contributor → Care designer → Community health steward |
| Government | Citizen → Navigator → Participant → Contributor → Service co-designer → Civic steward |
| PCS (AgentiQ) | Participant → Community → Correspondent → Operator → Creator → Upstream contributor |

### Ladder usage

Supports: current stage detection, recommended next stage, permitted actions at each stage, unlock conditions, signal thresholds, reward and contribution pathways.

---

## 6. Semantic Rendering Layer

Allows the same canonical architecture to be rendered differently depending on context.

Render scopes: `lens`, `sector`, `cartridge`, `organization`, `user segment`, `persona`

The architecture remains stable. The language adapts.

---

## Individual vs Organization lens

| Block | Individual | Organization |
|-------|-----------|-------------|
| Strategy: Who | Me, my family, my team, my community | Target audience, customer, patient, learner, citizen |
| Strategy: Success | Agency, clarity, progress, meaningful contribution | Adoption, satisfaction, trust, engagement, conversion |
| Model: Structural | What I can use | What we can deploy |
| Model: Emotional | What keeps me aligned, motivated, committed | What creates trust, belonging, loyalty for users |
| Model: Transactional | How I earn, spend, exchange, or get rewarded | How the org structures commerce, rewards, incentives |
| Matrix: Entry state | My emotional/motivational/trust state | User segment or journey-state condition |
| Matrix: PCS/Ladder | My progression in agency, capability, contribution | Org's model for helping users progress |
| Governance | What I am allowed or ready to access/do | What different user roles may access or unlock |
| Signals | What my actions reveal about my needs, growth | What behavior reveals about product fit, demand, trust |

---

## How this lives in the stack

### metaMe Cartridge / Codex (canonical home)

The metaMe Cartridge holds:
- The master Experience Framework
- Canonical ladder and matrix archetypes
- Individual and organization lens logic
- Dynamic semantic rendering logic
- Next-best-pathway logic
- User-specific experience state and progression

### Cartridge-specific packs (derived from master)

Each cartridge derives its own experience pack from the master framework. Example for KNYT:

```
KNYT Experience Strategy
KNYT Experience Model
KNYT Experience Matrices (Patronage Axis × PCS Axis)
KNYT Ladder render (Observer → Franchise-aligned Sovereign Contributor)
KNYT Signal layer
KNYT Reward logic
KNYT Contributor progression logic
```

Relationship: **metaMe = master grammar. Cartridge = context-specific implementation.**

---

## Canonical shorthand

> Experience Strategy defines the macro intent. Experience Model defines the available levers. Experience Matrix orchestrates state transitions through moments and touchpoints. Experience Ladder governs progression in agency and contribution. metaMe renders all of this dynamically through lens, sector, cartridge, and user context.

---

## Related documents

- `METAME_EXPERIENCE_SCHEMAS.md` — canonical v1 schemas for Strategy, Model, Matrix, Ladder
- `METAME_EXPERIENCE_LADDER.md` — ladder detail with canonical + rendered forms
- `docs/agent-harness/journey-state-schema.md` — JourneyState, ExperienceModel/Matrix, NBEPlan interfaces + SQL
- `docs/alpha/build-plan.md` — WS5 metaMe sovereignty alignment workstream
