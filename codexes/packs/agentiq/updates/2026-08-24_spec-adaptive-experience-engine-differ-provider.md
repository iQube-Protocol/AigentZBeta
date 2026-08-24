# SPEC-AEE-001 — Adaptive Experience Engine

**Status:** PROPOSED IMPLEMENTATION SPECIFICATION  
**Date:** 2026-08-24  
**Reference provider:** Differ  
**Primary upstream primitive:** Journey Spine (`SPEC-JS-001`)  
**Related primitives:** Experience Qube (ExQube), Experience Guide / Experience Matrix, Companion, Constitutional Computing, Capability Registry  
**Scope of this specification:** define the platform-native Adaptive Experience Engine and its provider boundary. Differ is the first/reference projection provider, not the source of constitutional truth and not a required dependency for the core runtime.

---

## 0. Executive proposition

The Adaptive Experience Engine decouples **what the person must or may do** from **how those possibilities are presented**.

The platform owns state, authority, journey progression, capabilities, experience intent and evidence. The Adaptive Experience Engine consumes those authoritative inputs and produces a bounded **Experience Projection**: a recommendation for how to arrange, emphasize, sequence or render available capabilities for the person in the present context.

Differ is the reference provider used to test adaptive/generative projection. It must sit behind a provider adapter so that:

- the constitutional/runtime core remains sovereign;
- provider substitution is possible;
- sensitive context can be minimized before crossing the provider boundary;
- provider failure can fall back to a deterministic platform-native projection;
- no provider may manufacture authority, authorization, capability state, journey completion or Experience Qube truth.

Canonical compression:

> **Journey Spine governs progression. Experience Guide informs preference. Adaptive Experience Engine optimizes projection. Constitutional Computing governs what may occur.**

---

# Part I — Architectural role

## 1. The interaction primitive family

The platform should treat the following as mutually aware but independently bounded first-class interaction primitives:

### Journey Spine
Owns journey state, target state, dependency structure and state-aware navigation over existing capabilities.

### Experience Qube (ExQube)
Owns durable experience evidence and intent, preserving provenance between declared, observed and inferred experience signals.

### Experience Guide / Experience Matrix
Interprets ExQube + context and proposes relevant experience preferences, interaction patterns and next-best experience candidates.

### Companion
The persistent relational/conversational threshold. Helps the person understand, orient, choose, traverse and act across both legacy-internet and Constitutional Internet contexts. The Companion may explain or invoke Journey Spine and Adaptive Experience actions, but does not own their state.

### Adaptive Experience Engine
Produces bounded presentation/navigation projections over existing capabilities, using Journey Spine state + Experience Guide recommendations + contextual constraints.

### Differ
Reference external/provider implementation for adaptive projection. Differ is not itself the Adaptive Experience Engine.

### Constitutional Computing
Supplies authoritative constitutional/runtime constraints and authorization. Recommendations and projections cannot weaken or bypass it.

Principle:

> **Mutual awareness does not imply shared authority.**

---

## 2. Companion as threshold

The Companion is architecturally adjacent to the Adaptive Experience Engine because it is the persistent human-facing bridge across contexts.

The platform may span:

- Constitutional Internet surfaces;
- legacy web applications;
- external service pages;
- embedded/hybrid experiences;
- native metaMe cartridges;
- future Differ-rendered surfaces.

The Companion should remain able to orient the person across those boundaries while Journey Spine maintains progression and the Adaptive Experience Engine determines the most appropriate projection.

The Adaptive Experience Engine MUST NOT assume that all capabilities are hosted inside a single application shell.

---

# Part II — Core rule: projection, not authority

## 3. Hard constitutional boundary

The Adaptive Experience Engine may:

- choose among already-available presentation modes;
- reorder non-dependent navigation options;
- emphasize a likely next-best action;
- suppress visual clutter where suppressed items remain accessible when constitutionally/operationally relevant;
- choose an appropriate component/layout from an approved registry;
- adapt copy, explanation depth, assistance level and information density within bounded rules;
- recommend optional actions;
- determine whether Companion-first, form-first, matrix-first or another approved interaction mode is likely to help;
- generate a host-neutral projection specification.

The Adaptive Experience Engine MUST NOT:

- grant Authority;
- create Authorization;
- mark a Journey requirement satisfied;
- fabricate a receipt or evidence state;
- alter a constitutional invariant;
- change a mandatory dependency into an optional one;
- infer consent from convenience;
- convert inferred Experience Intent into declared Experience Intent;
- disclose information beyond the provider/request disclosure policy;
- invent capabilities not present in the Capability Registry;
- execute consequential actions merely because it recommends them.

Canonical rule:

> **Adaptive projection can change experience; it cannot change constitutional truth.**

---

# Part III — Inputs

## 4. Interaction Context

The engine consumes a bounded `AdaptiveInteractionContext` assembled from authoritative owners rather than a raw application dump.

Conceptual shape:

```ts
interface AdaptiveInteractionContext {
  contextId: string;
  participantRef: string;        // appropriate tiered/pseudonymous ref
  journey?: JourneyProjectionContext;
  targetState?: string;
  capabilityRefs: CapabilityProjectionRef[];
  authorizationRefs?: AuthorizationProjectionRef[];
  experience?: ExperienceProjectionContext;
  companion?: CompanionProjectionContext;
  host: HostContext;
  environmentalContext?: Record<string, unknown>;
  disclosurePolicy: ProjectionDisclosurePolicy;
  constitutionalConstraints: ProjectionConstraint[];
  generatedAt: string;
}
```

No field grants authority merely by existing in this context.

## 5. Journey input

Journey Spine supplies only normalized projection state such as:

- current journey/phase;
- target state;
- completed steps;
- ready steps;
- optional steps;
- waiting steps;
- blocked steps;
- future steps;
- existing surface/capability references;
- actor requirements;
- state explanations where safe;
- immutable dependencies that presentation must not obscure.

Journey Spine remains authoritative for these states.

## 6. Experience input

Experience Guide / ExQube may supply:

- declared preferences;
- observed interaction evidence;
- inferred preferences, explicitly labeled as inferred;
- confidence/provenance;
- preferred assistance level;
- interaction density;
- preferred modality;
- explanation depth;
- delegation preference;
- presentation/decision support preferences;
- archetype evidence where constitutionally permitted;
- temporary session intent.

### Provenance rule

The engine must preserve:

`DECLARED ≠ OBSERVED ≠ INFERRED`

An adaptive projection may use all three according to policy, but outputs must not rewrite their provenance.

## 7. Capability input

Capabilities come from a platform Capability Registry or existing surface registry. Each adaptable capability should expose a safe projection descriptor rather than giving the provider arbitrary application control.

Conceptual descriptor:

```ts
interface CapabilityProjectionRef {
  capabilityId: string;
  label: string;
  description?: string;
  surfaceTypes: ('component' | 'modal' | 'route' | 'cartridge-tab' | 'embed' | 'companion-action')[];
  hostRefs: Record<string, string>;
  actor?: JourneyActor;
  requiredState?: string[];
  presentationPolicy?: string[];
  sensitive?: boolean;
}
```

The provider selects from declared capabilities. It does not generate callable authority-bearing endpoints.

---

# Part IV — Output: Experience Projection

## 8. Host-neutral projection

The primary output is an `ExperienceProjection`, not rendered HTML and not executable application code.

Conceptual shape:

```ts
interface ExperienceProjection {
  projectionId: string;
  contextId: string;
  provider: string;
  providerVersion?: string;
  journeyRef?: string;
  rationale?: ProjectionRationale;
  primaryAction?: ProjectionActionRef;
  secondaryActions?: ProjectionActionRef[];
  layout: ProjectionLayout;
  surfaces: ProjectedSurface[];
  companionCue?: CompanionCue;
  experienceSignalsUsed?: ExperienceSignalRef[];
  constraintsApplied: string[];
  confidence?: number;
  fallback?: boolean;
  expiresAt?: string;
}
```

The runtime validates the projection before rendering.

## 9. Projection levels

The engine should support progressively more adaptive levels without requiring all levels at launch:

### Level 0 — deterministic
Platform-defined fixed/default projection. Always available fallback.

### Level 1 — selection
Choose the best existing approved surface/component from a bounded set.

### Level 2 — composition
Compose/reorder approved blocks/components and explanatory content.

### Level 3 — bounded generative projection
Provider may generate declarative UI/presentation instructions constrained to a platform schema/component registry.

### Level 4 — open generative interface
Out of scope for initial implementation. Any future support requires new constitutional/security review.

Differ should initially operate at Level 1–2, optionally Level 3 only if a real provider API and safe declarative schema are verified.

---

# Part V — Provider architecture

## 10. Provider-neutral core

Implement the Adaptive Experience Engine behind a provider interface.

```ts
interface AdaptiveExperienceProvider {
  id: string;
  capabilities(): Promise<ProviderCapabilityManifest>;
  project(input: ProviderProjectionRequest): Promise<ProviderProjectionResponse>;
  health?(): Promise<ProviderHealth>;
}
```

Initial providers:

- `native` — deterministic platform fallback/reference baseline;
- `differ` — reference adaptive provider once verified/integrated.

Provider-specific API assumptions MUST NOT leak into Journey Spine, ExQube, Companion or capability definitions.

## 11. Differ adapter

Differ should be integrated only through:

`services/adaptive/providers/differAdapter.ts`

or equivalent repository convention.

The adapter owns:

- authentication;
- provider-specific request mapping;
- provider-specific response parsing;
- timeouts/retries;
- capability negotiation;
- provider version/model metadata;
- error normalization;
- disclosure minimization;
- conversion into the canonical `ExperienceProjection` schema.

The platform-native engine remains responsible for preflight and postflight validation.

### Provider verification gate

Before coding against Differ, Claude/DevOn must verify the actual current Differ integration surface/API/SDK and document:

`PROVIDER CAPABILITY | VERIFIED API/SDK | AUTH | LATENCY | STATEFUL? | UI OUTPUT MODE | DATA RETENTION | LIMITATIONS`

If no suitable stable API exists, implement the provider interface + a truthful disabled/unavailable Differ adapter and keep the native provider operational. Do not invent an API.

---

# Part VI — Adaptive decision loop

## 12. Runtime loop

```text
Authoritative Runtime State
      +
Journey Spine State
      +
Capability Registry
      +
ExQube / Experience Guide
      +
Companion Context
      +
Host Context
      ↓
Adaptive Context Assembly
      ↓
Constitutional / Disclosure Preflight
      ↓
Adaptive Experience Provider
(native or Differ)
      ↓
Experience Projection
      ↓
Projection Validation
      ↓
Host Renderer / Journey Spine / Companion
      ↓
Human interaction
      ↓
Observed outcome + consequence
      ↓
Experience Evidence
      ↓
ExQube / Experience Guide update
      ↺
```

This is a cybernetic experience loop. Adaptation is evidence-bearing rather than a one-way personalization decision.

## 13. Next Best Action vs Next Best Experience

Keep these distinct:

- **Next Best Action (NBA):** which available action is likely to advance the journey or objective.
- **Next Best Experience (NBX):** how the available action(s) should be presented or supported for this person/context.

Journey Spine + capability/state determine the eligible action space.

Experience Guide + Adaptive Engine may recommend NBA among eligible options and optimize NBX.

Neither may authorize an otherwise unauthorized action.

---

# Part VII — Safety, privacy and constitutional confidentiality

## 14. Data minimization

External provider requests should use the smallest sufficient context.

Prefer:

- T2/pseudonymous participant refs;
- abstract experience signals;
- capability IDs/descriptors rather than private payloads;
- journey states rather than underlying confidential evidence;
- authorization result/status rather than secret policy/credential contents;
- sanitized host context.

Do not send raw identity, private artifacts, secrets, Passport credentials, confidential research content, or unrestricted ExQube data merely to improve UI adaptation.

## 15. Provider boundary classes

Each field in the Adaptive Interaction Context should be classifiable:

- `LOCAL_ONLY`
- `PROVIDER_SAFE`
- `PROVIDER_SAFE_REDACTED`
- `PROHIBITED_EXTERNAL`

The provider request builder must enforce this server-side.

## 16. Fail-closed / fail-useful

Provider failure MUST NOT break the journey or constitutional capability.

If Differ is unavailable, slow, invalid or returns a projection that fails validation:

`Differ failure → native deterministic projection`

The action remains available through the platform where authorized.

The adaptive layer should degrade gracefully, never fail the underlying constitutional workflow merely because personalization/generative projection failed.

---

# Part VIII — Projection validation

## 17. Postflight validator

Every provider output passes a platform validator before projection/rendering.

Validator checks:

- every capability/action reference exists;
- no blocked/unauthorized action is presented as executable;
- mandatory journey states are not omitted in a way that falsely implies completion;
- optional/future states remain correctly labeled;
- principal-only acts are not delegated by presentation;
- sensitive surfaces obey disclosure policy;
- host renderer supports requested layout/surfaces;
- no provider-supplied executable code enters trusted runtime in initial phases;
- projection schema is valid;
- copy does not fabricate receipts/state/authority.

Rejected projection → receipt/telemetry + native fallback.

---

# Part IX — Host adapters

## 18. Platform-native first

Initial host is metaMe/AigentZBeta.

Provider output is rendered through existing platform components and Journey Spine surfaces.

## 19. Hybrid/Differ future

The engine should be designed so the same Experience Projection may later be projected through:

- metaMe native shell;
- a Next.js portable Journey/Experience surface;
- Differ-hosted or Differ-rendered hybrid surface;
- embedded external/legacy web surface where appropriate;
- Companion-led interaction.

This is why the provider output must be declarative and host-neutral.

No extraction to a standalone app is required in Phase 1. Establish clean contracts now; deploy platform-native first.

---

# Part X — Experience learning

## 20. Experience evidence

Every adaptive decision can produce non-sensitive evidence such as:

- projection selected;
- provider/native path;
- experience signals used;
- options shown;
- option selected;
- time to next required state;
- abandonment/backtrack;
- Companion assistance requested;
- override/correction;
- authorization refusal encountered;
- journey consequence/outcome;
- user feedback where given.

Do not equate behavior with declared preference.

## 21. ExQube update discipline

Adaptive outputs may suggest new inferred experience signals.

Observed interaction may create observed evidence.

Only explicit person action can create/modify declared intent.

Conceptual flow:

`projection → interaction → observed evidence → inference candidate → Experience Guide → ExQube`

with inspect/correct/remove controls required as ExQube matures.

---

# Part XI — Journey Spine integration

## 22. Contract with Journey Spine

Journey Spine supplies current navigational truth.

Adaptive Experience Engine returns a projection over that truth.

The engine may say:

- show Passport as the primary ready action;
- recede completed onboarding into history;
- emphasize "Upload directly" because the participant has declared direct-working preference;
- offer delegated-agent submission as a secondary path;
- use a technical matrix rather than conversational walkthrough;
- ask Companion to explain a WAITING state.

It may NOT say:

- Passport is complete when it is not;
- freeze attestation is optional when Journey Spine says required;
- counterparty has signed when no evidence exists;
- an agent can perform a principal-only attestation;
- exchange can cross before the reciprocal gate.

## 23. Ian/OCSGA as first bounded adaptive case

Do not make Ian's first journey depend on Differ.

Ian Journey Spine ships with deterministic native projection first.

Once Differ adapter is verified, use the same journey as the first low-risk adaptive comparison:

### Native arm
State-aware Journey Spine + platform default projection.

### Differ arm
Identical Journey/authorization/capability truth + adaptive projection.

Possible measurements:

- time to understand journey;
- time to Passport/artifact/freeze/signature completion;
- unnecessary interactions;
- Companion interventions;
- backtracks;
- user-reported clarity;
- projection overrides;
- completion without assurance loss.

No experiment should deliberately risk the formal exchange merely to test UI adaptation. Run shadow/recommendation comparison where needed.

---

# Part XII — Initial implementation phases

## 24. Phase A — core contracts

Build:

- `AdaptiveInteractionContext`;
- `ExperienceProjection`;
- provider interface;
- native deterministic provider;
- preflight disclosure policy;
- postflight projection validator;
- Journey Spine adapter;
- Companion cue seam;
- ExQube/Experience Guide seam using existing substrate where available;
- telemetry/evidence structure.

No external provider dependency required.

## 25. Phase B — Differ forensic integration

Before implementation, verify current Differ capabilities and integration method.

Then implement:

- Differ provider adapter;
- provider health/fallback;
- mapping to/from canonical projection;
- server-side data minimization;
- timeout/circuit-breaker behavior;
- provider-level observability;
- safe shadow mode.

## 26. Phase C — bounded live adaptation

Enable Level 1 selection and Level 2 composition for a small approved capability/component registry.

Do not allow arbitrary provider-generated executable code.

Start with Journey Spine surfaces, because their state/dependency envelope is explicit and measurable.

## 27. Phase D — evidence + optimization

Use IRL/Experience research to compare projections and derive candidate experience/journey invariants.

Possible candidate hypotheses:

- state-aware adaptive projection reduces unnecessary interaction without reducing constitutional assurance;
- progressive experience declaration outperforms prerequisite profiling;
- Experience-aware navigation improves time-to-value relative to fixed navigation;
- Companion + Journey Spine + adaptive projection reduces orientation failures across heterogeneous/legacy surfaces.

These remain research candidates until tested.

---

# Part XIII — Acceptance criteria

The Adaptive Experience Engine v1 is successful when:

1. Journey Spine can run entirely without an external adaptive provider.
2. A provider-neutral Adaptive Experience Engine consumes Journey + Capability + Experience context.
3. The engine produces a validated host-neutral Experience Projection.
4. Native deterministic provider is always available.
5. Differ is isolated behind a provider adapter and can be disabled/substituted.
6. External provider requests are data-minimized and policy-filtered server-side.
7. Provider outputs cannot alter authoritative Journey/authorization/evidence state.
8. Invalid/failed provider projection falls back to native without breaking the journey.
9. Declared/observed/inferred Experience signals remain provenance-distinct.
10. Companion can consume projection/journey cues but remains independently bounded.
11. Existing capabilities are reused; no parallel UI implementation is required to become adaptive.
12. Projection decisions and consequences can generate evidence for later Experience/IRL analysis.
13. Initial live adaptation is bounded to approved components/surfaces rather than arbitrary generated executable UI.
14. The same Journey definition can render through native and Differ-backed projection without changing constitutional/runtime truth.

---

# Part XIV — Forensic build instruction

Before changing code, Claude/DevOn must audit the current repository for:

- Guided Journey Runtime / Journey Spine implementation state;
- existing Experience Qube / Experience Guide / Experience Matrix primitives;
- current Companion context contracts;
- capability/surface registries;
- adaptive/generative UI code already present;
- host/embed/iFrame infrastructure;
- data-classification/privacy utilities;
- constitutional authorization/state projection seams;
- telemetry/receipt/evidence systems suitable for adaptive decisions;
- any prior Differ integration or credentials/configuration.

Report:

`PRIMITIVE | BUILT | PARTIAL | ABSENT | AUTHORITATIVE OWNER | REUSE | GAP`

Then implement the thinnest architecture that preserves these boundaries.

---

## Final architectural compression

```text
                       COMPANION
                    persistent threshold
                          ↕
EXQUBE ↔ EXPERIENCE GUIDE ↔ JOURNEY SPINE ↔ CAPABILITY REGISTRY
   ↘             ↘              ↙
          ADAPTIVE EXPERIENCE ENGINE
             native | Differ
                    ↓
          EXPERIENCE PROJECTION
                    ↓
        native / hybrid / legacy host
                    ↓
               interaction
                    ↓
         consequence + experience evidence
                    ↺

        CONSTITUTIONAL COMPUTING BELOW ALL
     authority • state • authorization • evidence
```

> **The Adaptive Experience Engine changes the route and presentation through capability. It does not change the constitutional conditions under which capability may be exercised.**
