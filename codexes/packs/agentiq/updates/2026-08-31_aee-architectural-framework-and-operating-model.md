# AEE-001B — Adaptive Experience Engine: Architectural Framework & Operating Model

**Status:** CANONICAL DIRECTION — architectural framework; implementation remains governed by existing specs and explicit work orders  
**Date:** 2026-08-31  
**Scope:** metaMe / AgentiQ estate  
**Audience:** internal architecture, engineering and research teams; approved adaptive experience/rendering providers  
**Reference provider:** Differ  
**Reference vertical:** Financial Services Runtime  
**Parents / implementation antecedents:**
- `2026-08-24_spec-adaptive-experience-engine-differ-provider.md` (SPEC-AEE-001)
- `2026-08-24_spec-adaptive-experience-engine-phase2-differ-hosting-and-fs-audit.md` (SPEC-AEE-001A)
- `2026-08-24_spec-journey-spine-state-experience-aware-navigation.md` (SPEC-JS-001)
- `2026-08-24_aee-differ-phase0-audit-financial-services.md`
- `codexes/packs/irl/foundation/CTP-001_constitutional-transition-primitive-registry-and-execution-model.md`

**Governing relationship:** this document elevates and extends the existing AEE implementation specs into an estate-wide architectural framework. It does not authorize implementation work by itself and does not silently supersede existing code-level contracts. Where an implementation detail conflicts with this direction, the conflict must be surfaced for operator resolution rather than guessed away.

---

## 0. Executive proposition

The Adaptive Experience Engine (AEE) is a first-class architectural framework for creating coherent, state-aware, person-centred digital experiences across interfaces, applications, agents, devices, conversations and providers.

Its central proposition is:

> **The experience belongs to the person and the journey — not to the interface.**

A person may begin an interaction in metaMe, continue through a Bridge, invoke a service through an aigent, move to a mobile application, use a third-party AI harness through MCP, complete a constitutional act through a native surface, and later resume through an embedded or externally hosted interface.

The visible interface may change. The rendering provider may change. The active persona may change. The conversation or interaction channel may change.

The underlying constitutional state, journey, authority, experience intent and required consequences remain coherent.

AEE is the architecture through which that continuity is converted into an appropriate experience for the present context.

Canonical compression:

> **One person. Many personas. Many journeys. Many interfaces. One coherent constitutional experience.**

---

# 1. The five questions the architecture separates

Conventional applications frequently collapse identity, navigation, experience, execution and presentation into one screen/application model. AEE separates them.

### Who is participating?
Resolved through personhood, identity, persona, relationship, authority and delegation.

### Where are they going?
Resolved through Journey Spine.

### What should they experience now?
Resolved through Experience Models, Experience Matrices, Experience Guide, experience evidence and AEE.

### What must the system or its agents actually do?
Resolved through AgentiQ, its aigents, tools, services and workflows.

### How should the experience appear here?
Resolved through an interchangeable rendering/composition/hosting layer.

This gives the canonical responsibility split:

> **Journey Spine governs progression.**  
> **Experience Models and Matrices define experiential possibilities.**  
> **AEE determines and composes the appropriate experience.**  
> **AgentiQ executes bounded intelligence and action.**  
> **Constitutional Computing governs consequential state transition.**  
> **Renderers and hosts manifest the experience.**

AEE is therefore neither a second execution engine nor merely a renderer.

---

# 2. Core constitutional rule

> **Adaptive projection may change the experience. It may not change constitutional truth.**

AEE may change:

- presentation;
- information density;
- explanatory depth;
- assistance level;
- modality;
- layout;
- component composition;
- navigation among genuinely available options;
- emphasis;
- optional recommendation;
- surface selection;
- provider/host selection where policy permits.

AEE may not change:

- personhood;
- authority;
- ownership;
- delegation;
- authorization;
- canonical state;
- mandatory dependencies;
- evidentiary requirements;
- constitutional invariants;
- required consequences;
- permission merely because an experience recommendation would be more convenient.

The interface is adaptive. The constitution remains invariant.

---

# 3. Estate-level stack

```text
EXPERIENCE & INTERACTION SURFACES
────────────────────────────────────────────────────
metaMe / AgentiQ runtimes
Cartridges
Bridges
Companion
Aigent interfaces
Native mobile applications
Capsules / Pills / Chips
Embeddings
Thin clients
External websites
Intranets
Social surfaces
Third-party harnesses

                     ▲
                     │ ExperienceProjection
                     │
ADAPTIVE EXPERIENCE ENGINE
────────────────────────────────────────────────────
Experience Models
Experience Matrices
Experience Guide
Experience Qube / experience evidence
Context resolution
Adaptive decisioning
Experience composition
Projection
Validation
Fallback
Observation
Adaptation

                     ▲
                     │ capability requirements
                     │
AGENTIC EXECUTION
────────────────────────────────────────────────────
AgentiQ
Aigents
Orchestration
Tools
Services
Workflows
MCP
A2A
Bounded delegation

                     ▲
SOVEREIGN COMPUTE / OS
────────────────────────────────────────────────────
nanOS / AgentiQ OS
Runtime execution
Local / edge compute
Secure state and services

                     ▲
PRIMITIVES, DISCOVERY & ASSURANCE
────────────────────────────────────────────────────
iQubes
Experience Qubes
CTP Qubes (target architecture; see implementation status)
Agents
Tools
Data
Services
Capabilities
Registry
Codexes

                     ▲
CONSTITUTIONAL & VERIFICATION LAYER
────────────────────────────────────────────────────
Personhood
Identity
Persona
Authority
Control
Mandate
Delegation
Authorization
Journey state
Standing
Consequence
CTPs
DVN
Receipts
Evidence
Provenance

                     ▲
SETTLEMENT / ANCHORING
────────────────────────────────────────────────────
Bitcoin
Other approved settlement / anchoring systems
```

Architectural compression:

> **Settlement → Verification → Primitives → Compute → Execution → Adaptation → Experience.**

---

# 4. Personhood is the continuity anchor

The most important object in the architecture is not the screen, account, application, session or agent. It is the **person**.

Personhood supplies constitutional continuity from which identities, personas, authority, delegation, standing and participation can be resolved.

A person may have multiple personas. A persona may participate in multiple conversations. A conversation may involve multiple agents, tools, services, documents, exchanges and workflows. Those contexts must not automatically collapse into one another.

```text
PERSON
  │
  ├── Persona A
  │      ├── Conversation
  │      ├── Exchange
  │      ├── Workflow
  │      └── Tools / services
  │
  ├── Persona B
  │      ├── Conversation
  │      ├── Exchange
  │      └── Different disclosure boundary
  │
  └── Persona C
         └── ...
```

This creates a key estate capability:

> **Coherent presence without indiscriminate context collapse.**

A person can possess durable rights, credentials, standing, tools, services and authority at the person level while exposing only those elements legitimate for the current persona, relationship, journey and interaction.

---

# 5. Context is layered, not global

AEE MUST NOT depend on a single undifferentiated user profile.

Experience context should resolve through progressively bounded scopes:

```text
Person
↓
Persona
↓
Relationship / domain
↓
Journey
↓
Interaction stream
↓
Conversation / exchange / workflow
↓
Current state
↓
Current surface
```

The architecture distinguishes **continuity state** from **disclosure state**.

Continuity asks:

> What remains true about this person across contexts?

Disclosure asks:

> What may legitimately be present in this particular context?

For example, a Passport may be reusable across personas while confidential research artifacts from one engagement remain unavailable in another. Access to a tool may originate in person-level authority while the data supplied to that tool remains conversation-specific.

This distinction is central to safe adaptation.

---

# 6. First-class experience objects

## 6.1 Journey Model / Journey Spine

Owns destination, current journey state, dependencies, satisfaction conditions, actors, history and valid progression.

It answers:

> **Where are we, where are we going, and what genuinely has to happen?**

Journey completion is determined by state satisfaction, not page visitation.

## 6.2 Experience Qube (ExQube)

Owns experience-related evidence associated with a participant, including:

- declared evidence;
- observed evidence;
- inferred evidence.

These classes remain distinct and retain provenance. Inferred experience never silently becomes declared experience.

ExQube is not an authorization mechanism.

## 6.3 Experience Model

Defines the possible semantics and structures of an experience, including interaction modes, information density, assistance levels, modalities, states, patterns, experience goals, constraints and satisfaction signals.

It answers:

> **What kinds of experience can exist here?**

## 6.4 Experience Matrix

Maps bounded context to appropriate experience possibilities.

Conceptually:

```text
Person
+ Persona
+ Journey State
+ Intent
+ Authority
+ Experience Evidence
+ Environment
+ Available Capabilities
+ Surface Constraints
─────────────────────────
= Appropriate Experience Pattern
```

It answers:

> **Given this situation, what form of experience is appropriate now?**

## 6.5 Experience Guide

Consumes journey context, ExQube evidence, Experience Models and Matrices and proposes next-best experience recommendations.

Recommendation remains distinct from permission.

## 6.6 Adaptive Experience Engine

Evaluates bounded context and valid experiential possibilities and produces a provider-neutral Experience Projection.

It answers:

> **What should this participant experience now?**

## 6.7 Execution Model

Owned by AgentiQ. Determines how agents, tools, services and workflows do the work necessary to realize the experience.

It answers:

> **How does the system make this happen?**

Canonical boundary:

> **AEE owns the model of experience. AgentiQ owns the model of execution.**

---

# 7. Rendering and composition modes

AEE must explicitly support more than one class of interface generation. “Generative UI” is not itself synonymous with adaptive experience.

The architecture recognizes four progressively richer rendering/composition modes.

## Mode R0 — Fixed interface

A predefined surface with fixed structure and behavior.

Examples:

- a fixed wallet screen;
- a fixed constitutional signature ceremony;
- a static admin console;
- a regulated or safety-sensitive form whose geometry and controls are deliberately invariant.

Fixed does not mean non-contextual. Data may change while the interface structure remains fixed.

Fixed surfaces remain valid and important, especially where predictability, safety, constitutional ceremony, accessibility or auditability outweigh adaptation.

## Mode R1 — Templated interface

A predefined template whose content, data, variants or bounded slots may change.

Examples:

- a common receipt template populated with different evidence;
- a standard service card with contextual fields;
- a modal whose copy and available options are selected from approved variants;
- a journey stage panel using a stable visual grammar.

The template constrains the shape. Context selects or fills it.

## Mode R2 — Compositional / generative interface

An orchestration layer selects and assembles approved experience primitives into a context-specific composition.

The system is not required to generate arbitrary UI code. It can generate **composition** from trusted primitives.

Relevant primitives include:

- Capsules;
- Pills;
- Chips;
- Tabs;
- Cartridges;
- Modals;
- Cards;
- Companion cues;
- embeds;
- fixed constitutional surfaces;
- approved content blocks.

A composition may therefore be generative at the orchestration level while the primitives themselves remain deterministic, tested and governed.

This is the preferred metaMe design pattern for most generative experience work:

> **Generate the composition more readily than the constitutional primitive.**

## Mode R3 — Adaptive experience

An adaptive experience is not merely a generated composition. It is a generated or selected composition situated inside a **closed feedback loop**.

The experience can morph as the relevant context changes:

- journey state changes;
- the person completes or refuses an action;
- new authority is established;
- a counterparty acts;
- intent changes;
- the active persona changes;
- experience evidence accumulates;
- the host/device changes;
- a capability becomes unavailable;
- a consequence occurs;
- the user signals confusion, preference or satisfaction;
- environmental conditions change.

The defining characteristic of R3 is therefore not “AI-generated UI.” It is **context-sensitive recomposition over time with feedback, bounded by authoritative state and constitutional constraints**.

Canonical distinction:

> **Fixed specifies. Templated varies. Generative composes. Adaptive learns from the changing interaction and recomposes within bounds.**

These are modes, not a maturity hierarchy. A single journey may deliberately use all four.

---

# 8. The adaptive loop

The AEE operating model is a cybernetic experience loop:

```text
SENSE
↓
UNDERSTAND
↓
DETERMINE
↓
COMPOSE
↓
PROJECT
↓
INTERACT
↓
OBSERVE
↓
ADAPT
↺
```

### Sense
Resolve participant, persona, journey, interaction context, authority, environment, available capabilities and relevant experience evidence.

### Understand
Determine current state, intent, destination, dependencies, constraints and experiential requirements.

### Determine
Evaluate Experience Models and Matrices to identify valid and appropriate next experience candidates.

### Compose
Select approved information, components, capabilities, assistance modes and surfaces.

### Project
Produce a provider-neutral `ExperienceProjection`.

### Interact
The selected renderer/host manifests the projection.

### Observe
Capture legitimate interaction evidence, state change, consequence and satisfaction signals.

### Adapt
Update bounded experience evidence/context and determine whether the experience should persist, simplify, expand, hand off, or recompose.

This loop is the architectural feature that distinguishes AEE from a one-shot generative UI system.

---

# 9. CopilotKit and orchestration mechanisms

CopilotKit is already documented in this repository as a **server-side orchestration layer** (`docs/COPILOTKIT.md`), with the primary pattern:

```text
Aigent Z Console → CopilotKit Provider → CopilotRuntime → Backend Actions → Services
```

This is compatible with the AEE architecture provided the responsibilities remain distinct.

CopilotKit or an equivalent orchestration mechanism MAY:

- mediate conversational interaction;
- choose tools/actions available to an agentic interaction;
- orchestrate approved components;
- participate in R1/R2 templated or compositional experiences;
- supply a renderer/composition mechanism beneath an Experience Projection;
- help realize a requested experience using declared platform capabilities.

It MUST NOT become the owner of:

- personhood;
- Journey truth;
- experience evidence truth;
- constitutional authority;
- consequential authorization;
- CTP semantics;
- canonical evidence;
- the AEE feedback policy itself merely because it can generate a UI or call a tool.

Canonical relationship:

```text
AEE decides the bounded experience
        ↓
ExperienceProjection
        ↓
Composition / rendering mechanism
(CopilotKit, native renderer, Differ, future provider)
        ↓
Approved primitives + capabilities
```

A provider may combine rendering and orchestration, but that does not collapse the architectural boundary.

---

# 10. Experience Projection

The primary output of AEE is a bounded, host-neutral **Experience Projection**, not HTML and not arbitrary executable application code.

A projection may identify:

- primary action;
- secondary actions;
- recommended surfaces;
- selected rendering mode (R0-R3 where appropriate);
- layout / density;
- Companion guidance;
- experience rationale;
- experience signals used;
- constraints applied;
- host requirements;
- provider requirements;
- projection confidence;
- fallback state;
- expiry/re-evaluation condition.

The projection references capabilities rather than recreating authority-bearing implementations.

The architecture should progressively make the chosen rendering mode explicit in the projection contract, while preserving backwards compatibility with the existing `ExperienceProjection` type.

---

# 11. Surfaces and interaction channels

The architecture distinguishes human-facing surfaces from machine/hybrid interaction channels.

Human-facing surfaces include:

- metaMe / AgentiQ Runtime UI;
- Cartridges;
- Bridges;
- Companion;
- Aigent conversational/embodied interfaces;
- native mobile apps;
- Capsules / Pills / Chips;
- embeddings;
- thin clients;
- external websites;
- intranets;
- social-platform surfaces.

Machine and hybrid interaction channels include:

- MCP;
- A2A;
- APIs;
- agent harnesses;
- event/webhook mechanisms;
- other bounded service interfaces.

An adaptive experience may therefore span:

```text
Human → system
Human → agent → system
Agent → system
Agent → agent
Human + agent → shared workflow
```

AEE is consequently broader than an adaptive graphical UI engine. It is an **adaptive interaction architecture**.

---

# 12. Provider architecture

Experience providers such as Differ sit above the authoritative metaMe runtime boundary.

Canonical rule:

> **metaMe owns truth, capability, topology, constitutional state and authoritative data. Providers receive bounded projections of those things.**

A provider may perform one or more roles:

- renderer;
- host;
- component composer;
- navigation projector;
- generative presentation engine;
- observation/analytics environment;
- adaptive recommendation source.

These capabilities must be explicitly negotiated and verified. They are never assumed.

The provider boundary MUST work equally for:

- fixed rendering;
- templated rendering;
- compositional/generative rendering;
- adaptive rendering/hosting.

AEE remains provider-neutral.

---

# 13. Differ as reference adaptive provider

Differ is a useful reference because its clarified provider model includes hosted observation, behavioral signals and recommendations rather than only a request/response renderer.

That makes it especially relevant to R3 adaptive experience, but does not make Differ the AEE.

Canonical boundary:

```text
metaMe / Constitutional Computing
  owns truth, authorization, object state,
  capability execution and receipts

Journey Spine
  owns progression

ExQube / Experience Models / Matrices / Guide
  own or interpret experience evidence and possibility

AEE
  owns bounded adaptive decisioning,
  projection validation and application

Differ
  may host selected UI, observe behavior,
  render/compose and propose changes
```

A Differ recommendation is a candidate adaptive recommendation, not a constitutional decision. It must resolve through the same AEE validation and platform constraints as any other provider output.

---

# 14. Provider-safe application contracts

Externally renderable/adaptable experiences should be expressed through three principal contracts.

## Application Projection Manifest

Describes projection-safe application topology: journeys, routes, Cartridges, tabs, capabilities, navigation relationships, components and host mappings.

It is not the application's canonical topology.

## Object Projection Contract

Defines which fields of an authoritative platform object may be exposed for a particular experience/provider and under what freshness, caching, confidentiality, authorization and mutation constraints.

Canonical rule:

> **The provider may hold a view of the object. metaMe holds the object.**

## Experience Projection

Describes the participant-specific experience that should currently be manifested.

Together:

```text
Application Projection Manifest
        +
Object Projection Contracts
        +
Current Experience Projection
        ↓
Composition / Renderer / Host
```

---

# 15. Surface residency and rendering mode are separate decisions

Every surface should carry a residency policy:

- `NATIVE_ONLY`
- `NATIVE_PREFERRED`
- `HYBRID_ALLOWED`
- `EXTERNAL_RENDER_ALLOWED`
- `EXTERNAL_HOST_ALLOWED`

Residency answers **where the surface may live**.

Rendering mode answers **how fixed, templated, compositional or adaptive the experience may be**.

These MUST NOT be conflated.

Examples:

- a `NATIVE_ONLY` constitutional signature surface may be R0 fixed;
- a `NATIVE_ONLY` sensitive dashboard could still be R2 compositional using native primitives;
- an `EXTERNAL_RENDER_ALLOWED` service chooser might be R2 generative;
- an `EXTERNAL_HOST_ALLOWED` Journey orientation may be R3 adaptive;
- a Differ-hosted environment may still deliberately render an R0 fixed constitutional handoff rather than adapt it.

Residency is determined by authority, sensitivity, consequence, confidentiality, latency and provider capability — not aesthetics.

---

# 16. Constitutional Transition Primitives

Consequential actions require a stronger rule than adaptive UI logic.

A Constitutional Transition Primitive (CTP) defines the canonical constitutional meaning and execution pathway for a consequential state transition.

```text
Many interaction channels
        ↓
Canonical CTP
        ↓
Canonical state transition
        ↓
Canonical evidence / receipt
```

The experience around an act may differ by user, persona, host or provider. The constitutional act does not.

AEE may decide **when and how** a participant should be presented with a constitutional capability. It may not redefine the capability.

Canonical separation:

> **AEE owns the experience of the act. CTP owns the constitutional meaning of the act.**

**Implementation status note:** `CTP-001` is currently a CHARTERED architectural design. The charter explicitly states that no Constitutional Runtime, CTPQube registry, schema migration or CI enforcement is yet implemented by that charter. This document therefore treats CTP as canonical target architecture, not as falsely deployed infrastructure.

---

# 17. Coherent experience across hosts

The participant should not conceptually leave a journey simply because the rendering or hosting environment changes.

Example:

```text
Differ-hosted Journey
        ↓
Native wallet/signature surface
        ↓
Differ-hosted confirmation
        ↓
Companion
        ↓
External research workspace
```

The host changes. The journey does not.

Companion can provide relational continuity while Journey Spine provides structured continuity underneath it and AEE provides experiential continuity across the host boundary.

---

# 18. Financial Services Runtime — reference vertical

The Financial Services Runtime is the reference implementation because it spans almost the entire constitutional stack vertically:

```text
Experience Research
↓
Journey / Experience Models
↓
AEE
↓
Financial Services Runtime
↓
MoneyPenny / agents
↓
Wallet / credentials / financial capabilities
↓
CTPs / authorization
↓
DVN / receipts
↓
Settlement
↓
IRL experimentation
↓
Invariant discovery
↓
DevOn / software development
↓
Deployment
↓
Observed consequence
↓
Research feedback
```

This gives the estate a narrow domain but a deep test of the whole architecture.

The reference experience should include:

- Financial Services Bridge;
- Journey Spine;
- Companion;
- MoneyPenny Advisor / Architect / Runtime;
- wallet;
- Passport / credentials;
- financial products and services;
- research surfaces;
- receipts / evidence;
- constitutional authorization;
- settlement.

Experience Models, Matrices and authoritative context remain platform-owned. Differ or any other provider receives only bounded projections.

---

# 19. MoneyPenny as the AEE / execution boundary

MoneyPenny illustrates the separation particularly well.

**Advisor** — grounded financial guidance.  
**Architect** — design of structures, products and artifacts for review/ratification.  
**Runtime** — bounded execution of authorized financial actions.

AEE may determine which mode is most appropriate to surface based on intent, journey state and experience context.

AgentiQ / MoneyPenny perform the intelligence and execution.

Consequential Runtime actions cross into constitutional authorization / CTP architecture.

A renderer may adapt service selection, orientation, explanatory presentation, information density, Advisor outputs and approved Architect views while execution authority remains platform-owned.

---

# 20. IRL and adaptive experience research

The Invariant Research Lab provides the experimental environment through which AEE can be studied rather than merely deployed.

The Financial Services Runtime can investigate questions such as:

- which rendering mode is appropriate for which class of task;
- when a fixed surface outperforms a generative one;
- when compositional UI improves useful time-to-value;
- which experience model produces better task completion;
- what information density is appropriate at different journey stages;
- when agent assistance improves outcome;
- which adaptive signals are genuine invariants versus local preferences;
- how declared, observed and inferred experience evidence should be weighted;
- where adaptive presentation creates unexpected consequence or risk;
- which surfaces can safely move outside the native runtime;
- whether experience continuity across providers improves outcomes;
- which constitutional constraints must remain invariant regardless of interface;
- how quickly and on which signals R3 adaptive recomposition should occur.

These experiments produce evidence rather than assumptions.

---

# 21. Development loop

AEE participates in the wider constitutional development loop:

```text
Experience / operational observation
↓
IRL experiment
↓
Invariant discovery
↓
IDE 2.0
↓
Constitutional / engineering decision
↓
DevOn
↓
Implementation
↓
DCIR / runtime
↓
Observed consequence
↓
Evidence
↓
Crystal
↓
Adapt / repair / ratify
```

Financial Services therefore becomes an end-to-end constitutional software laboratory in which experience design, agent behavior, constitutional controls, rendering, software engineering and observed consequence can be studied in one vertically integrated domain.

---

# 22. Development implications

Experience software should progressively separate:

```text
constitutional capability
journey definition
experience model
experience matrix
adaptive policy
experience projection
provider adapter
composition/rendering mechanism
surface implementation
```

This permits independent evolution.

A renderer can change without rewriting the journey. A journey can change without duplicating capabilities. A capability can improve without rebuilding every surface. An experience model can evolve from IRL evidence without relocating constitutional state. A third-party provider can be replaced without surrendering the participant relationship or platform authority.

---

# 23. Architectural responsibilities

| Primitive / Layer | Owns | Does not own |
|---|---|---|
| Personhood | constitutional continuity | interface |
| Persona | contextual expression / disclosure | personhood itself |
| Journey Spine | progression, dependencies, satisfaction | capability execution |
| ExQube | experience evidence | authorization |
| Experience Model | experiential possibility space | execution |
| Experience Matrix | context-to-experience mapping | permission |
| Experience Guide | recommendations | constitutional truth |
| AEE | adaptive decisioning, projection, feedback policy | consequential execution |
| AgentiQ | intelligence and bounded execution | constitutional authority |
| CopilotKit / compositor | orchestration/composition mechanism | AEE truth or constitutional authority |
| CTP | canonical consequential transition | presentation |
| DVN | verifiable evidence / receipts | experience composition |
| Registry | discovery, assurance and admissibility | primitive execution |
| Renderer / Host | presentation and delivery | authoritative platform state |

---

# 24. Canonical operating principles

1. **Personhood before interface.** The participant is the continuity anchor.
2. **Persona without fragmentation.** Personas provide contextual separation without destroying person-level continuity.
3. **Context without leakage.** Reuse authority/capability where legitimate while preserving relationship-, persona-, journey- and conversation-specific confidentiality.
4. **State before navigation.** A journey reflects meaningful state, not pages visited.
5. **Journey before screen.** Interfaces manifest journeys rather than defining them.
6. **Recommendation is not permission.** Experience intelligence may recommend; constitutional authorization decides.
7. **Adapt experience, not truth.** Presentation may change; constitutional state may not.
8. **Many channels, one constitutional act.** Consequential transitions resolve through canonical constitutional primitives.
9. **Capabilities remain reusable.** Journey and presentation orchestrate capabilities rather than duplicating them.
10. **Providers receive projections, not sovereignty.** External providers operate on bounded manifests/contracts.
11. **Evidence drives adaptation.** Declared, observed and inferred experience remain distinct and auditable.
12. **Fixed, templated, generative and adaptive are all valid.** The appropriate rendering mode is context- and consequence-dependent.
13. **Generative is not automatically adaptive.** Adaptation requires a closed observation-and-recomposition loop.
14. **Generate composition more readily than constitutional primitives.** Prefer orchestration of governed components to unconstrained generation of authority-bearing UI/action semantics.
15. **Fallback is architectural.** Loss of an adaptive provider must not remove access to constitutionally required capability.
16. **Research and runtime form one loop.** Experience evidence feeds IRL, invariant discovery, engineering and subsequent runtime adaptation.

---

# 25. Reference implementation programme

The Financial Services Runtime should turn this architecture into a falsifiable implementation programme.

## AEE Foundation
- canonical Experience Model schema;
- canonical Experience Matrix schema;
- ExQube relationship;
- rendering-mode vocabulary R0-R3;
- AEE adaptive decisioning contract;
- provider-neutral Experience Projection extension;
- observation/re-evaluation contract.

## Financial Services Model
Represent the complete Bridge → Journey → MoneyPenny → Wallet → constitutional execution → evidence → settlement experience.

## Financial Services Experience Matrices
Define adaptive matrices over participant state, persona, intent, authority, MoneyPenny mode, experience evidence, device/surface, rendering mode and provider residency.

## Provider Projection
Produce bounded Application Projection Manifest and Object Projection Contracts for Differ.

## Hybrid Experience
Exercise a Differ-hosted or other provider-hosted adaptive slice with native handoff for constitutional execution.

## CTP Integration
Progressively represent consequential financial acts through canonical CTPs once the separate CTP implementation workstream is authorized.

## IRL Experiment
Compare fixed, templated, compositional and adaptive variants where legitimate, measuring useful time-to-value, comprehension, task completion, repair risk and constitutional conformance.

## Invariant Discovery
Translate validated findings into experience, constitutional and engineering invariants.

## DevOn Integration
Use those invariants to govern subsequent implementation and deployment.

---

# 26. Current-state boundary

This framework deliberately distinguishes direction from deployed state.

As of 2026-08-31:

- provider-neutral AEE projection contracts exist in `types/adaptiveExperience.ts`;
- the contract explicitly states that metaMe / Constitutional Computing owns truth, capability, authorization, canonical topology, authoritative objects and evidence; Journey Spine owns progression; Experience Guide / ExQube informs experience; AEE optimizes projection; Differ is a reference renderer/host provider, never an authority layer;
- native projection, validation/fallback seams and Differ adapter structure have been established by the existing AEE workstream;
- Financial Services has already been used for the first AEE/Differ surface-residency audit;
- CopilotKit is present in the repository and documented as a server-side orchestration layer; this framework places it beneath AEE as an orchestration/composition mechanism rather than as the owner of adaptive truth;
- Differ's actual integration remains subject to the provider verification/scan/hosting path already documented in the Phase 0 audit;
- `CTP-001` remains a chartered target architecture and explicitly does not by itself implement a Constitutional Runtime, CTPQube registry, schema migration or CI enforcement.

Do not collapse target architecture into claims of deployed capability.

---

# 27. Architectural compression

The full framework can be expressed as:

> **A person enters with constitutional continuity. A persona establishes contextual expression. A journey establishes destination and state. Experience evidence establishes preference and prior interaction. Experience Models establish the possibility space. Experience Matrices determine what is appropriate. AEE runs the feedback loop and composes the current experience. AgentiQ performs the required intelligence and action. CTPs govern consequential transitions. DVN records evidence. Renderers and hosts manifest bounded projections. IRL observes consequence. Invariants improve the next experience.**

And the rendering model can be compressed to:

> **Fixed specifies. Templated varies. Generative composes. Adaptive observes and recomposes.**

The estate-level principle remains:

> **One person. Many personas. Many journeys. Many interfaces. One coherent constitutional experience.**
