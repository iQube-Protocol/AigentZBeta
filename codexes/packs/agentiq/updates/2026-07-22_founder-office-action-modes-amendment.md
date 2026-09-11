# Architectural Amendment — Founder Office Action Modes & Founders Club Integration

**Date:** 2026-07-22
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`

> **Status: FULLY RATIFIED (2026-07-22)**, across three rounds of operator review — every
> item in §9's checklist is now checked, including the canonical Founder Office
> definition (§4) and the `AMENDMENT_RECORDS.md` cross-reference (added 2026-07-22). This
> document does not modify ratified charter text — it derives authority from
> `FOUNDER_OFFICE_CHARTER.md` without amending it (the operator's explicit governance-home
> resolution, §8 item 6 of the companion PRD). Nothing in this document authorizes code
> changes on its own; a follow-on implementation plan (its own phase/PRD numbering, §9)
> is the one remaining step before Phase 1 code work begins.

> **Revision note (2026-07-22, post-authoring correction, operator-ratified):** the
> first draft of this document named the five modes with an "I " prefix (`I Build`,
> `I Create`, `I Develop`, `I Research`, `I Safeguard`). The operator corrected this:
> the "I " prefix reads as an identity statement ("I Build" ~ "I am a builder"), which
> is exactly the identity-framing this amendment exists to move away from. The mode
> names are now the bare words — **Build, Create, Develop, Research, Safeguard** — and
> the intent-oriented phrasing lives in the onboarding *conversation*, not the label:
> the question "What do you want to do?" is answered "I want to build" / "I want to
> create" / etc. The operator also named an explicit **Role** layer — the archetype a
> citizen occupies while executing or intending to act along a given mode — and
> supplied the missing role name for Safeguard: **Protector**. See the new §2.0 for
> the full three-layer framing this produces (Citizen → Action Mode → Role), the
> renamed §2.1–§2.5 headers, and the new Role column in §3's mapping table. This
> specific naming/framing correction is operator-ratified as of this revision (see the
> new first item in §9); the rest of this document's open questions (§8) remain
> unresolved.

> **Revision note 2 (2026-07-22, second round — all six §8 questions resolved by the
> operator, plus one governing architectural statement).** The operator answered every
> open question from §8 directly, and supplied a single paragraph intended to resolve
> the shape of the whole amendment at once. Quoted in full because it is now the
> **primary interpretive frame for this entire document** — every section below should
> be read through it:
>
> > "Action Modes are an orchestration layer, not a replacement for the constitutional
> > model. They do not replace archetypes, standing, entitlements, billing, or
> > constitutional domains. They provide an intent-first interaction model that allows
> > the Runtime to dynamically compose existing constitutional capabilities around what
> > the founder is trying to accomplish right now."
>
> And the companion distinction the operator asked to be stated explicitly, because an
> earlier draft of this reasoning (mine) still implicitly treated Action Modes as
> heading toward replacing archetypes:
>
> > "Archetypes describe enduring constitutional characteristics. Action Modes describe
> > temporary constitutional intent."
>
> The concrete resolutions (full text inline at each item, §8): (1) Safeguard is a
> **superset of `citizen`**, not a new capability domain — no new SKU, no new
> entitlement model. (2) Standing does **not** become mode-aware in Phase 1 — it
> remains archetype/constitutional-activity-derived and durable; modes are ephemeral.
> (3) `activeActionModes` is **session/runtime context state, not permanent profile
> data** — this corrects §6's original proposal below, which modeled it closer to a
> persistent, `research_tier`-like DB column; see the corrected §6.1 note. (4) NBE
> reranking is **not restructured** — modes become an additional **weighting signal**
> on the existing archetype/venture-context/standing/Experience-Guide/constitutional
> signal set, not a replacement axis. (5) The archetype picker in
> `ExperienceModelSetupWizard.tsx` **stays**, moved behind the scenes as constitutional
> metadata; Action Mode selection ("What do you want to do today?") becomes the
> user-facing UX. (6) Sequencing is **three phases**: Phase 1 = Action Modes as UX +
> Runtime weighting signal only, zero changes to Standing/Billing/Archetypes/
> Entitlements/Research SKU ("new front-end, existing back-end"); Phase 2 = Founders
> Club/Community Concierge built using Action Modes; Phase 3 = mode analytics/history/
> adaptive onboarding, gated on Phase 1–2 data proving it valuable, and **still no
> standing-computation impact unless a future constitutional decision explicitly calls
> for it.**
>
> These resolutions are recorded in place at each §8 item and reflected in the
> corrected §5 and §6 below, rather than superseding those sections with a rewrite —
> the original proposal is left visible, struck through in intent (not literally
> deleted), so the correction is auditable against what it corrected.

---

## §0 Reconciliation — what already exists today

Before proposing anything, this section states the current, real state of the
codebase, verified by reading the source files directly (not from memory or the
operator's illustrative shorthand).

### 0.1 The current identity-based pathway: `OperatorArchetype`

`services/iqube/experienceQube.ts` defines the actual enum in production today:

```ts
export type OperatorArchetype = 'citizen' | 'entrepreneurial' | 'technical' | 'creative' | 'research';
```

paired with a `VALID_ARCHETYPES` set of the same five values, and threaded through
`ExperienceQubeMeta.operatorArchetype` (nullable, T1/public-safe), the `DbRow.operator_archetype`
column, and both `rowToRecord()` and `upsertExperienceQube()`. It is a **single, nullable,
mostly-permanent field per persona** — one archetype, set at onboarding, changed rarely.

The operator's brief used illustrative labels (Entrepreneur/Researcher/Developer/Creator/Citizen)
that are not the literal enum spelling. The mapping onto the real values is:

| Operator's illustrative label | Real `OperatorArchetype` value |
|---|---|
| Entrepreneur | `entrepreneurial` |
| Researcher | `research` |
| Developer | `technical` |
| Creator | `creative` |
| Citizen | `citizen` |

### 0.2 Downstream consumers of the archetype (verified, not assumed)

Four real files consume `OperatorArchetype` today, each confirmed by direct read:

1. **`services/standing/standingScore.ts`** — imports `OperatorArchetype` from
   `experienceQube.ts` and defines `ARCHETYPE_DOMAINS: Record<OperatorArchetype, string[]>`,
   mapping each archetype to the Standing-Charter declaration domains it most expresses
   (e.g. `research: ['publications', 'education', 'validation', 'recognition', 'professional']`).
   `ARCHETYPE_PATHWAYS` is derived from `Object.keys(ARCHETYPE_DOMAINS)`. These are documented in
   the file itself as **"filter tags... not a separate score"** over one unified Standing number —
   `computeStandingScore()`'s `pathwayTags` output, gated behind `includePathwayTags` (a Tier 1+
   entitlement).
2. **`components/metame/setup/ExperienceModelSetupWizard.tsx`** — the real onboarding UI. Defines
   its own local `OperatorArchetype` type (structurally identical to the service's), an
   `OPERATOR_ARCHETYPES` picker array with `{ value, label, hint }` per archetype (labels:
   "Entrepreneurial", "Technical", "Creative", "Citizen", "Research & Discovery"), and an
   `ARCHETYPE_DEFAULT_TYPE` map that auto-selects a sensible `experienceType` default per archetype
   (`entrepreneurial/technical → venture_building`, `creative → creative`, `citizen/research →
   personal`). The wizard renders this as a **single-select radio group** — `selectArchetype()`
   replaces the whole value; there is no multi-select affordance anywhere in this component.
3. **`data/activation-catalog.ts`** and **`services/activations/activationPlanGate.ts`** — do NOT
   key gates directly on `OperatorArchetype`. They key on **activation ids** (`'researcher'`,
   `'aigent-z'`, `'venture-lab'`, `'marketa'`, `'metame-studio'`, `'human-mobility-services'`),
   which are a *different* dimension (surface/tab visibility + plan-tier entitlement) that happens
   to correlate with archetype choice by product convention, not by code-level coupling. E.g. the
   `'researcher'` activation entry is gated by `p.researchCopilotAccess` (a billing-plan flag,
   `research_tier === 'active'`), entirely independent of whether the persona's
   `operatorArchetype` field is set to `'research'`. This is a materially easier migration surface
   than it first appears: **no activation-gate logic reads `operatorArchetype` directly today.**
4. **`app/api/assistant/experience-model/route.ts`** (read during the researcher-pathway precedent
   work, referenced in the 2026-07-16 update doc) — the persistence route casts the request body to
   `OperatorArchetype` and delegates validation to `VALID_ARCHETYPES`; it performs no per-archetype
   branching of its own.

### 0.3 The ratified Founder Office Charter — actual current language

`codexes/packs/polity-core/items/FOUNDER_OFFICE_CHARTER.md` (v1.0.0, ratified 2026-06-17) is read
in full for this amendment. Its actual **Purpose** section:

> "Founder Office exists to help founders discover, evaluate, and transform latent capability
> within the Polity into products, services, ventures, institutions, and outcomes... Founder
> Office is not primarily a software suite. Founder Office is a capability discovery and
> opportunity intelligence service powered by the metaCommons."

Its actual **First Principle**:

> "Founders do not create value from information alone. Founders create value by identifying
> capability latent within information and transforming that capability into useful work. The
> purpose of Founder Office is to reduce uncertainty, reduce time-to-value, and reduce the cost of
> discovering meaningful opportunities."

And its **Founder's Challenge** framing (demand/capability/trust/opportunity are each "difficult to
observe/discover/establish/validate" in traditional environments; the Polity exists to improve each
condition).

Nowhere does the ratified charter define Founder Office in terms of a fixed operator archetype, a
pathway enum, or an identity taxonomy. The charter is already framed around **capability and
opportunity**, which is a closer conceptual fit to action-mode framing than to identity framing —
this amendment's direction is compatible with, not a departure from, the ratified text.

### 0.4 Recent, load-bearing precedent: the researcher-pathway integration (2026-07-16)

`codexes/packs/agentiq/updates/2026-07-16_researcher-pathway-fo-subscription-integration.md`
documents, in full, how the fifth archetype (`research`) was added as **"a first-class peer to the
four existing pathways"** and threaded end-to-end: the type union, the Standing domain map, the
setup wizard picker, a DB CHECK-constraint migration, a dedicated billing SKU
(`research_tier`/`researchCopilotAccess`, its own `$29/mo` tier, deliberately NOT derived from
`sovereignAccess`), an activation-catalog entry, a specialist-router persona (`aigent-researcher`),
and specialist-recommender wiring — five parallel `Record<SpecialistId>` maps updated together to
avoid an exhaustiveness break.

This is the load-bearing precedent this amendment must respect: identity-based pathways are not a
stub in this codebase — they are a fully wired, recently-extended, production system with real
billing money flowing through them (`research_tier` column, live checkout). **This amendment
proposes moving the onboarding/orchestration framing from identity to action-mode-based, not
deleting or rewriting the archetype system that precedent built.** Where §6 below describes
"additive only," it means additive against exactly this file list.

---

## §1 Motivation — intent/action/constitutional-agency framing over identity framing

The current model asks, once, at setup time: **"which archetype IS this person?"** — a fixed,
mostly-singular choice (`ExperienceModelSetupWizard`'s `selectArchetype()` replaces the whole
value; there is no multi-archetype state anywhere in the schema, the wizard, or the standing
pathway tags).

This has two structural costs that become more visible as the platform matures:

1. **People are not one thing.** An operator building a product (`Build` mode) may simultaneously
   hold a governance/review role over other builders (`Safeguard` mode) — or run customer-discovery
   experiments (`Research` mode) alongside shipping code (`Build` mode). The current model forces a
   single label that under-describes the actual work being done, and the label rarely changes once
   set (there is no "switch mode for this session" affordance — only a full re-run of the setup
   wizard).
2. **Identity framing biases NBE reranking and Runtime capability activation toward a static
   snapshot of who the operator was at onboarding, not what they are doing right now.** The
   `operatorArchetype` field literally feeds NBE reranking (per its doc comment: "Feeds NBE
   reranking so aigentMe biases toward archetype-appropriate moves") — a stale or single-valued
   signal here means the Runtime's next-best-action logic is working from an incomplete picture of
   current intent.

**Constitutional agency framing** — what is the operator actually *doing*, right now, in this
capability-discovery relationship with the Founder Office — is a closer match to the ratified
charter's own language (§0.3: "transforming... capability into useful work" is a statement about
action, not identity) and gives the Runtime a dynamic signal to activate capabilities against,
rather than a static one to branch on.

This is explicitly **not** a claim that identity/archetype is wrong or should be removed — see §6.
It is a claim that a second, orthogonal, dynamic dimension is a better primary signal for
Runtime capability activation, while archetype remains a useful default/derived signal and the
system of record for Standing-domain lensing and billing entitlement that already exists.

---

## §2 The five Constitutional Action Modes

Five modes, each describing **current activity**, not identity. A persona may have zero, one, or
several active simultaneously (see §5). Definitions below are written to be non-overlapping;
the Build/Develop distinction is the pair most likely to be confused, so it gets the most detailed
treatment.

### 2.0 Naming convention and the three-layer model (operator-ratified correction)

**Mode names are the bare action words — Build, Create, Develop, Research, Safeguard — not
`"I Build"`/`"I Create"`/etc.** An `"I "` prefix on the mode's canonical name reads as an identity
statement ("I Build" parses like "I am a builder") — exactly the identity-framing §1 argues this
amendment should move *away* from. The intent-oriented phrasing this amendment wants belongs in the
onboarding **conversation**, not the mode's name: the onboarding question is

> **"What do you want to do?"**

and the natural answer is an intent expression — **"I want to build."** / **"I want to create."** /
**"I want to develop."** / **"I want to research."** / **"I want to safeguard."** — never a bare
identity claim ("I am a builder"). The distinction matters: "I Build" (as a label) is almost
identity; "I want to build" (as a conversational answer) is action/intent. This document uses the
bare mode name everywhere as the canonical, code-facing/data-facing value, and reserves the
"I want to ___" phrasing for onboarding copy and conversational surfaces only.

**The three-layer model this produces (operator-ratified framing):**

| Layer | What it is | Values | Permanence |
|---|---|---|---|
| **Identity** | The default, base status every persona has | `citizen` | Fixed/default — the baseline every action mode is exercised *from* |
| **Action Mode (intent)** | What the citizen is currently doing or intends to do | Build, Create, Develop, Research, Safeguard | Dynamic, non-permanent, zero-to-many active at once (§5) |
| **Role (archetype)** | The role the citizen *occupies* while executing or intending to act along a given mode | Builder, Creator, Developer, Researcher, Protector | Derived from the active mode — not a separate, independently-set field |

Concretely: **Citizen is the default identity every persona already has** (confirmed against the
existing `citizen` archetype value, §3). **The five action modes are the citizen's intent types** —
what a citizen is choosing to do right now. **The archetype roles (Builder, Creator, Developer,
Researcher, Protector) are the roles a citizen occupies when executing or intending to act along
those intent types** — a role is a property of being *in* a mode, not a second independent identity
a persona separately declares. This reframes §3's archetype↔mode mapping: the existing
`OperatorArchetype` values (`entrepreneurial`, `technical`, `creative`, `research`) already *are*
role names in substance (a builder, a developer, a creator, a researcher) — they were simply not
previously named that way, and had no fifth peer for Safeguard. **Protector** is the operator-named
role for Safeguard-mode activity — "one who protects, safeguards" — filling the gap §2.5 originally
flagged as having no archetype predecessor. Whether `protector` becomes a sixth live
`OperatorArchetype` enum value, or Role stays a presentation-layer label derived from the active mode
without its own DB column, remains open (§8.1) — this section fixes the *names*, not the storage
mechanics.

### 2.0.1 Action Modes are views over capabilities, not capabilities themselves (operator's second-round clarification)

**Action Modes are not products, and not entitlement domains. They are orchestration
modes — an intent router over the constitutional/service domains that already exist.**
The operator's own list of what a mode orchestrates *across*: Build, Research, Develop,
Finance, Civic, etc. — the platform's existing **Constitutional Capability Domains**
(the CRP-family naming already in use: `codexes/packs/irl/foundation/CFS-009...`/CRP-003
charters the Financial Services Constitutional Capability Domain as "Domain 3"; the
`data/codex-configs.ts` CRP-003a comment names it directly — "Domain-3 (Financial
Intelligence, read-only) capability"). **This is a real, load-bearing naming collision
worth flagging rather than glossing over:** "Build," "Research," and "Develop" are used
by the operator both as **Action Mode names** (§2.1–§2.5, the UX-facing intent layer)
*and* informally as **capability/service domain names** (the orchestration-target
layer) — e.g. Safeguard mode orchestrates across the Legal, Civic, Identity,
Compliance, Governance, Privacy, IP, Risk, and Financial-safeguarding domains, none of
which is itself a fifth Action Mode.

**Resolution:** the two layers are related but distinct, and this document uses them as
follows — an Action Mode (Build/Create/Develop/Research/Safeguard) is the founder's
**current intent**, expressed once, at the UX layer; a Constitutional Capability Domain
(Finance/Civic/Legal/Identity/... — including the CRP-family domains already chartered)
is a **service/entitlement territory** the Runtime composes *underneath* that intent.
Entering Safeguard mode does not activate a new domain — it re-weights the Runtime's
orchestration toward the Legal/Civic/Identity/Compliance/Governance/Privacy/IP/Risk/
Financial-safeguarding domains that already exist, using their existing services and
entitlements unchanged (per the operator's governing statement above: "Action Modes are
views over capabilities, not capabilities themselves"). Where a mode name and a domain
name happen to share a word (Build the mode vs. a hypothetical "Build" domain, Research
the mode vs. a hypothetical "Research" domain), code-facing identifiers for modes and
domains should stay in clearly distinct namespaces (e.g. `ConstitutionalActionMode`
literal `'Build'` vs. a `ConstitutionalCapabilityDomain` identifier that is never the
bare word alone) so the two concepts cannot be silently conflated in a schema, a query,
or a specialist-routing table. This document does not mint a canonical domain list —
that is the CRP charter family's job — it only fixes that Action Modes sit *above* that
list as an orchestration/intent layer, never as a sixth entry in it.

### 2.1 Build (role: Builder)

**Definition:** Building ventures, businesses, teams, products, and standing — founding and
growing the venture as a going concern. The verb is *building the enterprise itself* — forming the
team, the product line, the commercial motion, the partnerships, and the standing/reputation that
make the venture real and durable in the world.

**What falls under it:** venture formation and stage advancement, partner/GTM motion, KPI
stewardship, standing accrual. Representative surfaces: Venture Lab (`venture-lab` — workstreams,
partners declared, progress reports, milestones hit, partner conversions, runway-extending
events), Marketa (`marketa` — campaigns, outreach, partner replies, meetings booked, partnerships
closed), and the Standing Cartridge (`standing-cartridge` — evidence, VSP compilation).

**Nearest archetype predecessor:** `entrepreneurial` — an exact match: `ARCHETYPE_DEFAULT_TYPE.
entrepreneurial = 'venture_building'` in `ExperienceModelSetupWizard.tsx` already names the
venture-building sense directly.

### 2.2 Create (role: Creator)

**Definition:** Producing cultural, editorial, or narrative artifacts — media, IP, story, brand,
design work whose value is expressive/cultural rather than functional/technical.

**What falls under it:** the Qriptopian editorial surface (briefs, angles, longer-form narrative),
metaMe Studio authorship (StudioArtifacts — briefs, post-sets, image prompts, video scripts, slide
outlines per `data/activation-catalog.ts`'s `metame-studio` entry), myCluster publishing.

**Nearest archetype predecessor:** `creative`.

### 2.3 Develop (role: Developer)

**Definition:** Software, AI, automation, engineering, and technical systems and infrastructure —
the Developer-equivalent mode. The verb is *making the technical thing exist* — writing code,
designing the architecture, shipping the release, running the technical build loop — as distinct
from building the venture itself (Build).

**The Build vs Develop distinction, made explicit (the least obvious pair):**

| | Build (role: Builder) | Develop (role: Developer) |
|---|---|---|
| Object of the verb | The venture as a going concern (team, product line, traction, partnerships, standing) | The technical artifact itself (code, protocol, infrastructure, automation) |
| Representative surfaces | Venture Lab (`venture-lab`), Marketa (`marketa`), Standing Cartridge | `aigent-z` Command Center, AgentiQ OS Build/Bind/Deploy |
| Representative actions | `generate-venture-report`, `advance-stage`, `draft-outreach`, `launch-sequence`, `add-evidence`, `compile-vsp` | `start-dev-intent`, `validate-build`, `build-agent` |
| Failure mode if conflated | A founder who is only Developing never gets partner/GTM support surfaced | A founder who is only Building never gets technical-debt / build-quality surfaced |
| Analogy / Role | The operator / venture-builder — **Builder** | The engineer / architect — **Developer** |

**Why the distinction matters operationally:** the current `data/activation-catalog.ts` already
draws exactly this line at the activation level — `venture-lab` and `marketa` (Build motion:
workstreams, partners declared, progress reports, milestones hit, partner conversions,
runway-extending events, campaigns, outreach, partner replies, meetings booked, partnerships
closed) are **structurally separate** catalog entries from `aigent-z` (Develop motion: intents
distilled, gap analyses, consequence canvases, validations passed, dev loops completed). A person
actively running both loops in the same week — closing a partnership AND shipping a technical
build — is common and already representable in the activation system; this amendment proposes
making that same duality representable at the *mode* layer that drives NBE reranking, not just at
the tab-activation layer.

**Nearest archetype predecessor:** `technical` — an exact match: the wizard's own hint text for
`technical` ("Protocol contribution, tooling, infrastructure, or development") is unambiguously
Develop-mode language, and `ARCHETYPE_DEFAULT_TYPE.technical = 'venture_building'` names the same
build-loop surface (`aigent-z`) this mode targets.

### 2.4 Research (role: Researcher)

**Definition:** Structured discovery — forming hypotheses, running experiments, gathering
evidence, validating or falsifying claims against the invariant substrate. The verb is *learning
what is true*, not building, creating, or developing.

**What falls under it:** the IRL OS Research Agent / Research Copilot loop (`invariants_queried`,
`experiments_run`, `counterfactuals_projected` activity metrics; `results_published`,
`invariants_validated` outcome metrics per the `researcher` activation entry).

**Nearest archetype predecessor:** `research` — a direct, uncomplicated mapping; this mode requires
the least translation of any of the five.

### 2.5 Safeguard (role: Protector) — genuinely new, not a rename

**This mode does not map cleanly onto any of the five existing archetype values
(`citizen | entrepreneurial | technical | creative | research`). It is new surface area, and this
document flags that explicitly rather than disguising it as a rename.**

**Proposed definition (operator-confirmed scope, 2026-07-22 — broader than an earlier "civic/
legal" framing this supersedes):** Contracts, intellectual property, governance, compliance,
privacy, identity, constitutional rights, corporate structure, trust, and risk management — acting
to protect the integrity, rights, and structural soundness of the venture and the system other
operators build, create, develop, and research within, rather than adding to that system directly.
This is deliberately broader than a narrower "civic participation" or "legal compliance only"
reading — Safeguard spans the full constitutional-capability surface a founder needs protected
(legal structure, IP, privacy, identity, governance, risk) alongside — not instead of —
governance/compliance/security/standing-verification activity.

**Proposed reconciliation against existing machinery (not yet built, proposed here for the first
time):**

- **Access-gate evaluation.** `evaluateAccess()` (per CLAUDE.md's Identity & Access Spine section)
  is the canonical "should this read/tx be allowed?" decision gate. Safeguard-mode activity would
  be the human counterpart to that machinery — a person actively reviewing, moderating, or
  adjudicating access/standing decisions, not merely subject to them. This is conceptually adjacent
  to (but currently has no code representation in) the access spine.
- **Standing Charter's "confidence in declarations" framing.** `services/standing/standingScore.ts`
  frames Standing as, verbatim in its own header comment, "confidence in the veracity of
  declarations." Safeguard-mode work — verifying evidence, adjudicating VSP facts, compiling
  standing profiles on others' behalf — is the *production* side of that confidence signal, whereas
  today's Standing machinery only models the *consumption* side (a persona's own score). No file in
  this codebase currently models "a persona acting to verify or adjudicate another persona's
  standing" as a first-class activity; Safeguard would be the mode label for that activity if/when
  it is built.
- **What Safeguard is explicitly NOT:** it is not a rename of `citizen` (which is about sovereignty
  /identity/governance *participation*, i.e. being governed, per the wizard's own hint text:
  "Sovereignty journey, identity, governance participation") — Safeguard is about *exercising*
  governance/protection function, an active rather than participatory relationship to the system.
  The operator should ratify whether Safeguard is better modeled as a superset of `citizen`'s
  governance-participation sense, or as a wholly disjoint new capability domain. This document does
  not resolve that question (see §8).

---

## §3 Mapping table — archetype ↔ action mode ↔ role

One row per existing archetype value, explicit about where the mapping is inexact. The **Role**
column is new (§2.0) — the operator-named archetype-role a citizen occupies while executing or
intending to act along the mode in the adjacent column.

| Archetype (`OperatorArchetype`) | Action mode | Role | Exactness |
|---|---|---|---|
| `citizen` | (none directly — see below) | *(none — Citizen is the base identity, not a role)* | **Inexact.** `citizen` today means sovereignty/identity/governance *participation* (being a citizen of the Polity), which is closer to a baseline status than an action mode. It does not map onto Build/Create/Develop/Research, and mapping it onto Safeguard would be a stretch (participation ≠ exercising a protective function). Proposal: `citizen` remains the default identity every persona has, not an action mode; a citizen with no other mode active is simply not currently doing Founder-Office-scoped work. |
| `entrepreneurial` | Build | **Builder** | **Exact.** Direct 1:1: `ARCHETYPE_DEFAULT_TYPE.entrepreneurial = 'venture_building'` in `ExperienceModelSetupWizard.tsx` names the venture-building sense (team, product, standing, partnerships) that Build is defined around in §2.1. |
| `technical` | Develop | **Developer** | **Exact.** Direct 1:1: the wizard's own hint text for `technical` ("Protocol contribution, tooling, infrastructure, or development") is unambiguously the software/AI/automation/engineering scope Develop is defined around in §2.3. |
| `creative` | Create | **Creator** | **Exact.** Direct 1:1; `ARCHETYPE_DEFAULT_TYPE.creative = 'creative'`. |
| `research` | Research | **Researcher** | **Exact.** Direct 1:1; the most recently added archetype (2026-07-16) and the mode requiring the least translation. |
| *(no predecessor)* | Safeguard | **Protector** (operator-named, 2026-07-22) | **No archetype predecessor — new.** See §2.5. Its scope (contracts, IP, governance, compliance, privacy, identity, constitutional rights, corporate structure, trust, risk management) supersedes an earlier, narrower "civic/legal" framing and is flagged explicitly per the operator's confirmation (2026-07-22) as genuinely new surface area, not a rename of `citizen` or any other archetype. Whether `protector` becomes a live `OperatorArchetype` enum value or Role stays a derived, presentation-layer label remains open (§8.1). |

---

## §4 Canonical Founder Office definition

The operator has provided the following as the verbatim, authoritative canonical definition of
Founder Office, quoted exactly and intended to become the canonical text reused across
documentation, onboarding flows, agent responses, and platform messaging:

> **"The Founder Office is the constitutional operating environment for people building
> meaningful ventures. It combines intelligent agents, trusted services, financial
> infrastructure, governance, and community into a single workspace that helps founders
> transform ideas into enduring enterprises while progressing on their own journey toward
> sovereignty."**

### Reconciliation with the ratified charter (§0.3)

This verbatim definition is compatible with — not a departure from — the ratified
`FOUNDER_OFFICE_CHARTER.md` (v1.0.0, ratified 2026-06-17). The charter's Purpose language
("transform latent capability... into products, services, ventures, institutions, and outcomes")
and First Principle ("Founders create value by identifying capability latent within information and
transforming that capability into useful work") both describe the same transformation the verbatim
definition names more concisely as "transform ideas into enduring enterprises." Neither text
defines Founder Office in identity/archetype terms, and the verbatim definition's explicit mention
of "governance" and "community" alongside "intelligent agents, trusted services, financial
infrastructure" maps directly onto §7's Operational Domain / Human Domain split below — the
charter's institutional-interface framing and the verbatim definition's single-workspace framing
describe the same institution from two altitudes (constitutional vs product).

This document proposes the verbatim text above as the canonical, citable Founder Office
definition — reusable as-is by the companion Founders Club PRD
(`codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md`, §7) and by any future
onboarding copy, agent system prompt, or platform messaging surface that needs to state what
Founder Office is in one paragraph. Adopting it as canonical is itself one of the ratification
items in §9 — it is proposed here, not yet ratified.

---

## §5 Runtime behavior changes — multi-mode simultaneous activation, as a weighting signal

**Current behavior:** the Runtime (NBE reranking, Experience Guide flows, capability surfacing)
reads a single, nullable `operatorArchetype` value per persona and biases toward
archetype-appropriate moves. One value, one bias vector, set at onboarding and rarely revisited.

**Corrected proposed behavior (operator's second-round resolution to §8 item 4 —
supersedes this section's first-draft framing below the line):** NBE reranking is
**not restructured**. It continues to read primarily from archetype, venture context,
Standing, Experience Guide state, and constitutional context, exactly as today. The
**set of currently active Action Modes becomes one additional weighting signal** layered
on top of that existing computation — not a replacement axis, and not by itself a new
reranking algorithm.

- A persona could hold `{ 'Build', 'Research' }` simultaneously. The Runtime does not
  switch to a mode-only ranking; it takes its existing archetype/venture/standing-driven
  ranking and **raises the weight** of Build- and Research-relevant recommendations
  while **slightly deprioritizing** everything else — a re-weighting pass over the
  existing signal set, not a parallel/independent signal that competes with it.
- Modes are proposed as **dynamic and non-permanent**: a persona's active-mode set can change
  session-to-session, or even within a session, as their current work shifts — in contrast to
  archetype, which today changes only when the operator re-runs
  `ExperienceModelSetupWizard`'s single-select picker (§8 item 5: the wizard itself is kept,
  just moved behind the scenes).
- **Explicitly not required for Phase 1** (§8 item 6): no reranking algorithm change ships
  before the Founders Club/Concierge phase. Phase 1 is "new front-end, existing back-end" —
  Action Modes exist as UX and as a signal the *Runtime is aware of*, without the reranking
  function itself being touched yet.

**Concrete illustration.** A founder might be in Research mode in the morning, Develop mode in the
afternoon, and Safeguard mode in the evening — and multiple modes may be active simultaneously (a
founder could be in Build and Safeguard at once, e.g. closing a partnership while also reviewing a
contract). With Build and Research both active, Build- and Research-flavored recommendations rank
higher and everything else ranks slightly lower — the existing archetype/standing/venture-context
ranking is re-weighted, not replaced, and the Runtime still surfaces whichever specialist
capabilities fit the current task on top of that re-weighted base.

---

## §6 Backward compatibility & migration strategy

This section is the operative constraint on the whole amendment: **nothing here may break the
researcher-pathway precedent (§0.4) or any other archetype consumer (§0.2) during or after a
transition.**

### 6.1 Core coexistence principle

**Action modes are proposed as an ADDITIVE, orthogonal dimension that composes with the existing
`OperatorArchetype` field — not a replacement for it.** Concretely:

- The `OperatorArchetype` enum, the `operator_archetype` DB column, `VALID_ARCHETYPES`, and every
  API that reads/writes it stay exactly as they are. **No deletion, no renaming, no narrowing.**
- **Corrected data-shape decision (operator's second-round resolution to §8 item 3 —
  supersedes 6.2 point 1 below, which is left visible as the superseded proposal, not
  deleted):** `activeActionModes` is **session/runtime context state, not permanent
  profile data.** It is not identity, not access control, and — explicitly — not a new
  column requiring a schema migration modeled on `research_tier`. It is stored
  alongside the persona's active Experience-Guide/runtime session state (the same class
  of ephemeral, per-session context the platform already carries, e.g. `activeActionModes:
  ['Build', 'Research']`), not on a persistent per-persona profile table. If later usage
  proves historical mode analytics valuable (Phase 3, §8 item 6), that becomes **event
  telemetry** (a stream of mode-change events with timestamps), not a persisted profile
  field — the profile stays exactly as thin as it is today.
- Archetype remains the **default/derived mode-set seed** for a persona's *first* session in
  the new UX: a persona's existing `operatorArchetype` value maps via §3's table to an initial
  `activeActionModes` value (e.g. `entrepreneurial → ['Build']`, `technical → ['Develop']`),
  giving every session a sensible non-empty starting mode-set with zero manual migration
  step required of the operator. The persona can then freely add/remove modes from that seed
  for the current session — this reseeding is a read-time derivation, not a write to the
  archetype record itself.

### 6.2 Concrete migration/coexistence mechanism

**Superseded proposal (first draft, kept visible for audit — see 6.1's corrected note above
for what actually applies):** ~~Additive DB column, not a schema rewrite. A new nullable
column (or a JSON array column) alongside `operator_archetype` on the `experience_qubes`
table — mirroring exactly the pattern already used for `research_tier` in the 2026-07-16
precedent (`supabase/migrations/20260716010000_persona_plans_research_tier.sql`).~~ This
modeled Action Modes as closer to permanent profile data than the operator intends —
`research_tier` is durable billing state; Action Modes are not. The corrected mechanism:

1. **No new persistent DB column for the mode-set itself.** `activeActionModes` lives in
   session/runtime context (§6.1), not in a `research_tier`-style additive column. If a
   lightweight persistence layer is needed at all (e.g. to resume a session), it should use
   whatever mechanism already carries other ephemeral runtime/session state in this codebase,
   not a new profile-table column — a decision for whoever builds Phase 1, informed by
   which existing session-context mechanism is the closest fit.
2. **Archetype-to-default-mode mapping table.** §3's mapping table, expressed as code (e.g. a
   `Record<OperatorArchetype, ConstitutionalActionMode[]>` sitting next to `ARCHETYPE_DOMAINS` in
   `standingScore.ts` or as its own module) is the single source of truth for the default seed —
   never hand-duplicated at each read site, per CLAUDE.md's source-of-truth-parity discipline
   (`inv.engineering.036/037`).
3. **Dual-read/reseed, not a migration.** Because the mode-set is session state, not persisted
   profile data, there is no "migration" in the schema sense — every new session simply
   reseeds from the archetype-derived default (point 2) unless the founder has already chosen
   modes for that session.
4. **No forced re-onboarding.** Existing personas are never required to re-run a wizard step to
   remain functional — the derived default keeps them fully served every session, whether or
   not they ever customize their active modes.

### 6.3 File-by-file impact — what changes vs what stays additive-only

| File | Change under this proposal | Stays as-is |
|---|---|---|
| `services/iqube/experienceQube.ts` | ADD a `ConstitutionalActionMode` type/union for reference by the session-context layer (§6.1) — no new column on `ExperienceQubeMeta`/`DbRow`, since the mode-set is session state, not profile data | `OperatorArchetype` union, `VALID_ARCHETYPES`, `operator_archetype` column, all existing read/write functions unchanged |
| `services/standing/standingScore.ts` | Optionally ADD a mode-aware view alongside `ARCHETYPE_DOMAINS`/`ARCHETYPE_PATHWAYS` if Standing lensing should also read modes (open question, see §8) | `ARCHETYPE_DOMAINS`, `ARCHETYPE_PATHWAYS`, `pathwayTags` output, the "filter tag, not a separate score" contract — unchanged; the unified Standing score computation is untouched |
| `components/metame/setup/ExperienceModelSetupWizard.tsx` | ADD a mode-select UI (multi-select, distinct from the archetype radio group) as a new step or an additional field on an existing step | `OPERATOR_ARCHETYPES` picker, `ARCHETYPE_DEFAULT_TYPE`, the single-select `selectArchetype()` behavior — all remain functional and are not removed; archetype selection continues to work exactly as it does today |
| `data/activation-catalog.ts` | Optionally ADD a `modes` field to `ActivationCatalogEntry` (mirroring `sourceCartridge`) so activations can declare which action mode(s) they primarily serve, for future mode-aware activation surfacing | No existing entry's `gate`, `tabSlug`, `metrics`, or `actions` change; no entry is removed or renamed |
| `services/activations/activationPlanGate.ts` | No change required — confirmed in §0.2 that no gate here reads `operatorArchetype` directly, so this file needs no migration work at all under this proposal | Entire file unchanged |

### 6.4 What must keep working unchanged during any transition (explicit, per operator instruction)

- **Runtime behaviour, agent routing, standing logic, Experience Guide flows, and existing APIs.**
  None of the files in §6.3's "stays as-is" column may regress.
- **Billing/subscription tiers keyed on archetype-adjacent activation ids** — the `research_copilot`
  SKU (`services/billing/personaPlan.ts`'s `researchCopilotAccess`, sourced solely from
  `research_tier === 'active'`), every `ACTIVATION_PLAN_GATE` entry, and the `ARCHETYPE_DOMAINS`
  Standing lenses — all keep working unchanged, because (per §0.2 point 3 and §6.3) none of them
  are being altered by this proposal; they are read-compatible with an archetype value that
  continues to exist exactly as today.
- **This is the migration discipline CLAUDE.md's `inv.engineering.036/037` (source-of-truth parity)
  exists to enforce** — an unmigrated, silent cutover from archetype to action-mode (deleting the
  enum, rewriting consumers in place, no dual-read period) is precisely the defect class that
  discipline was written to prevent, and this section's mechanism is designed to avoid it.

---

## §7 Relationship to Founders Club

A companion document, **PRD-FDC-001 (Founders Club)**, is understood to be authored in parallel by
another agent at:

```
codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md
```

This document does **not** assume or assert PRD-FDC-001's specific content, scope boundaries, or
conclusions, since it had not yet been committed to the repository at the time this document was
written (confirmed absent by directory listing at authoring time). What follows in §7.1–§7.5 is the
operator's own framing of where Founders Club sits relative to Founder Office, provided directly for
this amendment — not this document's independent invention, and not a claim about PRD-FDC-001's
eventual content.

### 7.1 Relationship diagram (operator-provided, verbatim structure)

```
Polity Passport
  ↓
Founder Journey
  ↓
Founder Office
├── Operational Domain
└── Human Domain
  └── Founders Club
```

Founders Club is the Human Domain half of Founder Office; the Operational Domain is the other,
sibling half. The two domains are not competing implementations of the same concern — they divide
Founder Office's responsibilities along a clean seam: operational execution vs. human
connection/wellbeing.

### 7.2 Founders Club responsibilities vs. Founder Office (Operational Domain)

Per the operator's framing:

- **Founders Club (Human Domain) responsibilities:** connection, collaboration, opportunity,
  wellbeing, recognition, community, mentoring.
- **Founder Office (Operational Domain) responsibilities:** operational execution — the
  capability-discovery, opportunity-intelligence, and venture-formation machinery described in §0.3
  and §4 (agents, trusted services, financial infrastructure, governance).

This is a responsibilities split, not a mode split — a founder's active action mode (§2) determines
*what specialist capability* the Runtime surfaces at a given moment, while the Operational/Human
domain split determines *which half of Founder Office* that capability lives in organizationally.
The two dimensions compose: e.g. a founder in Build mode might be served by an Operational
Domain specialist (Venture Lab KPI stewardship) or a Human Domain one (Founder Coach, Network
Navigator) depending on what they actually need in the moment.

### 7.3 Agent-first roster (the original eight — distinct from PRD-FDC-001's own agent set)

The operator's original text names eight specialist agents for the Founders Club. This is the
**original roster this amendment is recording** — a separate concern from whatever
awareness-domain agent set the companion Founders Club PRD may define in its own Addendum-B; this
document does not assume the two rosters are identical and flags them as potentially two views of
the same territory that the operator should reconcile before ratification.

| Agent | Function |
|---|---|
| Community Concierge | First point of contact; orients members into the Club |
| Opportunity Scout | Surfaces relevant opportunities to members |
| Network Navigator | Helps members find and reach the right people in the network |
| Founder Coach | Mentoring / guidance on the founder's own journey |
| Event Curator | Surfaces and curates relevant events |
| Circle Facilitator | Facilitates peer groups / cohort circles |
| Recognition Steward | Surfaces and administers recognition of member achievement |
| Introduction Broker | Brokers introductions between members |

**Human involvement boundary (explicit, per operator framing):** human administrators focus
**only** on governance, moderation, partnerships, and exceptional cases. Routine
connection/collaboration/opportunity/recognition/mentoring work is agent-first by design — this is
the load-bearing design decision for Founders Club's operating model, not an incidental detail.

### 7.4 Constitutional Awareness — two responsibilities per agent

Each Founders Club agent (§7.3) carries two responsibilities, not one:

1. **Deliver Value** — perform its specialist function (e.g. the Opportunity Scout surfaces
   opportunities; the Event Curator surfaces events).
2. **Improve Awareness** — continuously improve its own understanding of its domain. Examples:
   discovering new opportunities, expanding event coverage, improving ecosystem knowledge,
   strengthening the relationship graph, identifying missing expertise, enriching community
   intelligence.

Framed together, this is agents **continuously improving institutional intelligence** — the
Founders Club is not a static directory served by agents, but a system whose own knowledge of its
domain compounds over time as each agent's second responsibility accrues.

### 7.5 UX philosophy — one governing question

The operator's framing anchors the entire Founders Club UX on a single governing question every
agent interaction should answer:

> **"What is the most valuable thing I can do for this founder right now?"**

The core principles that follow from that question (operator's own list): reduce cognitive load,
reduce administrative burden, proactive recommendations, conversational interactions, progressive
disclosure, calm computing, invisible administration, contextual intelligence.

These principles are read as instances of the governing question, not a separate checklist:
"reduce cognitive load" and "invisible administration" are both ways of asking what's most valuable
*without burdening the founder to ask for it*; "proactive recommendations" and "contextual
intelligence" are both ways of *acting* on the answer before the founder has to request it.

### 7.6 Convergence with the companion PRD

The canonical Founder Office definition in §4 is written to be reusable, verbatim, by
PRD-FDC-001, so both documents converge on one Founder Office definition rather than two competing
ones. If PRD-FDC-001 requires a different framing for the definition, the diagram, the Founders
Club responsibilities, or the agent roster in §7.1–§7.5, that divergence should be reconciled by
the operator before either document is ratified — not silently by either authoring agent.

---

## §8 Open questions — resolved by the operator (2026-07-22, second round)

All six items below were raised as open in this document's first draft and have now been
answered directly by the operator. Each item keeps its original question for the audit
trail, with the resolution recorded immediately under it.

1. **Is Safeguard (role: Protector) a superset of `citizen`'s governance-participation sense, or a wholly new,
   disjoint capability domain?**
   **Resolved: a superset, not a new domain.** Action Modes are orchestration modes, not
   entitlement domains (§2.0.1). Safeguard mode orchestrates the Runtime toward the
   existing Legal, Civic, Identity, Compliance, Governance, Privacy, IP, Risk, and
   Financial-safeguarding domains — it does not stand up a new one. **Consequence: no
   new SKU, no new entitlement model.** Safeguard reuses whatever services already exist
   underneath those domains; it is a view over them, not a capability of its own.
2. **Should Standing-domain lensing (`ARCHETYPE_DOMAINS`/`pathwayTags`) become mode-aware, or
   remain archetype-only?**
   **Resolved: no — not yet.** Standing remains tied to constitutional activity and
   archetype/domain, and stays durable; Action Modes are ephemeral (a single afternoon in
   Research mode must not create a new standing dimension). Operative statement, quoted
   for reuse verbatim in any future implementation spec: **"Standing remains
   constitutionally derived from verified contribution. Action Modes may become a
   reporting or visualization layer in the future but shall not alter standing
   computation in Phase 1."** `ARCHETYPE_DOMAINS`, `ARCHETYPE_PATHWAYS`, and
   `computeStandingScore()` need zero changes under this amendment.
3. **What is the actual data shape for `activeActionModes`?**
   **Resolved: session/runtime context state, not permanent profile data — see the
   corrected §6.1/§6.2 above.** Not over-engineered: an array (e.g. `activeActionModes:
   ['Build', 'Research']`) stored alongside the persona's active Experience/runtime
   session state, not identity, not access control, not a new DB column modeled on
   `research_tier`. Future historical analytics, if ever built (Phase 3), is event
   telemetry over mode-change events, not a profile field.
4. **Does the NBE reranking algorithm need to change to consume a mode-set instead of a scalar
   archetype, and if so, what is the fallback/precedence rule when multiple modes are active
   simultaneously?**
   **Resolved: not initially.** NBE reranking keeps using archetype, venture context,
   Standing, Experience Guide, and constitutional context as its primary signals — see
   the corrected §5. Active Action Modes become one additional **weighting signal**:
   recommendations matching the active mode-set are weighted up, everything else
   slightly down. This is a re-weighting of the existing ranking, not a new or
   replacement ranking algorithm, and there is consequently no "fallback/precedence
   rule" to design for Phase 1 — multiple active modes simply each contribute their own
   weighting boost, additively, with no precedence ordering required between them.
5. **Should the `ExperienceModelSetupWizard`'s archetype radio-group be replaced, supplemented, or
   left alone in the UI**, once action modes exist?
   **Resolved: keep the archetype picker, but move it behind the scenes.** The
   founder-facing UX becomes "What do you want to do today?" (Action Mode selection).
   The Runtime still resolves founder archetype, venture type, billing, tier,
   entitlements, and constitutional profile — those become **implementation details**
   the founder no longer has to navigate directly, not capabilities that are removed.
   Operative framing: **"Archetype becomes constitutional metadata. Action Mode becomes
   the UX."** — the classic separation between implementation and experience. `
   OPERATOR_ARCHETYPES`, `ARCHETYPE_DEFAULT_TYPE`, and `selectArchetype()` all keep
   working exactly as today; the wizard's archetype step is de-emphasized in the UI
   layer, not deleted or functionally altered.
6. **Timeline / phase sequencing relative to PRD-FDC-001**
   **Resolved — three phases, operator's own sequencing:**
   - **Phase 1.** Implement Action Modes purely as UX + Runtime orchestration
     (weighting signal, §5). **No changes to** Standing, Billing, Archetypes,
     Entitlements, or the Research SKU. In the operator's words: "New front-end.
     Existing back-end."
   - **Phase 2.** Introduce Founders Club, Community Concierge, and Concierge UX
     (PRD-FDC-001), built using Action Modes as the intent layer.
   - **Phase 3.** If the data proves valuable: mode analytics, mode history,
     mode-aware reporting, adaptive onboarding, mode-aware recommendations. **Still no
     impact on standing computation unless a future constitutional decision explicitly
     calls for it** — Phase 3 does not implicitly reopen item 2's resolution.

**The governing statement (operator, 2026-07-22 — treat as this document's primary
architectural clarification, quoted in full in the Revision note 2 above and repeated
here as the item every future implementation of this amendment should be checked
against):**

> "Action Modes are an orchestration layer, not a replacement for the constitutional
> model. They do not replace archetypes, standing, entitlements, billing, or
> constitutional domains. They provide an intent-first interaction model that allows
> the Runtime to dynamically compose existing constitutional capabilities around what
> the founder is trying to accomplish right now."

With all six items resolved, the remaining open work is **implementation planning**, not
further architectural decision-making — a follow-on implementation plan (its own
phase/PRD numbering, per the last unchecked item in §9) is the next artifact, not a
further amendment to this one.

---

## §9 Ratification record

**Status: PROPOSED. Only the first item below is ratified (2026-07-22, this revision); all other
items remain open. This section exists to make ratification an explicit, auditable act, one item at
a time — not to record a blanket ratification that has not happened.**

- [x] **Operator has ratified the mode-naming convention and the Role layer (§2.0, 2026-07-22):**
      the five modes are named as bare words — Build, Create, Develop, Research, Safeguard — not
      `"I ___"`; the onboarding conversation elicits intent via "What do you want to do?" → "I want
      to build" / "I want to create" / etc.; and each mode has an associated Role a citizen occupies
      while acting in it — Builder, Creator, Developer, Researcher, and (operator-named) **Protector**
      for Safeguard. Citizen remains the default base identity, not a peer of the five modes.
- [x] **Operator has ratified the governing architectural statement (§8, 2026-07-22):**
      "Action Modes are an orchestration layer, not a replacement for the constitutional
      model... Archetypes describe enduring constitutional characteristics. Action Modes
      describe temporary constitutional intent." Every item below is read through this
      statement.
- [x] Operator has reviewed and ratified the five Constitutional Action Mode definitions (§2)
- [x] Operator has ratified the Build vs Develop distinction as drafted (§2.3)
- [x] **Operator has ratified the scope of Safeguard / Protector (§2.5, §8.1):** a
      superset of `citizen`, not a new capability domain — no new SKU, no new
      entitlement model.
- [x] Operator has ratified the archetype ↔ mode mapping table (§3)
- [x] Operator has ratified the canonical Founder Office definition (§4) as the text reused across
      documentation, onboarding flows, agent responses, and platform messaging (confirmed 2026-07-22,
      third round — the one item left open after the second round is now explicitly ratified).
- [x] **Operator has ratified the corrected, weighting-signal-only Runtime activation
      model (§5, §8.4):** NBE reranking is not restructured; Action Modes are an
      additional weighting signal over the existing archetype/venture/standing/
      Experience-Guide ranking, not a replacement axis.
- [x] **Operator has ratified the corrected backward-compatibility / migration mechanism
      (§6, §8.3):** `activeActionModes` is session/runtime context state, not permanent
      profile data — no new DB column, no schema migration, Standing/Billing/
      Archetypes/Entitlements/Research-SKU untouched in Phase 1.
- [x] **Operator has reconciled the §7.3 agent-first roster** against PRD-FDC-001's roster
      (`codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md` §4.2–4.4) — the two
      rosters are confirmed to be the same territory, not divergent views; PRD-FDC-001 is the
      canonical, fully-reconciled roster (13 agent-functions, including Marketa as the reused
      Market Intelligence owner) and this amendment's §7.3 list is a subset recording, not a
      competing one.
- [x] **Operator has resolved all six open questions in §8** (Safeguard scope, Standing
      mode-awareness, `activeActionModes` data shape, NBE reranking, the setup wizard's
      fate, and the three-phase sequencing) sufficiently to authorize a Phase 1 build —
      Phase 1 scope is: new front-end (Action Mode UX), existing back-end (zero changes
      to Standing/Billing/Archetypes/Entitlements/Research SKU).
- [x] **Operator has confirmed a follow-on implementation plan (its own phase/PRD numbering) is
      the correct next step** — not yet chartered (no such document exists yet); this is
      agreement on the path, not a claim the plan already exists.
- [x] **This document has been cross-referenced from `codexes/packs/polity-core/items/
      AMENDMENT_RECORDS.md`** as a *proposal under consideration* (status `operator_ratified_prd`,
      under the "Drafts / Work-in-progress (NOT ratified)" table — NOT ratified as a *charter
      amendment*, per the operator's explicit governance-home resolution that the Charter itself
      stays unamended). Done 2026-07-22 at the operator's explicit instruction ("Yes").

Until every box above is checked by the operator, this document has no effect on the ratified
Founder Office Charter, the live `OperatorArchetype` system, or any production code path.
