# Adaptive Experience Engine — Phase 0 Audit: Differ Provider Verification + Financial Services Surface Residency

**Status:** AUDIT COMPLETE (read-only/shadow) — implementation follows per findings
**Date:** 2026-08-24
**Parents:** `2026-08-24_spec-adaptive-experience-engine-differ-provider.md` (SPEC-AEE-001), `2026-08-24_spec-adaptive-experience-engine-phase2-differ-hosting-and-fs-audit.md` (SPEC-AEE-001A)
**Grounding:** `codexes/packs/irl/foundation/PRD-MPY-001_moneypenny-constitutional-financial-services-agent.md`
**Reference journey:** `services/journey/horizenMoneyPennyJourney.ts` (Horizen × MoneyPenny Constitutional Admission Journey)
**Method:** Forensic codebase audit only. No live journey was altered. No Differ credentials were invoked (none exist).

---

## 0. Headline finding — Differ has zero verified capability surface in this repository

Searched the entire repository (case-insensitive `differ`, `package.json`, `.env.example`, all `services/`, `types/`) for any existing Differ integration:

- **No SDK dependency** in `package.json`.
- **No environment variable** referencing Differ in `.env.example`.
- **No `services/adaptive/` directory** and no Differ adapter file anywhere in the tree.
- **No credentials, no API base URL, no client wrapper.**
- The only two files in the repository that mention "Differ" as a proper noun are the two authoritative specs themselves (`2026-08-24_spec-adaptive-experience-engine-differ-provider.md`, `...-phase2-differ-hosting-and-fs-audit.md`).

**Conclusion (per SPEC-AEE-001 §11, "Provider verification gate"):** no suitable stable Differ API exists in or is reachable from this codebase today. Per the spec's own instruction — *"If no suitable stable API exists, implement the provider interface + a truthful disabled/unavailable Differ adapter and keep the native provider operational. Do not invent an API"* — this audit implements exactly that and nothing more. **No Differ capability is claimed, assumed, or invented anywhere below.**

### Provider Capability Matrix (required output #1)

| PROVIDER CAPABILITY | VERIFIED API/SDK | AUTH | LATENCY | STATEFUL? | UI OUTPUT MODE | DATA RETENTION | LIMITATIONS |
|---|---|---|---|---|---|---|---|
| Differ — rendering | **NONE FOUND** | unknown | unknown | unknown | unknown | unknown | No integration surface exists in this repo. Nothing can be verified until an operator supplies real API/SDK access. |
| Differ — hosting | **NONE FOUND** | unknown | unknown | unknown | unknown | unknown | Same as above. |
| Differ — component composition | **NONE FOUND** | — | — | — | — | — | Same as above. |
| Differ — route resolution | **NONE FOUND** | — | — | — | — | — | Same as above. |
| `native` (platform-native reference provider) | **VERIFIED** — this audit builds it | none (in-process) | ~0ms (deterministic, no network) | stateless | JSON `ExperienceProjection` consumed by existing platform renderers | none (no external retention) | Level 0/1 only; no generative capability |

`AdaptiveHostProviderManifest` for Differ (SPEC-AEE-001A §3) therefore resolves, honestly, to:

```json
{
  "providerId": "differ",
  "canRender": false,
  "canHost": false,
  "canComposeComponents": false,
  "canResolveRoutes": false,
  "canPersistPresentationState": false,
  "supportedProjectionLevels": [],
  "supportedSurfaceTypes": [],
  "dataBoundary": "provider-stateful"
}
```

Every field above is `false`/`[]`/unknown **because nothing has been verified**, not because Differ is assumed incapable. If an operator supplies real Differ API/SDK access, this manifest is the first thing to update — from evidence, not from the parent spec's illustrative examples.

---

## 1. Forensic build instruction — existing primitive inventory (SPEC-AEE-001 Part XIV)

| PRIMITIVE | BUILT | PARTIAL | ABSENT | AUTHORITATIVE OWNER | REUSE | GAP |
|---|---|---|---|---|---|---|
| Guided Journey Runtime / Journey Spine | ✅ BUILT | | | `types/journey.ts`, `services/journey/resolveJourneyState.ts` | Reuse directly — `InteractionContext` already carries a `presentationHints` field explicitly reserved "for future Differ" (`types/journey.ts` §"Presentation hints") | None — this is the exact seam AEE consumes |
| Experience Qube / Experience Guide / Experience Matrix | | ✅ PARTIAL | | `types/experienceGuide.ts` (Personal ExperienceGuide — Sphere/Maturity lattice) | The existing ExperienceGuide is a *different* experience model (life-sphere maturity) than SPEC-AEE-001's declared/observed/inferred provenance triad — reuse its persistence pattern (`personalGuide` on ExperienceQube), not its schema | `ExperienceIntentProjection` (Journey Spine, `types/journey.ts`) is the closer match for AEE's declared/observed/inferred contract — use that, not ExperienceGuide's lattice |
| Companion context contracts | | ✅ PARTIAL | | `services/companion/overlayComposition.ts`, `CompanionJourneyContext` (`types/journey.ts`) | Reuse `CompanionJourneyContext` bounded-intent pattern (`CompanionJourneyIntent` enum has **no sovereign-act code path** — a real precedent for AEE's "recommend, never authorize" rule) | AEE's `CompanionCue` (SPEC-AEE-001 §8) is new but should mirror this shape, not duplicate it |
| Capability/surface registries | ✅ BUILT | | | `services/constitutional/capabilityRegistry.ts` (CFS-032, real registered-capability objects with Standing bands); `services/journey/journeySurfaceRegistry.ts` (stage surface → real route/tab/component mapping) | **Direct precedent for the Application Projection Manifest** — `journeySurfaceRegistry.ts`'s comment block already documents exactly the "surface reuse, never forked" discipline SPEC-AEE-001A asks for | Neither registry is *provider-safe* today — both assume an internal (native) caller. AEE needs a redaction/projection layer in front of them, not a replacement |
| Existing rendering-provider seam precedent | ✅ BUILT | | | `types/experienceRenderer.ts` (CFS-007 Law VI) | **This is the strongest reuse candidate in the repo.** It already separates "architecture" (`ExperiencePrescription`) from "rendering" (`ExperienceRenderer<TOutput>` interface, `liquid` and `a2ui` adapters) — precisely the renderer/host separation SPEC-AEE-001A §3 asks AEE to establish for Differ. AEE's provider interface should be modeled on this file's shape, explicitly as a sibling seam (a third adapter kind), not a parallel invention | `ExperiencePrescription` is React-adjacent (liquid templates, A2UI payloads) — AEE's `ExperienceProjection` is a superset (adds journey/capability/rationale/validation) and should stay its own type, but the *pattern* (`id`, `capabilities()`, adapter registered where its mechanism runs) transfers directly |
| Swappable-provider precedent (CFS-018) | ✅ BUILT | | | `services/constitutional/agreementProviders.ts` | Direct precedent for `AdaptiveExperienceProvider` — `local`/`x409` providers behind one interface, env-gated, "when unconfigured it fails honestly (never a silent fake)" is the exact discipline this audit applies to the Differ adapter below | None |
| Adaptive/generative UI code already present | | | ✅ ABSENT | — | — | No Level 1–3 adaptive projection code exists anywhere in the repo prior to this audit |
| Host/embed/iframe infrastructure | ✅ BUILT | | | `services/journey/journeySurfaceRegistry.ts` (`kind: 'embed'`, `buildCodexUrl`), `types/journey.ts` `JourneySurfaceMode` (`iframe`, `component`, `external-url`) | Reuse directly for Mode 0/1 hosting — no new host adapter needed until Differ is verified | None for Mode 0/1; Mode 2+ hosting has no code yet (correctly — out of first-pass scope) |
| Data-classification/privacy utilities | ✅ BUILT | | | Identity & Access Spine (T0/T1/T2 tiers, CLAUDE.md); `hashPersonaRef`/`personaPublicRef` (`services/identity/personaReferences.ts`) | Directly reusable for AEE's "provider boundary classes" (SPEC-AEE-001 §15) — T0/T1/T2 already *is* almost exactly `LOCAL_ONLY`/`PROVIDER_SAFE`/`PROHIBITED_EXTERNAL` | Map T0→PROHIBITED_EXTERNAL, T1→PROVIDER_SAFE, T2→PROVIDER_SAFE (redacted where needed) explicitly in the new adaptive context builder — do not invent a fourth classification vocabulary |
| Constitutional authorization/state projection seams | ✅ BUILT | | | `services/constitutional/constitutionalAgreement.ts` (409 gate, spend cap), `types/access.ts` (`AuthorityProjection` already exists in `types/journey.ts` too) | Reuse `AuthorityProjection` verbatim — do not build a second authority-projection type for AEE | None |
| Telemetry/receipt/evidence systems suitable for adaptive decisions | ✅ BUILT | | | `services/receipts/activityReceiptService.ts`, `services/dvn/activityReceiptDvnPipeline.ts` | Reuse `createActivityReceipt` for AEE's "experience evidence" (SPEC-AEE-001 Part X) — add a new non-anchorable-by-default action type, do not build a parallel telemetry store | Per CLAUDE.md's DVN Pipeline Protection, the ONLY unilateral change permitted to the DVN pipeline is adding a new action type to `ANCHORABLE_ACTION_TYPES` — this audit does not do so; AEE evidence starts as ordinary (non-DVN-anchored) receipts unless/until an operator ratifies anchoring |
| Any prior Differ integration or credentials/configuration | | | ✅ ABSENT | — | — | Confirmed absent — see §0 |

---

## 2. Financial Services Surface Residency Matrix (required output #2)

Audit of every stage/surface in `services/journey/horizenMoneyPennyJourney.ts` (the Horizen × MoneyPenny Constitutional Admission Journey, the mature reference implementation named by SPEC-AEE-001A §10). **This journey was not altered — read-only audit.**

| STAGE | SURFACE | CANONICAL OWNER | DATA NEEDED | ACTIONS | AUTHORITY SENSITIVITY | CURRENT HOST | DIFFER RENDER? | DIFFER HOST? | REQUIRED ADAPTER | RISK | RECOMMENDATION |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `register` | `horizen-registry-agent-page` (external-url, unresolved), `register-agent-panel` | Horizen (external) + native component | Wallet-signed mandate, registry tx state | view-registration | High — wallet-mediated ceremony, principal mandate signature | Native / external | Unverified — N/A while Differ unverified | No | Object Projection Contract for registration state (read-only) | Wallet-signing UI must never leave native custody | `NATIVE_ONLY` |
| `claim` | `marketa-eligibility-view` | Native component (`services/passport/externalAgentAdmission.ts`) | Wallet control-proof challenge/response | prove-wallet-control | High — proves private-key control without revealing it | Native | Unverified | No | — | Cryptographic proof ceremony must stay native | `NATIVE_ONLY` |
| `orient` | `orientation-panel` | Native component (`services/journey/orientationContext.ts`) | Contextual ritual state, operator acknowledgment | acknowledge-orientation-ritual | Medium — records a real constitutional acknowledgment receipt | Native | **Yes, plausible** — explanatory/orientation framing is read-mostly | Not yet | Object Projection Contract for orientation state (read) + native handoff for the POST acknowledgment | Low if projection is read-only and the acknowledgment POST stays native | `EXTERNAL_RENDER_ALLOWED` (render only; the write stays native) |
| `passport` | `venture-participate-apply` | Native (Venture Lab α Participate module) | Passport/personhood state, sponsorship | record-sponsorship | High — personhood/Passport issuance | Native | Unverified | No | — | Passport issuance is explicitly named `NATIVE_ONLY` by SPEC-AEE-001A §8 | `NATIVE_ONLY` |
| `activate` | `ingest-into-factory-action`, `venture-participate-standing` (registry section) | Native (`IngestionFactoryPanel`) | Registry activation state (derived) | none (derived transition) | Low — a derived constitutional fact, not an act | Native | **Yes, plausible** — read-only registry-state display | Not yet | Object Projection Contract for registry activation state | Low — display only, no write surface | `EXTERNAL_RENDER_ALLOWED` |
| `delegate` | `venture-participate-delegation` | Native (Bounded Delegation module) | Delegation grant, bootstrap approval | approve-bounded-delegation, ratify-bootstrap | High — establishes the authority envelope | Native | Unverified | No | — | Delegation grant is a principal-only consequential act | `NATIVE_ONLY` |
| `aigentme` ("Operate") | `aigentme-welcome` (iframe) | Native (aigentMe shell) | aigentMe activation, focus-disposition | record-focus-disposition | Medium — companion activation, one recorded disposition | Native | **Out of first-pass scope** — this is exactly the "dense Operate stage" the addendum tells us not to widen into. Classified `DEFER_TO_LATER_AUDIT` | Not yet | — | Widening here would violate the addendum's explicit scope boundary | `NATIVE_PREFERRED`, deferred audit |
| `verify` ("Ratify") | `constitutional-agreement-ratify` (primary), `pulse-transparency-toggle`, `horizen-agent-page-verify` (secondary) | Native (`services/constitutional/constitutionalAgreement.ts`) | Agreement form/accept/authorize state | form-agreement, accept-agreement, authorize-agreement, authorize-pnl-disclosure | High — the constitutional agreement authorization act itself | Native | Secondary transparency surfaces: **plausible read-only**. Primary agreement ratify: **no** | No | Object Projection Contract for agreement/Pulse/P&L state (read) | Authorization act (`authorize-agreement`) must never be presented as executable by a non-authoritative renderer | Primary surface `NATIVE_ONLY`; secondary transparency surfaces `EXTERNAL_RENDER_ALLOWED` |
| `deploy` ("Ingest", legacy/internal) | none (surfaces moved to `activate`) | Native | Factory ingestion evidence | prepare-payment-mandate, execute-payment | Medium | Native | N/A — no visible surface | No | — | No visible surface to classify | `NATIVE_ONLY` (internal only) |
| `standing` ("Stand") | `venture-participate-standing-only` | Native (Standing module) | Standing accrual state | view-standing | Low — read-only observed state | Native | **Yes, plausible** — pure read-only display | Not yet | Object Projection Contract for Standing state | Low | `EXTERNAL_RENDER_ALLOWED` |
| Journey bar/spine (cross-cutting) | `JourneyRunSurface` (component, not in surfaces list) | Native (`components/journey/JourneyRunSurface.tsx`, referenced by code comments; not directly read in this audit) | Full `JourneyRuntimeState` + `InteractionContext` | navigation only | Low — navigation, not authorization | Native | **Yes — this is the named first candidate** in both specs (SPEC-AEE-001 §23, SPEC-AEE-001A §13) | Not yet — Mode 1 (external renderer, native host) only | `AdaptiveExperienceProvider` + Journey Spine adapter (built below, native only) | Low if projection validation (Part VIII) is enforced before render | `EXTERNAL_RENDER_ALLOWED` (Mode 1 first) |
| Companion guidance (cross-cutting) | `CompanionJourneyContext` | Native (`services/companion/overlayComposition.ts` pattern) | Stage explanation, missing requirements, available actions | EXPLAIN_STAGE, OPEN_SURFACE, SHOW_EVIDENCE (never a sovereign act — see `CompanionJourneyIntent`, no sovereign-act variant exists) | Low — the type already structurally forbids sovereign acts | Native | Plausible for cue-rendering only | Not yet | `CompanionCue` seam (SPEC-AEE-001 §8) | Low — the type system already enforces the constraint | `EXTERNAL_RENDER_ALLOWED` (cues only) |
| Route/slug dependencies | `data/codex-configs.ts`, `utils/codex-nav.ts` (`buildCodexUrl`) | Native | Canonical slugs | navigation | Low | Native | N/A until Mode 2+ | No | `ProjectedRouteRef` (not built — no Mode 2 candidate yet) | Slugs remain platform-owned per SPEC-AEE-001A §5 regardless | `NATIVE_ONLY` for slug ownership; a route *projection* is future Mode 2+ work, out of scope now |
| Persona guards | Identity & Access Spine (`getActivePersona`, `personaFetch`) | Native | T0 persona/auth identifiers | — | Highest — T0 identifiers | Native | Never | Never | N/A | T0 must never cross the provider boundary (CLAUDE.md Identity & Access Spine; SPEC-AEE-001 §14) | `NATIVE_ONLY`, absolute |
| Wallet/credential interactions | Register/Claim/Passport/Delegate stages | Native | Wallet signatures, credentials | — | Highest | Native | Never | Never | N/A | Same as above | `NATIVE_ONLY`, absolute |

---

## 3. MoneyPenny Advisor / Architect / Runtime Experience Residency Matrix (required output #3)

Audited from `app/(shell)/moneypenny/components/ServiceOrchestrationPanel.tsx` + `serviceOrchestrationPanelState.ts`, `services/financialServices/serviceCatalog.ts`, `types/financialServices.ts`, `app/api/moneypenny/runtime/route.ts`. This is the **real, live MoneyPenny mode chooser** — not a hypothetical surface. It already exists as `ServiceOrchestrationPanel` and already resolves discovery/eligibility per-agent with careful cross-agent state isolation (`compositeKey(agentId, serviceId)`).

| MONEYPENNY MODE | USER INTENT | CURRENT SURFACE | INPUT OBJECTS | OUTPUT OBJECTS | ACTIONS | CONSEQUENCE CLASS | AUTHORIZATION SENSITIVITY | EXPERIENCE GUIDE SIGNALS | DIFFER RENDER? | DIFFER HOST? | NATIVE HANDOFF REQUIRED? | RISK | RECOMMENDATION |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Advisor** (`moneypenny.advisor`) | Get grounded, cited FS guidance | `ServiceOrchestrationPanel` intent box → `AdvisorDisplayOutput` (cited text) | Free-text intent, discovered service definition | Cited advisory text (`AdvisorDisplayOutput`) | none — read-only, `serviceClass: 'INFORMATIONAL'`, `executionReachable: false` | INFORMATIONAL | None — `governancePath: 'NONE'`, no authorization mechanism engaged at all | Preferred explanation depth, technical-vs-guided framing (declared, not yet wired to a real Experience Guide instance) | **Yes, plausible** — the output is a plain cited-text projection, not an authority-bearing UI | Unverified — no Differ hosting exists to evaluate | No — nothing here executes; native fallback is simply "render the same text natively" | Low | `EXTERNAL_RENDER_ALLOWED` |
| **Architect** (`moneypenny.architect`) | Get a proposed financial structure/product design | Same panel → `ArchitectDisplayOutput` (proposal title/preview/artifactId) | Free-text intent | Artifact proposal preview + `artifactId` reference (the *artifact itself* stays in the platform artifact runtime — `saveArtifactRecord`) | none — `serviceClass: 'PROPOSAL'`, `executionReachable: false` | PROPOSAL | None at proposal stage — the artifact is a design target for human ratification, never an executed instruction | Same as Advisor | **Yes, plausible for the preview/summary** — the full artifact object stays native (Object Projection Contract needed, not built yet) | Unverified | Yes — opening/ratifying the full artifact must hand off to the native artifact runtime | Low for preview; the full artifact object must not be exported wholesale without a contract | `EXTERNAL_RENDER_ALLOWED` for the summary card; full artifact view stays `NATIVE_PREFERRED` until an Object Projection Contract exists for artifacts |
| **Runtime — Constitutional** (`moneypenny.runtime.constitutional`, `governancePath: 'CONSTITUTIONAL_SERVICE_PIPELINE'`) | Execute a bounded, receipted financial action | Same panel → `RuntimeExecutionDisplayOutput` (domain/executed/agreementId/summary) | Free-text intent, domain, live agreement state (409 gate) | Execution summary + `agreementId` | Fires `runConstitutionalServicePattern` in `shadow` or `authoritative` mode via `/api/moneypenny/runtime` | **CONSEQUENTIAL** | High — the 409 gate + spend cap + (for money-moving domains) World-ID grade all apply | N/A at this phase — Runtime pre-action orientation could show explanation depth, but the execution boundary itself is not adaptive | **Pre-action orientation only, plausibly** — explaining what Runtime *would* do | **No — never in this pass** (spec Part XI explicit instruction: "Do not move consequential MoneyPenny Runtime execution into Differ in the first pass") | **Yes, absolute** — every authoritative call must originate from and complete inside native constitutional surfaces | High if execution boundary is ever exposed; the spec's own instruction already forbids this | `NATIVE_ONLY` for the execution act. Pre-action explanatory framing only is `EXTERNAL_RENDER_ALLOWED` — the actual "Execute"/"Authorize" control must render natively, never through a projected surface |
| **Runtime — Confidential** (`moneypenny.runtime`, `governancePath: 'CONSTITUTIONAL_COMMERCE'`) | Execute via the VELA-001 constitutional-commerce ontology (attested/TEE path) | Same panel, same output shape as above but governed by `composeUnifiedConsequenceProjection`/Vela attestation | Same + Vela attestation state | Execution summary | Fires the frozen VELA-001 authoritative path (`CONFIDENTIAL_CONSEQUENCE_PROJECTION`) | **CONSEQUENTIAL**, highest — the only service that can reach `AUTHORISED` under Gate 2's frozen exception | Highest — attestation-gated, currently cannot even reach `AUTHORISED` without a live `NITRO_ATTESTED` deployment (`tests/financial-services-runtime.test.ts`) | N/A | Same reasoning as Constitutional Runtime — pre-action orientation only | **No, absolute** | **Yes, absolute** | Highest — this is the most consequence-sensitive surface in the entire audited system | `NATIVE_ONLY` for execution. No projection of any kind for the execution control itself |
| Mode chooser / discovery UI itself | "Which mode should I use, and am I eligible?" | `ServiceOrchestrationPanel`'s agent-select + discovery list + readiness layers (`RuntimeReadinessProjection`) | `DiscoveredService[]`, `EligibilityResult`, `AuthorityPrerequisite`, `RuntimeReadinessProjection` — all already-derived, read-only projections | Rendered readiness/eligibility badges | Selecting an agent, selecting a service (navigation, not execution) | INFORMATIONAL (it is itself a discovery view, not an action) | Low — it displays derived readiness, computes nothing authoritative | Preferred density/explanation-depth signals apply well here — this is exactly a "service chooser/orientation" surface named by SPEC-AEE-001A §10 | **Yes — the named first candidate** for MoneyPenny (SPEC-AEE-001A §13: "MoneyPenny service chooser/orientation") | Unverified | No — it is read-only navigation | Low | `EXTERNAL_RENDER_ALLOWED` — this is the safest, most concrete first MoneyPenny slice |

**Entry/selection today:** the mode chooser already exposes Advisor/Architect/Runtime-Constitutional/Runtime-Confidential explicitly and distinctly (see `PROVIDER_MODE_LABELS`/`governancePath` handling in `serviceOrchestrationPanelState.ts` and the panel component) — there is **no implicit-navigation gap** to close here. The existing UI is already mode-explicit, contrary to what an unaudited assumption might expect.

**Journey Spine surfacing of MoneyPenny inside Operate:** the Horizen×MoneyPenny journey's `aigentme` stage (labeled "Operate") does not yet reference `ServiceOrchestrationPanel` or the FS service catalog as a stage surface — MoneyPenny's FS modes are reached today via the standalone `app/(shell)/moneypenny/` shell, not via a Journey Spine stage. Wiring Journey Spine to surface the service chooser inside Operate is a **real, identified gap**, but per the addendum's own scope boundary this audit does **not** widen into redesigning Operate's dense stage — it is named here as a gap for a future, explicitly-scoped pass, classified below.

### Scope-boundary classification (SPEC-AEE-001A §10, required)

| Adjacent system | Classification | Reasoning |
|---|---|---|
| aigentMe | `DEFER_TO_LATER_AUDIT` | Encountered only as the Operate-stage host iframe; not required to understand or operate any MoneyPenny mode surface. The MoneyPenny mode chooser runs standalone today. |
| Aigent Z | `DEFER_TO_LATER_AUDIT` | Not encountered anywhere in the audited MoneyPenny/Journey Spine surfaces. |
| DevOn | `DEFER_TO_LATER_AUDIT` | Not encountered. |
| Wider metaMe UI/UX | `DEFER_TO_LATER_AUDIT` | Not encountered beyond the Journey Spine's own `JourneySurfaceRegistry` composition pattern, which is already in scope as reuse, not as new scope. |
| Companion (`overlayComposition.ts` pattern) | `INTEGRATION_SEAM_ONLY` | Genuinely adjacent (Companion cues are part of SPEC-AEE-001 Part VI), but only its existing bounded-intent seam is touched — Companion itself is not redesigned. |

---

## 4. Application Projection Manifest v0.1 (required output #4)

This is a **provider-safe projection**, not the canonical route database (SPEC-AEE-001A §4 — "The manifest is not the canonical route database"). It is built from `journeySurfaceRegistry.ts` and the FS journey/catalog audited above, with all T0-tier fields stripped.

Implemented as `services/adaptive/applicationProjectionManifest.ts` (see Implementation section below) with this conceptual shape, populated for the Financial Services slice only:

```
applicationId: "financial-services-journey-spine"
journeyRefs: [ { journeyId: "horizen-moneypenny-admission", ... } ]
routes: [ ...one ProjectedRouteRef per audited stage surface, hostRefs.native populated, hostRefs.differ omitted (unverified)... ]
cartridges: [ moneypenny shell reference only — read-only descriptor, not a route grant ]
tabs: []   // no cartridge-tab surfaces are in the bounded first-pass scope
capabilities: [ CapabilityProjectionRef entries for: journey-navigation, moneypenny-advisor, moneypenny-architect, moneypenny-runtime-orientation (NOT moneypenny-runtime-execution — deliberately excluded, matching the residency matrix) ]
componentRegistry: []   // no Differ-safe component registry exists yet — deferred until Differ is verified
navigationEdges: [ stage-to-stage edges mirroring horizenMoneyPennyJourney.ts's nextStageId graph ]
dataContracts: [ see Object Projection Contract inventory below ]
hostPolicy: { nativeOnly: true }  // HONEST default until Differ is verified — see §0
```

---

## 5. Object Projection Contract inventory (required output #5)

| Contract | Owning service/table | Safe projection schema | Freshness | Read/write | Confidentiality | Authorization required | Mutation endpoint | Receipt behavior | Provider caching permitted |
|---|---|---|---|---|---|---|---|---|---|
| Journey stage state | `resolveJourneyState` (pure, in-memory over receipts) | `JourneyStageRuntimeState[]` minus any T0 field | Live (computed per request) | Read-only | Low (stage state is itself derived, non-secret) | Persona-scoped read | none (read-only) | N/A — read has no receipt | No (must reflect live authoritative state) |
| MoneyPenny service discovery | `serviceOrchestrationPanelState`'s `DiscoveredService[]` shape | `FinancialServiceDefinitionSummary` + `EligibilityResult` + `RuntimeReadinessProjection` (already T1-safe, already used client-side) | Live | Read-only | Low | Persona-scoped read | none | N/A | No |
| MoneyPenny Advisor output | `AdvisorDisplayOutput` | `{ kind, text }` (cited text only, no raw invariant internals) | Per-request | Read-only | Low — cited answers only | Persona-scoped, no elevated auth | none | Existing receipt path if any (unaudited — out of scope) | Not recommended pending verification |
| MoneyPenny Architect proposal (summary) | `ArchitectDisplayOutput` | `{ title, preview, truncated, artifactId }` — **explicitly excludes the full artifact body** | Per-request | Read-only | Medium — preview only, full object stays native | Persona-scoped | none (the artifact runtime owns mutation) | N/A for the summary | Not recommended |
| MoneyPenny Runtime pre-action orientation | new — not yet built | Domain + explanatory copy only, **no agreementId, no execution controls** | Per-request | Read-only | Medium | Persona-scoped | **none — execution stays native**, see residency matrix | N/A | Not recommended |
| Standing state (Journey `standing` stage) | Standing module | Already-existing read projection | Live | Read-only | Low | Persona-scoped | none | N/A | Possibly, low risk — not built in this pass |

No contract in this inventory grants a provider a mutation endpoint. This matches SPEC-AEE-001A §6's canonical rule: *"The renderer may hold a view of the object; the platform holds the object."*

---

## 6. Native vs. Differ shadow projection comparison (required output #6)

**Not performed.** Per SPEC-AEE-001A §11, a shadow projection requires "a verified Differ integration surface." §0 above establishes that none exists. Running a shadow comparison without a real second arm would not be a comparison — it would be comparing the native provider against itself, which proves nothing and risks silently normalizing a fabricated "Differ" result. This audit explicitly declines to fabricate one, per CLAUDE.md's No-Guessing rule and per the parent spec's own instruction not to invent an API.

**What this audit does instead (Phase A only, per SPEC-AEE-001 §24):** implement the provider-neutral core with `native` as the only real provider and `differ` as a truthfully disabled adapter that reports its own unavailability rather than silently no-opping. This is verified working via tests (see below) — the "shadow projection" concept is proven structurally (native provider produces a valid projection; disabled Differ adapter fails closed to native) without claiming any Differ-specific behavior.

---

## 7. Hybrid-hosting recommendation (required output #7) + Gap register (required output #8)

### Recommendation

The evidence supports building and shipping **Phase A (SPEC-AEE-001 §24) only** in this pass:

- Host-neutral `ExperienceProjection` + `AdaptiveInteractionContext` contracts.
- A real, working `native` provider (Level 0/1) that projects the Journey Spine + MoneyPenny mode-chooser surfaces identified as `EXTERNAL_RENDER_ALLOWED` above.
- A postflight validator enforcing SPEC-AEE-001 Part VIII's checks.
- A Differ provider adapter that is **structurally present but honestly reports unavailable** — proving the seam exists without claiming capability.
- The Application Projection Manifest v0.1 + Object Projection Contracts as data, consumed only by the native provider today.

**This is not yet a "hybrid-hosted slice"** in the sense SPEC-AEE-001A §13 describes ("Differ-hosted Journey Spine + MoneyPenny service chooser") — that requires a verified Differ host, which does not exist. What *is* achieved, and is the correct, evidence-supported stopping point for this pass: **the same Journey/MoneyPenny truth can now be projected through a provider-neutral seam that a verified Differ adapter could plug into later without any change to Journey Spine, Constitutional Computing, or MoneyPenny's own service pipeline.** That is Phase A's acceptance criterion (SPEC-AEE-001 §24: "No external provider dependency required"), fully met.

### Gap register (blocking Phase 2C — Differ-hosted slice)

1. **No verified Differ API/SDK access.** Blocking everything downstream of Phase A. Requires operator-provided credentials/docs before Phase B (SPEC-AEE-001 §25) can begin honestly.
2. **No Object Projection Contract yet exists for the full Architect artifact body or Runtime pre-action orientation copy** — named in §5 above as "not yet built." Required before even a read-only external render of those two surfaces.
3. **No live wiring from Journey Spine's `aigentme`/Operate stage to the MoneyPenny service chooser.** MoneyPenny's FS modes are reached via the standalone `app/(shell)/moneypenny/` shell today, not via a Journey Spine stage surface. This is a real integration gap but is explicitly out of this pass's scope per the addendum's Operate-stage boundary — named here, not fixed here.
4. **No component registry exists for Differ-safe declarative composition** (SPEC-AEE-001 Level 3). Not needed until Differ is verified and Level 3 is attempted; Level 1/2 (selection/composition among native components) does not require it.

---

## Compression

> **Confirmed: Journey Spine, Constitutional Computing, and MoneyPenny's three-mode service pipeline are all real and already separate the right things. Differ is real only as a specification — zero verified capability exists in this codebase. This pass builds the provider-neutral seam honestly, with `native` as the only working provider, so that a future verified Differ integration is a plug-in, not a redesign.**
