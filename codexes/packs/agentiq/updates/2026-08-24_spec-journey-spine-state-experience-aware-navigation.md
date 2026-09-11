# SPEC-JS-001 — Journey Spine: State- and Experience-Aware Runtime Navigation

**Status:** IMPLEMENTATION SPECIFICATION — evolution of the existing Guided Journey Runtime, not a parallel framework  
**Date:** 2026-08-24  
**Initial deployment:** OCSGA × Constitutional Computing / IRL collaboration journey  
**Predecessor:** `codexes/packs/agentiq/updates/2026-07-30_prd-gjr-001-guided-journey-runtime.md`  
**Related:** `codexes/packs/irl/foundation/PRD-IRL-AX-001_reciprocal-artifact-exchange.md`  
**Future integration:** Differ / adaptive experience projection — explicitly stubbed, NOT implemented by this spec

---

## 0. Governing evolution

The existing **Guided Journey Runtime** proved the core pattern:

`journey bar → existing capability surface → contextual Companion → authoritative state transition → receipt → next stage`

Journey Spine generalizes that pattern into a first-class runtime primitive.

> **Journey Spine decouples capability from navigation.**

Capabilities remain independently owned, reusable runtime primitives. Navigation is composed dynamically around the participant's present state, destination, authority, history, experience intent, and the actual dependencies required to reach the next meaningful state.

Journey Spine is NOT a new Passport system, delegation system, artifact system, exchange system, agreement system, Companion, Experience Qube, or adaptive UI engine. It orchestrates those capabilities without duplicating them.

Existing steppers and guided journeys should progressively become **Journey Definitions** over this common runtime rather than remain bespoke implementations.

---

# 1. Product proposition

> **A persistent, state-aware guide that composes the minimum necessary capabilities to move a person, agent, or organization from where they are to the next declared engagement state.**

The conventional application model couples capability to navigation:

`menu → page → feature → workflow`

Journey Spine reverses this:

`participant + current state + target state + required conditions + experience intent → next best valid experience → appropriate capability surface`

The same platform can therefore present different navigational pathways to different participants without duplicating capabilities or building separate applications.

---

# 2. Core constitutional UX laws

## JS-LAW-001 — State satisfaction, not page completion

A journey step is complete when its required state is satisfied, not because the user visited or clicked through a page.

If a participant already holds a valid Passport, the Passport requirement resolves COMPLETE. The journey must not force redundant onboarding.

## JS-LAW-002 — Sequence only where genuine dependency exists

A step may block another step only where the underlying constitutional, operational, or evidentiary dependency genuinely requires it.

Optional agent delegation must not block direct human artifact upload merely because the UI previously presented delegation first.

## JS-LAW-003 — Orchestrate capabilities; never duplicate them

Journey Spine owns journey composition, projection, state resolution, and navigation. It does not own the underlying capability.

Passport opens Passport. Delegation opens Delegation. Reciprocal Artifact Exchange opens Exchange. Signing opens the existing constitutional signing/agreement surface. Receipts open the Receipt viewer. Experiment work opens the appropriate IRL/Experiment Architect surface.

## JS-LAW-004 — Mutual awareness does not imply shared authority

Journey Spine, Companion, Experience Qube, Experience Guide, and future Adaptive Engine/Differ may consume each other's bounded state and respond dynamically, but each retains independent ownership.

No experience recommendation or adaptive projection may override a constitutional dependency, required principal act, authority condition, refusal, or evidence requirement.

## JS-LAW-005 — Experience intent is progressively discovered, not demanded as entry price

A participant does not need a complete Experience Qube before Journey Spine can help them.

The journey should create natural opportunities to declare, observe, and—with explicit provenance—infer experience preferences while the participant pursues their actual objective.

## JS-LAW-006 — Declared, observed, and inferred experience are distinct

`declaredExperience ≠ observedExperience ≠ inferredExperience`

The system must preserve provenance between:

- preferences the participant explicitly states;
- behavior the runtime observes;
- preferences the Experience Guide or future adaptive system infers.

An inference must never silently become a declared preference.

## JS-LAW-007 — Preserve journey history as evidence

Journey evolution must not erase prior phases. Completed journey states remain inspectable evidence of how the engagement progressed.

## JS-LAW-008 — Waiting and refusal are states, not UX errors

The runtime must distinguish READY, WAITING, BLOCKED, REFUSED, OPTIONAL, FUTURE, and COMPLETE. A participant should be able to see that they have completed their required work and are waiting on another actor rather than being shown an ambiguous incomplete progress bar.

---

# 3. Journey Spine and the threshold

The Journey Spine operates across the Constitutional Internet's threshold boundary.

The **Companion** is the persistent relational bridge: it can orient the participant across legacy and constitutional systems, explain where they are, and invoke Journey Spine destinations or next actions.

Journey Spine provides the structured navigational state beneath that interaction.

The architecture should therefore preserve:

`Legacy surface / external system ↔ Companion ↔ Journey Spine ↔ constitutional capabilities`

The Companion may help a participant traverse from a legacy context into a constitutional runtime surface, but Journey Spine remains responsible for the journey's state/dependency model and Constitutional Computing remains authoritative over consequential permission.

This spec does not redesign Companion. It exposes the bounded context Companion needs to become journey-aware.

---

# 4. First-class interaction primitives

Journey Spine is one member of a mutually aware interaction architecture:

## 4.1 Journey Spine

Owns:
- current journey state;
- target engagement state;
- dependency graph;
- requirement satisfaction;
- next-ready steps;
- journey progression/history;
- surface orchestration.

Does not own Experience Intent, constitutional authority, or capability implementation.

## 4.2 Experience Qube (ExQube)

Owns participant experience-state evidence, including declared, observed, and inferred experience information with provenance.

It MUST NOT become an authorization mechanism.

## 4.3 Experience Guide / Experience Matrix

Consumes journey context + ExQube and may recommend next-best actions/experiences.

It does not determine whether a constitutionally required action can be omitted.

## 4.4 Companion

Provides conversational/persistent guidance and can explain, recommend, orient, and navigate through Journey Spine.

It does not own the authoritative journey or constitutional state.

## 4.5 Adaptive Engine / Differ — FUTURE STUB

May later optimize the **projection** of a valid journey into an interface or hybrid host.

Journey Spine determines valid progression; Experience Guide informs experiential preference; Differ may optimize how the valid experience is rendered.

> **Journey Spine governs progression. Experience Guide informs preference. Differ optimizes projection.**

No Differ implementation belongs in this increment beyond a clean adapter/interface seam.

---

# 5. Shared Interaction Context

Do not tightly couple the interaction primitives. Introduce or evolve a bounded shared projection contract, tentatively `InteractionContext`.

Minimum fields/concepts:

```ts
interface InteractionContext {
  participantRef: string
  personaRef?: string
  journeyId: string
  journeyVersion: number
  currentJourneyState: string
  targetState: string
  readyStepIds: string[]
  completedStepIds: string[]
  waitingStepIds: string[]
  blockedStepIds: string[]
  optionalStepIds: string[]
  availableCapabilities: CapabilityRef[]
  requiredConditions: ConditionRef[]
  authorityContext?: AuthorityProjection
  delegationContext?: DelegationProjection
  experienceIntent?: ExperienceIntentProjection
  experienceEvidence?: ExperienceEvidenceProjection[]
  recommendedNextActions?: RecommendationRef[]
  permittedActions?: ActionRef[]
  presentationHints?: PresentationHint[]
}
```

Names should adapt to existing repository conventions. Do not create redundant platform context objects if a compatible projection already exists.

The contract must distinguish **recommendation** from **permission**.

---

# 6. Generic Journey Definition

A journey should be configuration/data driven wherever practical.

```ts
interface JourneyDefinition {
  journeyId: string
  version: number
  title: string
  purpose: string
  targetState: string
  participantScope?: string
  steps: JourneyStepDefinition[]
  completionCondition: ConditionExpression
  destination?: SurfaceRef
  experiencePolicy?: JourneyExperiencePolicy
}
```

Each step:

```ts
interface JourneyStepDefinition {
  stepId: string
  phaseId?: string
  label: string
  description?: string

  requirement: 'required' | 'optional' | 'conditional' | 'future'

  satisfactionCondition: ConditionExpression
  dependencies?: ConditionExpression[]

  surface: {
    kind: 'modal' | 'tab' | 'cartridge' | 'route' | 'action' | 'embedded' | 'companion'
    ref: string
  }

  actor: 'principal' | 'delegate' | 'either' | 'system' | 'counterparty'
  authorityRequirement?: string
  completionEvidence?: string[]

  experienceOpportunities?: ExperienceOpportunity[]
}
```

The exact schema should compose with the existing Guided Journey Runtime rather than force a wholesale rewrite.

---

# 7. Dependency model — DAG, not linear wizard

The underlying Journey Spine MUST support a dependency graph rather than require a fixed linear sequence.

The UI may render a clear ordered spine, but readiness is computed from actual dependencies and satisfaction conditions.

Example — initial OCSGA collaboration:

```text
Invitation
    ↓
Passport ───────────────┐
    │                   │
    ├── optional Agent Delegation
    │                   │
    └──────────────→ Artifact Deposit
                         ↓
                   Freeze Attestation
                         ↓
                  Exchange Instrument
                         ↓
                   Reciprocal Gate
                         ↓
                       Exchange
                         ↓
                  Boundary Research
```

Agent delegation is optional and must not block direct principal action.

A participant may also prepare/reference an artifact before another optional step where authority and access permit.

---

# 8. Journey step states

Canonical UX states:

- `COMPLETE` — satisfaction condition already met.
- `READY` — actionable now.
- `OPTIONAL` — available but not required for target state.
- `WAITING` — participant is waiting on another actor/system/event.
- `BLOCKED` — a genuine dependency is not satisfied.
- `FUTURE` — part of the engagement roadmap but not yet constituted/actionable.
- `REFUSED` — current constitutional/runtime state refuses action.
- `SUPERSEDED` — journey evolution replaced this step while preserving historical evidence.

Avoid generic percentage-only progress as the primary semantic. Percent completion may be supplementary but cannot replace meaningful state.

---

# 9. Journey evolution / versions

A Journey Spine persists across the relationship while its active definition can evolve.

Example:

`Journey v1 — Enter + Architecture Exchange`

→ `Journey v2 — Boundary Comparison`

→ `Journey v3 — Experiment Constitution`

→ `Journey v4 — Experiment Execution`

→ `Journey v5 — Review / Publication`

Past phases remain visible as completed historical phases. Versioning must not silently reinterpret previously completed requirements.

A journey may branch/fork when multiple legitimate paths exist.

---

# 10. Experience integration

Journey Spine should begin populating/refining Experience Intent as a natural by-product of useful interaction.

## 10.1 Experience opportunities

A step may define an `experienceOpportunity`, e.g.:

- preferred artifact submission path: direct upload / immutable repo reference / delegated agent;
- preferred review presentation: technical matrix / guided walkthrough / Companion-assisted;
- preferred level of agent assistance;
- preferred interaction density;
- preferred communication modality where supported.

The participant's selection both advances the journey and may create **declared experience evidence**.

## 10.2 Observed experience

Behavioral evidence may be recorded as observed experience where legitimate and proportionate, but must remain distinguishable from declaration.

## 10.3 Inferred experience

The Experience Guide may later infer preferences from sufficient evidence. Such inference must carry confidence/provenance and be correctable.

## 10.4 No profiling gate

No journey may require a participant to complete a broad experience profile unless the target capability genuinely depends on it.

> **Experience Intent should be progressively discovered through participation, not demanded as the price of participation.**

---

# 11. Companion integration

Journey Spine must expose enough state for Companion to answer:

- Where am I?
- What is my destination?
- What have I already satisfied?
- What can I do now?
- What is optional?
- What am I waiting for?
- Why is something blocked/refused?
- What is the recommended next action?
- Can you take me there?

Companion must be able to deep-link/activate the relevant existing capability surface through the Journey Spine surface reference.

The first implementation need not make Companion autonomous over the whole journey. It must create the stable integration seam.

---

# 12. Surface orchestration / capability-navigation decoupling

Journey Spine steps should reference stable capability/surface identifiers rather than hard-code visual implementation.

A step may resolve to:

- local route;
- modal;
- tab;
- cartridge surface;
- embedded surface;
- Companion action;
- future hybrid/external host adapter.

The engine should not care whether a capability is later rendered natively or through Differ/hybrid hosting, provided the capability contract, authorization, state and completion evidence are preserved.

This is the portability seam for future Differ integration.

---

# 13. Existing Guided Journey Runtime migration

The current Guided Journey Runtime is the predecessor/reference implementation and MUST be evolved, not abandoned.

First forensic task for implementation:

1. identify the current Journey bar/state resolver/surface orchestration/Companion-context primitives;
2. identify every current guided stepper/walkthrough that uses the pattern;
3. classify which logic is generic vs journey-specific;
4. evolve generic parts into Journey Spine;
5. represent at least the existing MoneyPenny/Horizen journey as a Journey Definition or compatibility adapter without breaking the existing UX;
6. identify the P1 validation walkthrough/stepper and use it as an additional backward-compatibility fixture where practical.

Do not perform a risky estate-wide migration in the first increment. Build compatibility, then migrate journeys incrementally.

---

# 14. Initial deployment — OCSGA × Constitutional Computing / IRL

This is the first new Journey Spine deployment.

## 14.1 Research framing

The collaboration should now be framed primarily as:

> **Constitutional Computing / IRL × OCSGA**

The Constitutional Internet remains the wider constitutional field/environment in which the systems can interact across persons, agents and organizations. It is not the principal computational architecture being compared in the experiment.

The formal architecture artifact used for exchange should therefore be a derivative/focused Constitutional Computing / IRL baseline with explicit lineage from the already-frozen CI/IRL baseline rather than rewriting that frozen source.

## 14.2 Journey title

**OCSGA × Constitutional Computing Research Collaboration**

## 14.3 Target state for v1

> Both independently frozen formal architectures have been exchanged under receipt and the collaboration is ready to begin neutral boundary comparison.

## 14.4 Initial phases

### PHASE A — ORIENT

**Welcome / Orientation**

Explain simply:

- what Ian has been invited to;
- that the immediate purpose is reciprocal architecture exchange;
- that the exchange precedes experiment design;
- that the guide will show only what is actually required of him.

### PHASE B — ENTER

**Passport — REQUIRED IF ABSENT**

Satisfaction condition: valid Polity Citizen Passport/personhood state recognized for participant.

If already satisfied: show COMPLETE, do not repeat onboarding.

**Agent Delegation — OPTIONAL**

Offer clearly:

- `Continue myself`
- `Delegate to an agent`

Delegation may assist artifact handling and later research work. It must not replace Ian's own attestation where a principal signature is required.

### PHASE C — DEPOSIT

**Add OCSGA Architecture — REQUIRED**

Offer existing supported mechanisms:

- upload directly;
- reference immutable/commit-pinned artifact;
- have a delegated agent submit where authority permits.

Show artifact title, version, fingerprint/hash/reference, owner, and deposit receipt when complete.

### PHASE D — FREEZE + SIGN

**Freeze Attestation — PRINCIPAL REQUIRED**

Launch the existing Reciprocal Artifact Exchange freeze declaration/signing surface.

**Exchange Instrument — REQUIRED**

Show each party's state and clearly distinguish participant action from counterparty waiting state.

### PHASE E — CROSS

**Reciprocal Exchange**

Show readiness side-by-side:

```text
Constitutional Computing / IRL      OCSGA
✓ Artifact deposited               ✓ Artifact deposited
✓ Frozen                           ✓ Frozen
✓ Required signature               ✓ Required signature
```

Once the reciprocal gate is satisfied, invoke the existing Exchange crossing, reveal the artifacts according to policy, and display the bilateral Exchange Receipt.

### PHASE F — RESEARCH

Persistent research destination, not a throwaway completion screen.

Initial projection:

- Architecture Exchange — COMPLETE when satisfied
- Boundary Comparison — NEXT / READY after crossing
- Experiment Protocol — FUTURE / not yet constituted
- Experiment Execution — FUTURE
- Results / Review — FUTURE

This phase should be designed so later Journey versions can replace onboarding steps with boundary-comparison and experiment-design steps without creating a new engagement UI.

---

# 15. Ian-specific experience opportunities

Keep v1 lightweight but instrument the architecture correctly.

Natural choices that can feed Experience Intent without blocking progress:

- direct artifact upload vs repository reference vs delegated submission;
- direct technical matrix vs guided review vs Companion-assisted review when comparison opens;
- degree of agent assistance;
- whether he prefers concise status view or expanded evidence detail where the UI already supports such modes.

Do not build a full Experience Guide UI merely for this first journey. Emit/record the appropriate bounded experience signals through existing ExQube/experience mechanisms where they exist; if the substrate is incomplete, stub the contract honestly.

---

# 16. Research / experiment destination

Journey Spine must be able to end a phase in an ongoing engagement surface rather than terminate as a wizard.

For this collaboration the destination should expose:

- engagement title;
- current research phase;
- both exchanged architecture artifacts after crossing;
- bilateral receipt;
- QubeTalk / collaboration thread where deployed;
- next boundary-comparison action;
- experiment status: `NOT YET CONSTITUTED` until boundary comparison supports one;
- completed journey/history.

Experiment Architect should later consume the two immutable artifacts + exchange provenance + comparison artifact. It must not be asked by Journey Spine v1 to invent the experiment prematurely.

---

# 17. Evidence and receipts

Journey Spine should consume authoritative evidence rather than invent client-side completion.

A step's `satisfactionCondition` should resolve against real platform state and/or receipts.

Examples:

- Passport recognized → Passport/personhood authoritative state;
- delegation completed → delegation record/receipt;
- artifact deposited → Exchange artifact record/fingerprint/receipt;
- freeze attested → attestation/signature receipt;
- exchange complete → bilateral Exchange Receipt;
- boundary comparison opened → comparison object state.

Journey projection itself may maintain state/cache for UX, but it may not become the authoritative source of constitutional completion.

---

# 18. Authorization discipline

Journey Spine is a guide, not an authorization engine.

It may display `READY`, `BLOCKED`, `REFUSED`, etc. based on authoritative state but does not manufacture Authority or Authorization.

The architecture must preserve:

`recommendation ≠ authorization`

`journey readiness ≠ constitutional permission`

`surface availability ≠ right to execute`

A future Differ/Adaptive Engine may optimize presentation but inherits the same constraints.

---

# 19. Generic applicability

The abstraction is successful only if it generalizes beyond Ian.

Candidate future Journey Definitions include:

- Polity Passport activation;
- Founder Office activation;
- MoneyPenny / Financial Services agent admission;
- reviewer/researcher onboarding;
- developer/DevOn engagement;
- experiment validation walkthroughs;
- KNYT engagement journeys;
- Vela early access;
- partner onboarding;
- external agent admission.

Do not implement these all now. Use them as architecture tests against overfitting.

---

# 20. Differ portability stub

This increment MUST NOT implement Differ.

It SHOULD ensure Journey Spine can later provide a host-neutral projection such as:

```ts
interface JourneyProjection {
  journeyId: string
  version: number
  phase: JourneyPhaseProjection
  steps: JourneyStepProjection[]
  nextBestActions: ActionProjection[]
  capabilityRefs: CapabilityRef[]
  constitutionalConstraints: ConstraintProjection[]
  experienceContext?: ExperienceIntentProjection
  presentationHints?: PresentationHint[]
}
```

Future Differ may consume this projection and render/compose a context-specific experience in a hybrid host.

Journey Spine remains authoritative for progression semantics; Differ remains non-authoritative for constitutional state.

---

# 21. Implementation sequence

## Stage 0 — Forensic audit

Before writing code, map the real existing Guided Journey Runtime and current steppers.

Required audit table:

`PRIMITIVE | CURRENT IMPLEMENTATION | GENERIC? | REUSE | CHANGE REQUIRED | RISK`

At minimum inspect:

- journey bar / stepper components;
- authoritative state resolver;
- surface orchestration;
- Companion context integration;
- receipts/proof bindings;
- MoneyPenny/Horizen guided journey;
- EXP/P1 validation walkthrough;
- Passport onboarding;
- IRL Research Spaces;
- Reciprocal Artifact Exchange UI/state;
- Experience Qube / Experience Guide / Experience Matrix substrate;
- any existing next-best-action or adaptive experience code.

Do not assume names from this spec map 1:1 to code.

## Stage 1 — Extract/evolve generic Journey Spine core

Build the smallest backward-compatible runtime capable of:

- Journey Definition;
- satisfaction conditions;
- dependency graph;
- state projection;
- existing surface references;
- actor semantics;
- journey version/history;
- Interaction Context projection;
- Companion seam;
- Experience seam;
- future Differ adapter seam.

## Stage 2 — Preserve existing journeys

Prove no regression on the Guided Journey Runtime reference flow. Adapt rather than rewrite where possible.

## Stage 3 — Build Ian Journey Definition

Compose existing Passport, optional delegation, Reciprocal Artifact Exchange, signing, receipt and research surfaces.

No duplicate capability forms.

## Stage 4 — Deploy / verify

The operational acceptance test is an invitation Ian can actually use end-to-end.

---

# 22. Acceptance criteria

Journey Spine v1 is accepted when:

1. there is one generic Journey Spine runtime, not a new Ian-specific wizard;
2. existing Guided Journey Runtime behavior remains functional or is compatibly adapted;
3. steps resolve from authoritative state rather than local click history;
4. optional steps do not become accidental dependencies;
5. the underlying model supports a DAG even if UI projects an ordered spine;
6. COMPLETE / READY / OPTIONAL / WAITING / BLOCKED / FUTURE / REFUSED are meaningfully distinguishable;
7. Companion can consume journey context and navigate to a step surface through a stable interface;
8. Experience Qube/Guide integration is represented as a first-class seam, with declared/observed/inferred provenance preserved where substrate exists;
9. no Experience Qube completion is required merely to enter a journey;
10. a future Differ adapter can consume a host-neutral journey projection without owning journey progression;
11. Ian can enter from his IRL invitation, resolve/claim Passport if necessary, choose direct work or optional agent delegation, deposit/reference the OCSGA artifact, personally attest the freeze, sign the Exchange Instrument, see reciprocal readiness, complete the exchange, receive/view the receipt, and arrive at the ongoing research surface;
12. the journey clearly shows where Ian is waiting on Dele/system rather than presenting ambiguous incompletion;
13. after exchange, onboarding steps can recede into completed history and the same engagement can evolve toward Boundary Comparison;
14. the experiment remains `NOT YET CONSTITUTED` until the boundary comparison warrants a protocol;
15. no Journey Spine recommendation can override constitutional authorization or required principal signature.

---

# 23. Non-goals for this increment

Do NOT:

- build Differ;
- create a general generative UI system;
- replace Companion;
- rebuild ExQube/Experience Guide wholesale;
- migrate every existing stepper in one pass;
- redesign Passport/delegation/exchange/signing/receipt capabilities;
- create a new experiment before architecture comparison;
- collapse the Constitutional Internet into Constitutional Computing;
- make the OCSGA journey dependent on optional agent delegation;
- infer user preferences as declared facts;
- use client-side progression as constitutional evidence.

---

# 24. Architectural compression

> **Journey Spine decouples capability from navigation.**

> **State satisfaction determines what remains; genuine dependency determines sequence.**

> **Experience Intent is progressively discovered through participation, not demanded as the price of participation.**

> **Journey Spine governs progression. Experience Guide informs preference. Differ optimizes projection.**

> **Companion is the persistent relational threshold; Journey Spine gives that threshold navigational structure.**

> **Mutual awareness does not imply shared authority.**

Together, these establish a platform architecture in which stable constitutional capabilities can be navigated through bespoke, state-aware, experience-aware journeys without coupling the user's path to the application's fixed information architecture.
