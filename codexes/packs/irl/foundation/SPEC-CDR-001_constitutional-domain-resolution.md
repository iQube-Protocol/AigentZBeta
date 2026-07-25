# SPEC-CDR-001 — Constitutional Domain & Context Resolution

**metaMe IRL / iQube Protocol / AgentiQ · Platform resolution-architecture specification · Status: DRAFT — DOCS-ONLY, DIRECTION RATIFIED / DECISIONS OPEN. The operator ratified the *direction* on 2026-07-25 with one required refinement (separate Domain Resolution from Context Resolution, now §12–§14). The §10 decision register remains OPEN and unratified. No code may change under this SPEC: "Do not rename `banking`, replace the hostname set, widen `FinancialDomain`, or begin agent classification until the charter has been reviewed and ratified."**
**Title:** *Constitutional Domain & Context Resolution — domain profiles, resolver precedence, context composition, and capability presentation for websites, applications, agents, tools, services and workflows*
**Companion to:** CRP-003 (Financial Services Constitutional Capability Domain) · CRP-003a (Constitutional Financial Services Programme) · PRD-MPY-001 (MoneyPenny) · PRD-MMC-001 (metaMe Companion) · PRD-IRE-001 (Invariant Resolution Engine) · CFS-051 (Experiment / Constitutional / Invariant Pipeline)
**Extension of:** the Companion Overlay's existing domain→shape mapping (`services/companion/overlayMapping.ts`) and the shipped `FinancialDomain` execution taxonomy (`services/constitutional/financialIntelligenceExecutor.ts`). This SPEC introduces a resolution *layer* between them. It does not introduce a new financial ontology.
**Owner:** AgentiQ Runtime stewards + Financial Services programme stewards (CRP-003a) + IRL research stewards. **Origin:** operator architectural direction, 2026-07-25, following live verification of the Overlay's `banking` shape and the finding (§0.2) that three of the five proposed sub-domains are already shipped canonical code.

> **Governance note (binding, this SPEC):** Docs-first, ratify-before-build — the same regime as CFS-035, PRD-IRE-001 and SPEC-MMC-003. Unlike SPEC-MMC-002, **no phase of this SPEC was implemented concurrently with its filing.** The operator considered the rename and registry replacement "technically safe in isolation" but withheld them on the grounds that they "would still encode decisions the charter is meant to settle — particularly what `financial-context` means, how profiles express authority, and whether governance domains sit beside or above executable domains." That reasoning is recorded here because it is the governing constraint on this document: **this SPEC's job is to make those decisions explicit and ratifiable, not to pre-commit them in code.** Ratification of this SPEC authorises design to proceed; it does not by itself waive D1 (CFS-016), the Identity & Access Spine rules, or the DVN-pipeline-protection paramounts, and it explicitly does not authorise any change to financial *execution* behaviour (§4.2).

---

## 0. Read this first — reconciliation against what is already built

### 0.1 The presenting problem is narrow; the architecture behind it is not

The Companion Overlay classifies a page by hostname into one of two shapes, `github-repo` or `banking`, falling through to a `generic` card otherwise (`services/companion/overlayMapping.ts::shapeForDomain`). The `banking` shape is a hardcoded set of five hostnames:

```
coinbase.com · www.coinbase.com · metame.com · www.metame.com · dev-beta.aigentz.me
```

Its own source comment describes it as an *"illustrative banking-class domain set — deliberately small."* It is a demo set, not a classifier. Three of the five entries are metaMe's own properties, which means the shape name `banking` is already doing double duty: "money-shaped external context" **and** "the platform itself." Nothing in the system performs financial-domain detection of any kind.

The operator's question — *"does banking-related mean any banking site or any financial-services site?"* — has no satisfying answer because the shape name describes the **card contents**, not the **trigger**. That mismatch is the real defect. Renaming alone would not fix it; it would only relabel it.

### 0.2 THE LOAD-BEARING FINDING: three of the five proposed sub-domains are already shipped, canonical, executable code

The operator's proposed taxonomy was:

1. Investment Operations
2. Market Operations
3. Financial Intelligence
4. Constitutional Financial Integrity
5. Constitutional Commerce

Items 1–3 **already exist** as a shipped TypeScript union with exactly those labels:

```ts
// services/constitutional/financialIntelligenceExecutor.ts:30
export type FinancialDomain = 'intelligence' | 'investment' | 'market';

// ibid:49
const DOMAIN_LABEL: Record<FinancialDomain, string> = {
  intelligence: 'Financial Intelligence',
  investment:   'Investment Operations',
  market:       'Market Operations',
};
```

This union is not decorative. It is consumed by `services/constitutional/constitutionalServicePipeline.ts` (which defaults `domain` to `'intelligence'`), it determines which domains run authoritative versus shadow under CRP-003a, and it is referenced in the DVN receipt path (`services/dvn/activityReceiptDvnPipeline.ts:151` — *"constitutional-service-pattern run on Domain 3 (Financial Intelligence)"*). **`FinancialDomain` is a money-moving execution contract.**

Therefore Phase 1 of this work is **not** "lock the initial taxonomy." It is **"derive the execution taxonomy from `FinancialDomain`, which is already the source of truth, and treat the two additions as a separate, non-executable class requiring their own ratification."** Hand-authoring a fresh five-item list would be a textbook `inv.engineering.036`/`037` parity defect — the same class that produced four separate defects in the 2026-07-25 session alone (EXPERIMENT_REGISTRY, ASSIGNABLE_EXPERIMENTS, `CAPABILITY_ROUTES`, and `BankingOverlayCard.relatedMatches`, the last caught only by a canary written minutes earlier).

### 0.3 The subtle failure this SPEC exists to prevent

Widening `FinancialDomain` from three members to five, merely so the Overlay can render two more module types, would silently admit **Constitutional Financial Integrity** and **Constitutional Commerce** into `constitutionalServicePipeline`'s executable domain set. That pipeline moves money. A presentation requirement would have altered an execution contract as a side effect, with no execution contract of its own ever having been written for those two domains.

The operator identified this independently and named it precisely: *"widening `FinancialDomain` merely to support Overlay composition could cause governance concepts to enter the money-moving execution pipeline without an explicit execution contract."* **Preventing that is this SPEC's primary structural obligation.**

### 0.4 What the Overlay must never become

The Overlay must not independently infer that a website is a bank, exchange, financial-service provider, or trading platform. It renders constitutional context; it does not classify the world. Classification is produced elsewhere, carries evidence and provenance, and reaches the Overlay only as a resolved profile. This preserves the no-fabrication rule that already governs the `generic` card (which shows "No registry or research matches for this page" rather than inventing one) and the honest empty state (which distinguishes *consent gaps* from *classification gaps*).

---

## 1. Objective

Replace hostname→shape guessing with a **constitutional domain-resolution service**: a layer that resolves a subject (website, application, agent, tool, service, workflow) to a **domain profile** carrying evidence, provenance, and verification status — and from that profile composes the appropriate constitutional presentation context.

The architectural shift:

```
BEFORE
  hostname → hardcoded lookup → github-repo | banking | generic

AFTER
  subject (page / host / agent / capability)
    → explicit mapping, when curated or first-party
    → domain profile, when discovered and verified
    → confidence-gated resolution with abstention
    → composed presentation context + capability modules
```

The separation of powers, stated once and binding throughout:

> **The discovery engine classifies the domain. The resolver composes the context. The Overlay renders it. No layer performs another's function.**

### 1.1 Scope correction (operator, 2026-07-25): this is a platform service, not an Overlay service

The Overlay is the **first consumer**, not the owner. On review the operator's assessment was explicit: *"I wouldn't think of this as an Overlay service anymore… The Overlay is simply the first consumer."* Named consumers, all reading the same resolution layer:

Companion Overlay · Founder Office · the discovery engine · AgentiQ · MoneyPenny · Research tooling · future Capability Suites

**Consequence for the build:** the resolver must not live under `services/companion/`. Placing it there would make every other consumer import from a surface-specific module — the structural precondition for the fork this SPEC exists to prevent. Proposed home: `services/resolution/` (D-16).

### 1.2 This is a general constitutional ontology, not a financial taxonomy

Also operator, same review: *"I don't think we're actually designing a Financial Services taxonomy. We're designing a general constitutional ontology."* Accepted. The stack below is domain-agnostic; Financial Services is simply its **first production domain**, chosen because its execution taxonomy is already canonical (§0.2) and therefore testable.

```
Subject                 what is being resolved (host, app, agent, tool, service, workflow)
  ↓
Domain                  the field it operates in            — Financial Services, Human Mobility, Research, …
  ↓
Execution domain        what work is performed              — canonical, executable (§3)
  ↓
Governance domain       under what constitutional principles — proposed, non-executable (§4)
  ↓
Capability              what can be done here
  ↓
Context                 what THIS citizen should experience  — §12
  ↓
Presentation            what is rendered                     — §7
```

The same stack is expected to serve Human Mobility (already a live cartridge with PSC-001/MAF governance), Research, Identity, Creative, and further domains. **Nothing in §§2–7 may be written so as to work only for Financial Services** — a constraint on the implementation, not merely an aspiration.

### 1.3 Named future direction — NOT adopted here

The operator observed that a Domain Profile, carrying evidence, provenance, verification, applicable domains, capability modules and invariant references, *"feels like exactly the kind of object that belongs in the iQube ecosystem… I'd actually start thinking of it as another iQube type. Perhaps eventually `DomainQube`. Not now — but architecturally that's where this seems to be heading."*

Recorded as a **direction, not a decision**. This SPEC does not define a DomainQube, does not assume one, and does not design the profile schema (§5.3) around becoming one. Doing so would be speculative architecture against an unratified concept. It is noted so a future ratification has a starting point (D-17).

---

## 2. The four distinct concepts (§3 of the operator's directive)

These are routinely conflated. This SPEC keeps them separate, and every later section depends on the distinction.

| Concept | What it is | Executable? | Source of truth | Status |
|---|---|---|---|---|
| **Execution domain** | A domain the constitutional service pipeline can actually *run against*. Carries an execution contract, a shadow/authoritative posture, and receipt semantics. | **Yes** | `FinancialDomain` (`financialIntelligenceExecutor.ts:30`) | **Canonical — shipped** |
| **Governance domain** | A domain that *governs* how execution is conducted and evidenced. Not something the pipeline executes. | **No, by default** | This SPEC (proposed) | **Proposed — requires ratification** |
| **Overlay context** | A *presentation* context: which constitutional card is rendered. Names what is being shown, never what the host institutionally is. | N/A | This SPEC (proposed) | **Proposed — requires ratification** |
| **Capability module** | A composable unit of card content (Passport, Standing, Delegations, Wallet, and domain-specific modules). | N/A | Composition model, §7 | **Proposed** |

**The distinction that matters most:** an execution domain answers *"what can the pipeline do?"*; a governance domain answers *"under what constraints must it be done?"*; an overlay context answers *"what should this citizen see here?"* Collapsing any two of these is the failure mode §0.3 describes.

---

## 3. Canonical execution taxonomy — DERIVED, not authored (§1 of the directive)

The execution taxonomy is **exactly** the shipped `FinancialDomain` union. This SPEC asserts no authority to add to it.

| Canonical id | Label (shipped) | Posture under CRP-003a |
|---|---|---|
| `intelligence` | Financial Intelligence | Authoritative (Domain 3) |
| `investment` | Investment Operations | Shadow-only — money-moving pause point |
| `market` | Market Operations | Shadow-only — money-moving pause point |

**Binding derivation rule (proposed, D-1):** any registry, profile schema, or presentation surface that enumerates execution domains MUST derive them from `FinancialDomain` in code, not restate them. Where derivation is impossible (a docs mirror such as this table), a parity canary MUST fail the build on drift, registered in `tests/source-of-truth-parity.test.ts`'s canary index per CLAUDE.md.

**The shadow-only posture of `investment` and `market` is untouched by this SPEC.** Nothing here authorises a flip. Presentation of a Market Operations module must not imply executability.

---

## 4. Proposed governance domains — NOT executable (§2 of the directive)

### 4.1 The two proposed domains

| Proposed id | Label | What it governs | Ratification status |
|---|---|---|---|
| `constitutional-financial-integrity` | Constitutional Financial Integrity | Attribution, reconstitutability, and independent verifiability of financial action | **PROPOSED — D-2** |
| `constitutional-commerce` | Constitutional Commerce | Agreement-before-execution, settlement attribution, provider replaceability | **PROPOSED — D-3** |

Both are real concepts in the codebase's vocabulary — `services/artifact/constitutionalPublishingSystem.ts:168` already registers `CCS: 'Constitutional Commerce Specifications'` — but **neither is a `FinancialDomain` today, and this SPEC does not make either one.**

### 4.2 The non-executability rule (proposed, binding if ratified)

> **A governance domain MUST NOT be added to `FinancialDomain`, and MUST NOT be accepted by `constitutionalServicePipeline` as an executable domain, unless and until it has its own ratified execution contract specifying: what executing in that domain means, its shadow/authoritative posture, its authority boundary, its receipt class, and its DVN action type.**

Ratifying this SPEC does **not** constitute that execution contract. If a governance domain is ever to become executable, that is a separate ceremony with its own charter — the same discipline CRP-003a applied to the Domain 1/2 money-moving pause point.

### 4.3 Where governance domains sit — beside, not above

The operator asked whether governance domains "sit beside or above executable domains." **Proposed answer (D-4): beside, in a separate class — with a declared relation to execution domains, not a hierarchy over them.**

Rationale: modelling governance domains *above* execution domains would imply they subsume or gate execution, which would (a) make them load-bearing on the money path by construction, reintroducing §0.3's hazard through the back door, and (b) misdescribe the actual relationship — Constitutional Commerce does not contain Market Operations; it constrains how commerce is conducted, some of which is market activity and some of which is not. A `governs: FinancialDomain[]` relation expresses the real dependency without creating an ontological parent.

```
Financial Services
├── Execution domains — canonical, executable, derived from FinancialDomain
│   ├── intelligence   (Financial Intelligence)      — authoritative
│   ├── investment     (Investment Operations)       — shadow-only
│   └── market         (Market Operations)           — shadow-only
│
├── Governance domains — PROPOSED, non-executable by default
│   ├── constitutional-financial-integrity   governs: [intelligence, investment, market]
│   └── constitutional-commerce              governs: [investment, market]
│
└── Presentation context
    └── financial-context — composed from capability modules; NOT a domain
```

**`financial-context` is a rendering context informed by domain profiles. It is not a financial domain, and must never become a fourth ontology competing with the runtime taxonomy.**

---

## 5. Classification model — provenance and verification as separate axes (§4, §5)

### 5.1 The correction this SPEC makes to the initial proposal

The initial sketch used a single `classificationSource: "curated" | "first-party" | "discovered" | "provisional"` field. That conflates two orthogonal axes: **who asserted the classification** and **how much it has been checked**. A discovered profile can be human-verified; a first-party one could in principle be unverified. The resolver's precedence (§6) depends on both independently, so a single field makes precedence ambiguous.

**Proposed model (D-5): two independent fields.**

| Field | Values | Meaning |
|---|---|---|
| `assertionProvenance` | `first-party` · `curated` · `discovered` | WHO asserted this classification |
| `verificationStatus` | `verified` · `provisional` | WHETHER a human or trusted process has checked it |

### 5.2 Confidence is reserved for inference (§5 of the directive)

**Proposed rule (D-6): `confidence` is present ONLY when `assertionProvenance === 'discovered'`. It is absent — not `1`, not `null` — on curated and first-party assertions.**

Rationale, and this is the same epistemic discipline CLAUDE.md's hypothesis-vs-canon section enforces: `confidence: 1` on a curated entry means *"a human asserted this"*, while `confidence: 0.91` on a discovered entry means *"a model's calibrated estimate"*. These are incommensurable quantities. Putting them in one numeric field invites averaging, thresholding, or ranking across kinds — a category error that would silently corrupt any downstream calibration metric. A curated assertion's authority comes from its provenance and verification status, not from a number.

### 5.3 Proposed profile schema (D-7)

```jsonc
{
  "schemaVersion": "cdr-domain-profile/v1",

  // WHAT is being classified. The same schema serves every subject kind —
  // this is what lets one service resolve websites, agents and capabilities.
  "subjectType": "hostname | application-route | agent | capability | tool | service | workflow",
  "subject": "coinbase.com",

  // DOMAIN ASSIGNMENT
  "domain": "financial-services",
  "executionDomains": ["market"],              // MUST derive from FinancialDomain (D-1)
  "governanceDomains": ["constitutional-commerce"],  // only if D-2/D-3 ratified

  // CLASSIFICATION AUTHORITY — two independent axes (D-5)
  "assertionProvenance": "curated",
  "verificationStatus": "verified",
  "verifiedBy": "polity-public-ref:<T2 commitment>",   // T2 only — never a personaId
  "verifiedAt": "2026-07-25T00:00:00Z",

  // Present ONLY when assertionProvenance === 'discovered' (D-6)
  // "confidence": 0.91,

  // EVIDENCE — a claim with evidence, never an invisible classifier assertion
  "evidence": [
    { "type": "page-content | service-description | capability-manifest | operator-attestation",
      "ref": "…" }
  ],

  // PRESENTATION + GOVERNANCE LINKAGE
  "overlayContext": "financial-context",
  "capabilityModules": ["market-operations", "constitutional-commerce"],
  "invariantFieldRef": "ire://financial-services/market-operations/v0.1"
}
```

**Tier discipline (binding, not optional):** `verifiedBy` carries a T2 Polity Public Reference (`personaPublicRef`, `services/identity/personaReferences.ts`) — never a `personaId`, `authProfileId`, or `rootDid`. Domain profiles are network-bound and potentially chain-bound artifacts; the Identity & Access Spine's T0/T1/T2 rules apply to them in full.

**Unresolved (D-8):** whether `invariantFieldRef`'s `ire://` scheme is a real resolvable reference into the Invariant Resolution Engine or a documentation convention. PRD-IRE-001 must be consulted before this is treated as resolvable; this SPEC does not assume it.

---

## 6. Resolver precedence and abstention (§6 of the directive)

### 6.1 The four levels (proposed, D-9)

| Level | Condition | Overlay behaviour |
|---|---|---|
| **L1 — First-party / curated** | Exact hostname or application-route match; `assertionProvenance ∈ {first-party, curated}`, `verificationStatus = verified` | Resolve immediately. Render full context. |
| **L2 — Verified profile** | A discovered profile that a human or trusted process has verified (`verificationStatus = verified`) | Resolve automatically. Render full context. |
| **L3 — Provisional profile** | High-confidence discovered profile, `verificationStatus = provisional` | **MUST NOT assert.** May offer, hedged (§6.2). |
| **L4 — Unknown** | No profile, or below threshold | `generic`. No guessing. |

Precedence is strict and ordered: a lower level never overrides a higher one. Note that L1 and L2 differ by *provenance*, not by verification — both are verified; this is exactly why §5.1 splits the axes.

### 6.2 Abstention behaviour at L3 (proposed, D-10)

At L3 the Overlay **MUST NOT** render "This is a financial services site." Permitted forms:

- A hedged offer: *"Financial context may be relevant here"* — with an explicit affordance to view or dismiss.
- A neutral context selector letting the citizen choose.
- Nothing at all (falling back to L4 presentation) — always a permitted implementation of L3.

> **Constitutional rule (proposed, binding): abstention is preferable to fabricated context.**

This is the same rule the Overlay already honours in shipped code — the `generic` card's "No registry or research matches for this page" is an honest negative, not an omission — and the same discipline as the four-way empty-state reason split that distinguishes consent gaps from classification gaps.

### 6.3 What abstention costs, stated honestly

L3 abstention means the system will *under-serve* pages it could plausibly classify. That is the intended trade. The alternative — asserting a financial classification the citizen did not ask for and cannot audit — is the failure this whole architecture exists to prevent. **The abstention rate is a metric to publish, not a defect to minimise** (§9).

---

## 7. Composition model — base shape plus capability modules (§7 of the directive)

### 7.1 Why not more card shapes

Adding a shape per sub-domain would multiply monolithic cards and re-create the exact rigidity `banking` demonstrates. Instead:

```
Rendered card = base constitutional shape
              + overlay context
              + capability modules (selected by the resolved profile)
```

**Base constitutional shape** — persona-level, true on every page, already shipped as of 2026-07-25 across all three current shapes:
Passport (identifiability) · Standing · Delegations · Wallet · Related in the registry

**Financial context modules** — rendered only when the resolved profile names them:

| Module id | Derived from | Executable? |
|---|---|---|
| `financial-intelligence` | execution domain `intelligence` | Yes — authoritative |
| `investment-operations` | execution domain `investment` | Shadow-only |
| `market-operations` | execution domain `market` | Shadow-only |
| `constitutional-financial-integrity` | governance domain (proposed) | **No** |
| `constitutional-commerce` | governance domain (proposed) | **No** |

### 7.2 The presentation/execution firewall (proposed, D-11)

> **A capability module MUST visually and behaviourally distinguish executable from non-executable context. Rendering a module MUST NOT imply that its domain is executable, and MUST NOT enable any action the domain's posture does not already permit.**

Concretely: a `market-operations` module renders on a shadow-only domain and must not present an execute affordance. A `constitutional-commerce` module renders governance context and has no execution surface at all. This is the presentation-layer counterpart to §4.2 — together they close both directions of the §0.3 hazard.

---

## 8. Implications per surface (§8 of the directive)

### 8.1 The Overlay
Stops classifying; starts consuming. `shapeForDomain` becomes a **profile lookup**, not a hostname→shape switch. Renames `banking` → `financial-context` **only as part of the profile-registry change** — the operator's judgement that the rename alone "would still encode decisions the charter is meant to settle" is accepted and recorded. The `github-repo` shape is untouched by this SPEC and remains a separate, non-financial context.

### 8.2 The discovery engine (IDE)
Gains a new output artifact: the domain profile. It already reasons in domain / sub-domain / evidence / candidate-invariant / confidence terms, so this is a new *projection* of existing machinery, not a new engine. **Open (D-12):** the operator's directive uses "IDE"; the codebase has IRE (Resolution), IPE (Projection), KRE (Knowledge), CFO (Observatory). Which existing engine owns profile generation — or whether "Invariant Discovery Engine" is a distinct component — must be settled before any build. This SPEC does not guess.

### 8.3 The Financial Services programme (CRP-003a)
Gains an explicit statement that its three execution domains are the canonical taxonomy, and a proposed governance-domain class that does **not** alter its execution surface. No change to shadow/authoritative posture. No change to the Domain 1/2 pause point.

### 8.4 The Horizen agent-classification pilot
The same profile schema classifies agents, not just hostnames (`subjectType: "agent"`). The proposed flow — agent discovered → capability evidence ingested → domain classification → execution/governance domains assigned → candidate invariant profile attached → Passport relationship established → bounded-delegation eligibility assessed → discoverable in Founder Office — is recorded here as the pilot's target sequence. **It is not authorised by this SPEC** (D-13); it depends on D-2/D-3 and on §8.2's resolution.

### 8.5 Invariant-field references
A profile may carry `invariantFieldRef`, letting a context know not merely *"this is financial"* but *"this context is governed by these candidate invariants."* The Overlay need not display them; it may use them to choose available actions, explain why an action is restricted, request additional verification, or surface qualified services. Subject to D-8.

---

## 12. Context Resolution — the second layer (operator refinement, 2026-07-25)

### 12.1 Why two layers and not one

The operator's required refinement: *"context isn't determined solely by domain."* Correct, and the distinction is crisp:

| Layer | Question it answers | Input | Output |
|---|---|---|---|
| **Domain Resolution** (§§2–6) | *What kind of thing is this?* | subject only | Domain Profile |
| **Context Resolution** (§12–14) | *Given this thing and this citizen, what constitutional experience should be composed?* | Domain Profile **×** citizen state | Resolved Context |

```
Subject → Domain Resolution → Domain Profile → Context Resolution → Capability Composition → Presentation
```

### 12.2 THE STRUCTURAL REASON THIS SEPARATION IS MANDATORY, NOT STYLISTIC

The operator's stated motivation was to avoid *"overloading the Domain Profile itself."* There is a sharper reason, and it is a tier-discipline hazard:

> **A Domain Profile is a property of the SUBJECT and is identical for every citizen. A Resolved Context is a property of the (subject × citizen) pair. Merging them would put persona-derived state — Standing, plan tier, active delegations, Passport status — inside an artifact that §5.3 already designates as network-bound and potentially chain-bound.**

That is a direct Identity & Access Spine violation waiting to happen: profiles are shareable, cacheable, and publishable precisely *because* they carry nothing persona-specific. The moment a profile carries "this citizen's tier," it can no longer be shared, cached across citizens, or safely anchored — and the leak would be silent, because the object would still look like a profile.

**Binding consequences (proposed, D-18):**

1. A Domain Profile MUST NOT contain any persona-derived field. The `verifiedBy` T2 commitment (§5.3) is the sole identity-adjacent value permitted, and it identifies the *verifier of the classification*, never a consumer.
2. Domain Profiles MAY be cached and shared across citizens. **Resolved Contexts MUST NOT be** — cache keys must include the citizen, or caching must be omitted.
3. Context Resolution output is **ephemeral and per-request**. It is never persisted back into the profile registry.

### 12.3 Context inputs

Beyond the Domain Profile, Context Resolution reads (all verified present in the codebase — none assumed):

| Input | Source | Verified |
|---|---|---|
| Passport status / identifiability | Identity & Access Spine (`getActivePersona`) | Shipped |
| Standing | `readStandingForVenture` | Shipped |
| Plan tier | `AgencyPlanTier` — `citizen` · `citizen_plus` · `sovereign_citizen` · `steward` · `first_citizen` (`services/billing/personaPlan.ts:35`) | Shipped |
| Active delegations | Constitutional Agreement layer (`requireAuthorizedAgreement`) | Shipped |
| Cartridge flags | spine-resolved `cartridgeFlags` | Shipped |
| Current task / intent | intent + NBE layer | Shipped |
| Temporal state | — | **NOT SPECIFIED.** The operator raised this hedged ("perhaps even temporal state"). No temporal-state primitive was located; specifying one would be guessing. Open as D-19. |

**Plan tier must be read through the existing billing helpers, never re-derived.** `SOVEREIGN_TIERS` (`personaPlan.ts:216`) already encodes which tiers count as sovereign; restating that set anywhere in the resolver would be an `inv.engineering.036/037` parity defect of exactly the kind §0.2 catalogues.

### 12.4 Context Resolution must not become a second access gate

**Proposed, binding (D-20):** Context Resolution decides what is *composed and shown*. It is **not** an authorisation boundary. Every gated action remains gated by its existing enforcement — `evaluateAccess`, `requireAuthorizedAgreement`, the spine's own checks — regardless of what context was composed.

Rationale: a resolver that both selects the experience *and* is trusted to permit action becomes a parallel access-control path, which CLAUDE.md's Identity & Access Spine section forbids outright ("Do not build parallel resolvers, parallel gates, or parallel decision logic"). Composition may *hide* an affordance; only the spine may *permit* one. Hiding is a UX decision; permitting is a constitutional one.

### 12.5 Abstention composes

If Domain Resolution abstained (§6, L3/L4), Context Resolution composes the **base constitutional shape only** (§7.1). It must not compensate for an absent or unverified profile by inferring domain context from citizen state. A citizen holding financial delegations does not make an unclassified page financial.

---

## 13. The discovery engine as a generator of constitutional structure

The operator's fourth observation: the discovery engine *"shouldn't just discover invariants. It should discover constitutional structure"* — becoming a generator of Domain Profiles, not merely invariant sets.

```
Domain → Execution domains → Capabilities → Invariants → Governance constraints → Domain Profile
```

Applied to the two live domains:

| Financial Services | Human Mobility |
|---|---|
| Execution domains: intelligence · investment · market | Sub-domains: emergency mobility · business mobility |
| ↓ capabilities → invariants → governance constraints → Domain Profile | ↓ capabilities → invariants → governance constraints → Domain Profile |

This makes profile generation a **projection of existing machinery** rather than a new engine — consistent with §8.2. It also sharpens D-12: whichever engine owns this is producing constitutional structure, not just invariant sets, which is a materially larger remit than "discovery" implies and should be named accordingly.

**Human Mobility caution:** HMS carries its own paramount rules (PSC-001; the T0 identifier-isolation regime in CLAUDE.md, where `caseId` and `personaId` must never reach a network- or chain-bound structure). A Human Mobility Domain Profile is network-bound by construction. **Any extension of this architecture to HMS must satisfy the HMS identifier-isolation rules before a single profile is generated** — flagged now, not deferred, because §12.2's caching rules make it consequential (D-21).

---

## 13a. Authorization — the third stage (operator, 2026-07-25)

### 13a.1 Elevating D-20 from a constraint to a stage

D-20 forbade the resolver from authorising. The operator's response identifies why that constraint kept feeling load-bearing: **authorization is not a rule about Context Resolution, it is a stage of its own.** It belongs to neither Context Resolution nor the Overlay.

Three independent questions, three stages:

| Stage | Question | Owner |
|---|---|---|
| **Domain Resolution** | *What is this?* | This SPEC (§§2–6) |
| **Context Resolution** | *Given this subject and this citizen, what experience should be composed?* | This SPEC (§12) |
| **Authorization** | *What actions may constitutionally occur?* | **The Identity & Access Spine — NOT this SPEC** |

### 13a.2 This SPEC does not own Authorization, and must not

Authorization already exists, is already canonical, and is explicitly protected: `evaluateAccess` (`services/access/evaluateAccess.ts`), `requireAuthorizedAgreement` (`services/constitutional/constitutionalAgreement.ts`), and the spine's own resolution path. CLAUDE.md lists several of these among the files that **must not be modified without operator approval**, and states the rule this stage exists to honour: *"Do not build parallel resolvers, parallel gates, or parallel decision logic."*

**This SPEC's entire contribution to the Authorization stage is to name it and stay out of it.** Naming it matters because an unnamed stage is one that gets absorbed by a neighbour — which is precisely how a composition layer quietly becomes an access-control layer.

### 13a.3 Composition never grants authority (proposed, binding — supersedes and subsumes D-20)

> **Composition never grants authority. Presentation never grants authority. Only the Identity & Access Spine grants authority, evaluated at the point of action.**

Corollaries:

1. A capability module appearing in a composed context is **not** a statement that its actions are permitted.
2. A module absent from a composed context is **not** an authorisation denial — it is a presentation decision, and the spine must still deny independently if the action is attempted by another route.
3. Hiding is a UX decision; permitting is a constitutional one. They may disagree without either being wrong.

### 13a.4 Authorization is evaluated at the point of action, never cached from composition (proposed, D-22)

A subtle hazard the three-stage split exposes: if authorization were evaluated *during* Context Resolution and carried forward in the Resolved Context, the result would be a time-of-check/time-of-use gap. A delegation can be revoked, a plan tier can lapse, an agreement can expire, and Standing can change between the moment a context is composed and the moment the citizen clicks. A context that carried "permitted: true" would be asserting a fact that had since become false.

**Therefore: a Resolved Context MUST NOT carry authorization verdicts.** It may carry what to *show*; the spine decides what may *happen*, at the moment it is asked. This also composes correctly with §12.2's rule that Resolved Contexts are ephemeral and never cached across citizens — a cached authorization verdict would be strictly worse than a cached context.

---

## 13b. Two constitutional invariants this architecture exposes (operator, 2026-07-25)

The operator observed that the Domain/Context split "accidentally exposes two very clean invariants." Both are proposed here as **candidate structural invariants**, and — per CFS-051 — the correct home for them is the `research_candidate_invariants` register at status `candidate`, not inline canonization in this document. This SPEC proposes; it does not canonize.

### CDR-INV-1 — Domain Profile universality

> **Every citizen observing the same subject receives the same Domain Profile.**

If that does not hold, the object is not a Domain Profile. This is **definitional, not empirical** — it is a structural rule about what the artifact *is*, in the same class as CLAUDE.md's engineering invariants, not a hypothesis about the world requiring experimental support. Ratifying it would place it in the canonical class directly.

**It is directly canary-able**, which is what makes it valuable rather than merely elegant: resolve the same subject for N distinct citizens, assert byte-identical profiles. Any persona-derived field introduced by a future change (§12.2's hazard) fails that test immediately and loudly.

### CDR-INV-2 — Context divergence legitimacy

> **Two citizens observing the same subject may legitimately receive different Resolved Contexts.**

Because Context depends on Passport, Standing, delegation, plan tier, permissions and active work — all of which are constitutional state.

**Note the asymmetry, which matters for implementation:** CDR-INV-1 is a *constraint* (must hold; testable by canary). CDR-INV-2 is a *permission* (may hold; not testable the same way). Its function is protective — it prevents a future reviewer from treating context divergence as a bug and "fixing" it by enforcing uniformity, which would collapse Context Resolution back into Domain Resolution and undo the separation §12.2 exists to enforce. An invariant that licenses variation is unusual, and worth stating precisely for that reason.

---

## 13c. Named future direction — Activity Context (NOT adopted)

The operator: *"What sits between Context and execution? … Activity Context."* The observation is that these four facts together produce a materially different experience than the subject alone:

> I'm in Founder Office · I'm looking at Coinbase · I'm researching Treasury · I'm acting through MoneyPenny

Which suggests Context Resolution will eventually compose:

```
Domain Context  +  Citizen Context  +  Activity Context  =  Resolved Context
```

explaining why the *same* citizen may legitimately see different constitutional experiences on the *same* subject depending on what they are trying to accomplish — a case CDR-INV-2 permits but does not currently model.

**Recorded as a direction, explicitly NOT adopted (D-23), on the operator's own instruction ("I'd leave this as a future direction rather than adding it now").** §12.3 already lists "current task / intent" as a context input, which is the seed of Activity Context; this SPEC does not elevate it into a named third composition term. Doing so would design against an unratified concept.

---

## 14. Revised layer summary

```
                    ┌─────────────────────────────────────────┐
   SUBJECT ───────► │  DOMAIN RESOLUTION            §§2–6     │
                    │  identical for every citizen            │
                    │  shareable · cacheable · publishable    │
                    └──────────────────┬──────────────────────┘
                                       │  Domain Profile
                                       ▼
   CITIZEN STATE ─► ┌─────────────────────────────────────────┐
   (passport,       │  CONTEXT RESOLUTION           §12       │
    standing,       │  per (subject × citizen)                │
    tier,           │  ephemeral · never cached across        │
    delegations,    │  citizens · never persisted to profile  │
    task)           │  NOT an access gate (§12.4)             │
                    └──────────────────┬──────────────────────┘
                                       │  Resolved Context
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  CAPABILITY COMPOSITION       §7        │
                    │  base shape + modules                   │
                    │  presentation/execution firewall        │
                    └──────────────────┬──────────────────────┘
                                       ▼
                              PRESENTATION (Overlay, and every other consumer)
```

---

## 9. Research apparatus

If ratified, this becomes measurable rather than merely asserted. Candidate measures: classification precision on a held-out set; **abstention rate** (§6.3 — published, not minimised); agent-domain fit in the Horizen cohort; effect on discovery and Time-to-Value; and whether invariant-informed classification measurably improves orchestration.

**Epistemic status (binding, per CLAUDE.md):** the claim *"invariant-informed domain classification improves orchestration"* is an **empirical hypothesis**. If registered, it enters the CFS-051 register as `proposed`, never `canonical`, until experiments produce supporting evidence. Nothing in this SPEC may be written or cited as though that claim were established.

---

## 10. Ratification decision register (§9 of the directive)

Every decision below must be resolved before implementation. **No code changes under this SPEC until then.**

| # | Decision | Recommendation | Status |
|---|---|---|---|
| **D-1** | Execution taxonomy derived from `FinancialDomain` in code, with a parity canary where derivation is impossible | Adopt | **Open** |
| **D-2** | Accept `constitutional-financial-integrity` as a **governance** domain (non-executable) | Adopt as proposed, non-executable | **Open** |
| **D-3** | Accept `constitutional-commerce` as a **governance** domain (non-executable) | Adopt as proposed, non-executable | **Open** |
| **D-4** | Governance domains sit **beside** execution domains, related by `governs`, not above them | Adopt (§4.3 rationale) | **Open** |
| **D-5** | Split `assertionProvenance` and `verificationStatus` into two independent fields | Adopt | **Open** |
| **D-6** | `confidence` present only for `discovered`; absent for curated/first-party | Adopt | **Open** |
| **D-7** | Profile schema `cdr-domain-profile/v1` as specified in §5.3, incl. T2-only `verifiedBy` | Adopt | **Open** |
| **D-8** | Whether `invariantFieldRef` (`ire://…`) is resolvable or documentary | **Unresolved — consult PRD-IRE-001** | **Open** |
| **D-9** | Four-level resolver precedence, strictly ordered | Adopt | **Open** |
| **D-10** | L3 abstention forms; "abstention preferable to fabricated context" as binding | Adopt | **Open** |
| **D-11** | Presentation/execution firewall — modules must not imply executability | Adopt | **Open** |
| **D-12** | Which engine owns profile generation (IRE / IPE / KRE / CFO / a distinct Discovery Engine) | **Unresolved — do not guess** | **Open** |
| **D-13** | Whether the Horizen agent-classification pilot (§8.4) is authorised | Defer until D-2/D-3/D-12 resolved | **Open** |
| **D-14** | Whether `financial-context` is the ratified overlay-context name | Adopt (§4.3: a rendering context, not a domain) | **Open** |
| **D-15** | Seed registry membership — which hostnames, at which provenance/verification | **Requires an explicit operator list.** Do not carry the five demo hosts forward by default | **Open** |
| **D-16** | Resolver lives at `services/resolution/`, NOT under `services/companion/` — it is a platform service with many consumers (§1.1) | Adopt | **Open** |
| **D-17** | Whether a Domain Profile eventually becomes an iQube type (`DomainQube`) | **Direction noted, explicitly NOT adopted here** (§1.3). Requires its own charter | **Deferred** |
| **D-18** | Domain Profile carries no persona-derived field; profiles cacheable/shareable, Resolved Contexts never cached across citizens and never persisted back (§12.2) | Adopt — tier-discipline hazard, not a style choice | **Open** |
| **D-19** | Whether "temporal state" is a Context Resolution input | **Unresolved — no temporal-state primitive located. Do not guess** (§12.3) | **Open** |
| **D-20** | Context Resolution is composition only, never an authorisation boundary (§12.4) | Adopt — a resolver that also permits would be a parallel access gate | **Open** |
| **D-21** | Human Mobility extension must satisfy HMS T0 identifier-isolation (PSC-001) BEFORE any profile is generated (§13) | Adopt as a precondition, not a follow-on | **Open** |
| **D-22** | Authorization is a distinct STAGE (§13a), owned by the Identity & Access Spine, never by this SPEC; verdicts evaluated at point of action and never carried in a Resolved Context | Adopt — supersedes and subsumes D-20 | **Open** |
| **D-23** | Activity Context as a third composition term | **Direction noted, explicitly NOT adopted** (§13c), per operator instruction | **Deferred** |
| **D-24** | Register CDR-INV-1 (Domain Profile universality) and CDR-INV-2 (Context divergence legitimacy) as candidate structural invariants in CFS-051's register at status `candidate` | Adopt — definitional, so canonical-class if ratified, not hypothesis-class | **Open** |
| **D-25** | Resolution service framed as constitutional middleware consumed by every Capability Suite (§1.1), with Financial Services as first implementation and Human Mobility as second | Adopt | **Open** |

### 10.1 Explicitly NOT authorised by ratifying this SPEC

- Widening `FinancialDomain` (§4.2)
- Any change to execution behaviour, shadow/authoritative posture, or the Domain 1/2 pause point
- Any inferred classification reaching the Overlay without verification (§6)
- Agent classification (§8.4, D-13)
- Waiving D1 (CFS-016), the Identity & Access Spine rules, or the DVN-pipeline-protection paramounts
- Defining, implying, or designing toward a `DomainQube` iQube type (D-17)
- Extending the architecture to Human Mobility ahead of the HMS identifier-isolation precondition (D-21)
- Treating Context Resolution as an access gate (D-20, D-22)
- Any modification to `evaluateAccess`, `requireAuthorizedAgreement`, or any spine file (§13a.2)
- Canonizing CDR-INV-1 / CDR-INV-2 inline — they enter CFS-051's register as candidates (D-24)
- Adopting Activity Context as a composition term (D-23)

---

## 11. Post-ratification sequencing (indicative only)

Recorded so the first build slice is deliberately narrow. Not authorised until §10 is resolved.

| Phase | Scope | Gated on |
|---|---|---|
| **P1** | Derive execution taxonomy in code + parity canary | D-1 |
| **P2** | Profile registry replacing the hostname `Set`; curated/first-party seed only; rename `banking` → `financial-context` | D-1, D-5, D-6, D-7, D-14, D-15 |
| **P3** | Resolver with L1/L2/L4 only — no provisional path | D-9, D-11 |
| **P4** | Capability-module composition | D-2, D-3, D-4, D-11 |
| **P5** | L3 provisional discovery + abstention UI | D-10, D-12 |
| **P6** | Agent classification (Horizen) | D-13 |
| **P7** | Context Resolution layer (§12) — after Domain Resolution is stable, never before | D-16, D-18, D-20 |
| **P8** | Second production domain (Human Mobility) to prove generality (§1.2) | D-21 + HMS steward sign-off |

The first code change, when it comes, is exactly this and nothing more:

```
hardcoded hostname → card-shape mapping
    becomes
explicit hostname → verified domain profile → overlay context
```

with no inferred classification, no runtime union widening, and no change to financial execution behaviour.
