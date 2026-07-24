# SPEC-VLM-001 — Venture Lab & MoneyPenny Platform Reorganisation Specification

**metaMe IRL / iQube Protocol / AgentiQ · Implementation/UI-architecture specification · Status: DESIGN — docs-only, awaiting explicit operator ratification**
**Title:** *Venture Lab & MoneyPenny — Platform Reorganisation Specification (Pilot Preparation Release, vNext)*
**Companion to:** the Standard Cartridge Navigation Framework (`types/codex.ts`'s `TabGroup`/`CodexTab.group` mechanism, `CodexPanelDynamic.tsx`'s renderer — the same shared two-level pill+subtab system IRL OS, Polity Core, and Marketa already use), the metaMe Companion / Wallet-Over-Cartridge Overlay pattern (CLAUDE.md), the Financial Services Capability Suite CCB and the MoneyPenny Constitutional Runtime CCB (both 2026-07-24).
**Owner:** operator (intent, structure, naming) + Aigent Z workstream (reconciliation against the shipped platform).
**Origin:** operator design pass, 2026-07-24, reconciled by Claude Code against the live `data/codex-configs.ts` / `VENTURE_LAB_CODEX` / MoneyPenny cartridge the same day.

> **Governance note (binding, this SPEC):** This is a **docs-only** deliverable — no code changes ship with this filing. Per this repo's ratify-before-build discipline (CLAUDE.md "Security — Access Gates", "Hypothesis vs Canon — Epistemic Honesty Discipline"), the operator's design conviction over this conversation is real and valuable but is not itself a dated, line-item ratification of *this specific document's* content. This filing's status is honestly **DESIGN**. Ratification happens explicitly before Phase 1 implementation begins (§13).

> **Deliberately not a PRD.** This specification reorganises existing, already-shipped capabilities into a coherent operating architecture — it does not introduce new product capabilities, new constitutional mechanisms, or new business logic. Framing it as a PRD would invite exactly the kind of functional reinvention this document explicitly rules out (§14, Out of Scope).

---

## 1. Purpose

This specification reorganises the Venture Lab and MoneyPenny surfaces into a coherent operating architecture in preparation for the upcoming pilot programmes (Horizen and the broader Founder Office pilot cohort).

**This is not a functional redesign.** The objective is to:

- simplify navigation
- reduce cognitive load
- group related capabilities
- expose MoneyPenny as the ubiquitous financial edge
- prepare the platform for Horizen and Founder Office pilots
- preserve all existing functionality while improving discoverability

No constitutional changes are introduced in this document.

## 2. Objectives

**Primary objectives**

- Reduce top-level Venture Lab navigation from eleven unrelated tabs to five logical, intent-driven domains.
- Make Founder Office the obvious operational home (and its default landing page).
- Position Founders Club as the human/relationship domain.
- Position Financial Services as the first of a growing capability-suite domain.
- Make MoneyPenny the portable financial interface across every deployment, not just her own cartridge.
- Preserve existing routes wherever practical.
- Minimise implementation risk by reorganising rather than rebuilding.

## 3. Design Principles

The navigation should reflect how founders think, not how the software evolved. Operators think in terms of *operating ventures, building relationships, accessing services, growing organisations, and administering infrastructure* — not in terms of individual feature modules.

### 3.1 Navigation Architecture — conform to the Standard Cartridge Navigation Framework

This implementation must **not** invent a Venture-Lab-specific navigation paradigm. Venture Lab is refactored to conform to the existing metaMe cartridge navigation architecture wherever practical — that architecture is the canonical UI framework, not a pattern Venture Lab happens to also use.

**Standard hierarchy:**

```
Primary Navigation      (cartridge selection)
        ↓
Secondary Navigation    (major capability areas — this spec's 5 domains)
        ↓
Tertiary Navigation     (context-specific views within a domain)
```

For example:

```
Founder Office
    ↓
Workspace · Discover · Validate · Architect
    ↓
current-page controls
```

or

```
Financial Services
    ↓
Request · Agreements · Activity · Advanced
    ↓
request type / filters / results
```

Rather than introducing additional horizontal tab bars or bespoke navigation layers, every new surface must first ask whether the existing three-tier `TabGroup`/sub-tab framework (`types/codex.ts`, `CodexPanelDynamic.tsx`) can express the workflow. Only where it genuinely cannot should additional in-page navigation be introduced.

**Guiding principle:** every cartridge should feel like the same operating system. A user who understands one cartridge should immediately understand every other cartridge. Consistency is preferred over local optimisation. Venture Lab is a *consumer* of the platform navigation system, not an exception to it.

### 3.2 Action-Oriented Navigation Philosophy

Venture Lab adopts the same intent-driven navigation philosophy already established across the Human Agency System — onboarding journeys are verbs ("Create", "Build", "Research"), SmartTriad is intent-driven, Founder Office is about operating. Carrying that through Venture Lab makes the whole platform feel like an operating system rather than a collection of modules.

Top-level navigation represents **operator intent**, not internal product organisation. Each item answers the question *"What am I here to do?"* rather than *"Which module contains this feature?"* — and is phrased, wherever possible, as an active verb.

The five domains (§4) are therefore:

- **Operate** — run your business. Ventures and execution.
- **Connect** — interact with people. Relationships, collaboration, opportunity discovery.
- **Service** — consume platform capabilities. Financial Services today; more capability suites over time. (Deliberately singular and verb-form, not "Services" — it names an action ("go get serviced by a capability"), matching the other four domain names, rather than the one noun in the set.)
- **Grow** — improve outcomes. Planning, measurement, scaling.
- **Administer** — manage the platform. Configuration, governance, infrastructure.

This action-oriented model is preferred over noun-based navigation wherever practical, and should be treated as a durable design principle for any future Venture Lab (or other cartridge) navigation work — not just this one reorganisation.

## 4. Venture Lab Navigation

Replace the current eleven top-level tabs with five domains:

```
Operate
Connect
Service
Grow
Administer
```

### 4.1 Operate

**Contains:** Founder Office · Portfolio · Commercial Funnel

**Purpose:** everything directly involved in operating ventures. Founder Office remains the default landing page.

**Founder Office** (retain as-is): Workspace, Discover, Validate, Architect, guided wizards, venture cards, Passport progression, Standing progression.

**Portfolio** (moved here): Board, Scorecards, Council, Actions, Operating Brief, My Portfolio.

**Commercial Funnel** (moved here): Venture Progress, Customer Progress, experience position, venture plotting, commercial progression.

### 4.2 Connect

**Contains:** Founders Club · Relationship Builder

**Purpose:** everything involving people and relationships — collaboration, opportunity discovery, partnerships, mentoring, relationship management.

**Founders Club** (retain as-is): Community Concierge, Opportunity Scout, Founder Coach, Network Navigator, Event Curator, Circle Facilitator, Wellbeing, Recognition, Opportunity, Peer groups.

**Relationship Builder** (retain as-is): Partners, Customers, Compose, QubeTalk, Wave management, CRM.

### 4.3 Service

**Initially contains:** Financial Services. Designed to expand over time — potential future additions include Safeguard, Human Mobility, Legal, Creative Services, Research Services, and further capability suites as they ship.

**Financial Services** (retain existing functionality; internal navigation reorganised):

```
Request · Agreements · Activity · Advanced
```
instead of the current `Constitutional Preview | Founder Office | Advanced`. MoneyPenny becomes the primary interface throughout this capability (§5).

### 4.4 Grow

**Contains:** Growth Matrix · Programme

**Purpose:** strategic progression — venture progression, execution planning, strategic positioning, operational readiness.

**Growth Matrix** (retain as-is): Matrix, Ladder, Model, Strategy, venture positioning, prescriptions.

**Programme** (retain as-is): infrastructure readiness, workstreams, critical path, policy, governance, trust floor, receipts, agents, native cartridges. This becomes the programme control room.

### 4.5 Administer

**Contains:** AgentiQ OS · Plan Pricing · Docs

**Purpose:** administrative rather than operational concerns — configuration, governance, infrastructure.

**AgentiQ OS** (retain as-is): builder substrate, reference agents, skill catalogue, factory, published assets.

**Plan Pricing** (retain as-is): subscription plans, payment rails, premiums, commercial configuration.

**Docs** (retain as-is): planning corpus, specifications, reference material.

## 5. MoneyPenny Strategy

MoneyPenny becomes the ubiquitous financial edge. She is no longer just another cartridge — she becomes the financial interface that travels everywhere.

**Hierarchy:**

```
MoneyPenny Runtime
        ↓
MoneyPenny Cartridge
        ↓
Financial Services
        ↓
Smart Wallet
        ↓
Browser Companion
```

(This hierarchy composes, rather than replaces, the already-shipped MoneyPenny Constitutional Runtime — see its Constitutional Capability Brief, 2026-07-24 — and the already-shipped Financial Services Capability Suite. Neither is rebuilt by this spec; both become more discoverable through it.)

## 6. Smart Wallet

The Smart Wallet becomes the ultra-thin client. It operates consistently whether embedded in metaMe, Qriptopian, partner applications, the Companion, or future websites — without requiring the full Founder Office.

**Wallet responsibilities:** conversation, voice, avatar, discovery, financial guidance, shadow execution, approvals, receipts, deep links.

The wallet should always be capable of explaining: where the user is, what services exist, what actions are available, what approvals are required, and how to continue in Venture Lab if necessary.

## 7. Wallet Navigation

Rather than many tabs, the wallet exposes four conversational modes:

```
Ask · Service · Approvals · Activity
```

**Ask:** conversation, voice, questions, discovery.

**Service:** available capabilities — Financial Intelligence, Investment, Verification, Settlement, Portfolio, etc.

**Approvals:** Passport approvals, delegations, authorisations, payment confirmations, agreement acceptance.

**Activity:** current sessions, receipts, Standing, pending actions, history.

## 8. Wallet Context Contract

Every host application passes context into MoneyPenny. Minimum context:

```
Host application · Current page · Membership · Passport status
Wallet · Assets · Available capabilities · Current agreements
Pending approvals · Persona · Standing
```

MoneyPenny adapts automatically to whatever context she's handed.

## 9. Deep Linking

Every wallet interaction should support, where appropriate:

- Continue in Venture Lab
- Continue in Founder Office
- Continue in Financial Services
- Continue in MoneyPenny
- Continue in Companion

## 10. Information Architecture

The platform hierarchy becomes:

```
Smart Wallet          (ubiquitous edge)
        ↓
Venture Lab           (operator workspace)
        ↓
Specialist Cartridges (deep capability)
```

MoneyPenny spans all three layers.

## 11. Implementation Notes

This specification intentionally avoids rebuilding existing functionality. Implementation should focus on: re-grouping, navigation, routing, presentation, context propagation, deep linking, the shared MoneyPenny runtime. All existing functionality remains operational throughout.

## 12. Deliverables

- New grouped navigation (the five Venture Lab domains, §4)
- Updated routing
- Preserved URLs where practical
- A Wallet Context Contract service (§8)
- A shared MoneyPenny runtime, reachable from every layer (§5)
- Updated Financial Services internal navigation (§4.3)
- Founder Office remains the default Venture Lab landing page
- Deep linking between Wallet, Venture Lab, and MoneyPenny (§9)
- Removal of the redundant flat eleven-tab top-level navigation
- Responsive behaviour maintained throughout

## 13. Ratification Record

*(unchecked — awaiting the operator's explicit pass, per this document's own governance note)*

- [ ] Operator has reviewed §§1–12 as filed
- [ ] Operator confirms the five domain names (Operate / Connect / Service / Grow / Administer) as final
- [ ] Operator confirms the Out of Scope list (§14) as binding
- [ ] Operator authorises Phase 1 implementation to begin

## 14. Out of Scope

- No changes to business logic.
- No changes to constitutional services or agreements.
- No changes to Passport, Standing, or Delegation models.
- No changes to Financial Services execution flows.
- No new APIs beyond those required to support navigation and context propagation.
- Existing URLs and deep links should continue to resolve where practical.
- This work is an information architecture and UX consolidation exercise in preparation for pilot deployments — not a product redesign.
