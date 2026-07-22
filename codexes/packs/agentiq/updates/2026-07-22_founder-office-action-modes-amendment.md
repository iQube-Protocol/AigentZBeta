# Architectural Amendment — Founder Office Action Modes & Founders Club Integration

**Date:** 2026-07-22
**Branch:** `claude/agentiq-onboarding-docs-jrbeha`

> **Status: PROPOSED — architectural amendment, not yet ratified.** Companion to
> PRD-FDC-001 (Founders Club), authored separately. This document does not modify
> ratified charter text; it proposes a direction for a future, explicitly-ratified
> change. Nothing in this document authorizes code changes on its own — it is the
> input to a decision, not the decision.

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

## §5 Runtime behavior changes — multi-mode simultaneous activation

**Current behavior:** the Runtime (NBE reranking, Experience Guide flows, capability surfacing)
reads a single, nullable `operatorArchetype` value per persona and biases toward
archetype-appropriate moves. One value, one bias vector, set at onboarding and rarely revisited.

**Proposed behavior:** the Runtime activates capabilities per the **set of currently active
modes** for the persona, not per a single fixed identity value.

- A persona could hold `{ 'Build', 'Safeguard' }` simultaneously — e.g. building a product
  while also serving a governance/review role — and the Runtime would surface capabilities and
  NBEs relevant to *both* concurrently, rather than forcing a choice.
- Modes are proposed as **dynamic and non-permanent**: a persona's active-mode set can change
  session-to-session, or even within a session, as their current work shifts — in contrast to
  archetype, which today changes only when the operator re-runs
  `ExperienceModelSetupWizard`'s single-select picker.
- This does not by itself specify a new NBE reranking algorithm — it specifies the *shape* of the
  signal (a set, not a scalar) that a future reranking pass would read. The actual reranking logic
  change is out of scope for this document (see §8).

**Concrete illustration.** A founder might be in Research mode in the morning, Develop mode in the
afternoon, and Safeguard mode in the evening — and multiple modes may be active simultaneously (a
founder could be in Build and Safeguard at once, e.g. closing a partnership while also reviewing a
contract). The Runtime activates whichever specialist capabilities fit the current task, reading
the active mode-set rather than a single fixed archetype value.

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
- A new, separate dimension — tentatively `activeActionModes: ConstitutionalActionMode[]` — would
  be added *alongside* `operatorArchetype` on the `ExperienceQubeMeta` (or a sibling structure),
  not substituted for it.
- Archetype becomes the **default/derived mode-set seed**: on first exposure to the new dimension,
  a persona's existing `operatorArchetype` value maps via §3's table to an initial
  `activeActionModes` value (e.g. `entrepreneurial → ['Build']`, `technical → ['Develop']`),
  giving every existing persona a sensible non-empty starting mode-set with zero manual migration
  step required of the operator. The persona can then freely add/remove modes from that seed.

### 6.2 Concrete migration/coexistence mechanism (proposed, not yet built)

1. **Additive DB column, not a schema rewrite.** A new nullable column (or a JSON array column)
   alongside `operator_archetype` on the `experience_qubes` table — mirroring exactly the pattern
   already used for `research_tier` in the 2026-07-16 precedent (`supabase/migrations/
   20260716010000_persona_plans_research_tier.sql`: a new column coexisting with existing ones,
   CHECK-constrained, additive-only). A parallel migration for action modes would follow the same
   shape: add, don't alter or drop.
2. **Archetype-to-default-mode mapping table.** §3's mapping table, expressed as code (e.g. a
   `Record<OperatorArchetype, ConstitutionalActionMode[]>` sitting next to `ARCHETYPE_DOMAINS` in
   `standingScore.ts` or as its own module) is the single source of truth for the default seed —
   never hand-duplicated at each read site, per CLAUDE.md's source-of-truth-parity discipline
   (`inv.engineering.036/037`).
3. **Dual-read period.** During transition, any Runtime consumer reading action-mode state would
   fall back to the archetype-derived default when no explicit `activeActionModes` value has been
   set — i.e. read-through, not a hard cutover. This mirrors the existing pattern where
   `upsertExperienceQube()` already falls back to `existing?.meta.operatorArchetype ?? null` when
   an input field is undefined.
4. **No forced re-onboarding.** Existing personas are never required to re-run a wizard step to
   remain functional — the derived default keeps them fully served until/unless they choose to
   customize their active modes.

### 6.3 File-by-file impact — what changes vs what stays additive-only

| File | Change under this proposal | Stays as-is |
|---|---|---|
| `services/iqube/experienceQube.ts` | ADD a new field/type for action modes alongside `OperatorArchetype`; ADD a migration path for the seed default | `OperatorArchetype` union, `VALID_ARCHETYPES`, `operator_archetype` column, all existing read/write functions unchanged |
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

## §8 Open questions / operator decisions needed

This amendment surfaces the following decisions for explicit operator ratification; none are
resolved by this document:

1. **Is Safeguard (role: Protector) a superset of `citizen`'s governance-participation sense, or a wholly new,
   disjoint capability domain?** §2.5 flags this as unresolved. The answer materially affects
   whether Safeguard needs its own billing/entitlement machinery (like `researcher`'s dedicated
   SKU) or rides on existing citizen-tier access.
2. **Should Standing-domain lensing (`ARCHETYPE_DOMAINS`/`pathwayTags`) become mode-aware, or
   remain archetype-only?** §6.3 flags this as optional/open. A mode-aware Standing lens would let
   a persona see "how much of my verified standing is Build-mode work" distinct from "how much is
   Develop-mode work" even when both trace back to the same `entrepreneurial` archetype seed — but
   this is a nontrivial extension to `computeStandingScore()`'s domain-weighting logic and was not
   scoped as required by the operator's brief.
3. **What is the actual data shape for `activeActionModes`?** A simple array on
   `ExperienceQubeMeta`, a new sibling table (mirroring how `personalGuide` lives inside
   `ExperienceQubeBlak` today), or something else — not decided here; a decision for whoever builds
   Phase 1 of this amendment, informed by whether mode state needs to be T0/T1/T2-tiered under the
   Identity & Access Spine rules.
4. **Does the NBE reranking algorithm need to change to consume a mode-set instead of a scalar
   archetype, and if so, what is the fallback/precedence rule when multiple modes are active
   simultaneously?** §5 explicitly defers this; it is a nontrivial algorithmic question, not a data
   modeling one, and this document does not propose an answer.
5. **Should the `ExperienceModelSetupWizard`'s archetype radio-group be replaced, supplemented, or
   left alone in the UI**, once action modes exist? §6.3 proposes "ADD a mode-select UI... as a new
   step or an additional field," but does not resolve whether the archetype picker should then be
   demoted to an advanced/optional setting, since it remains the seed source for the mode default
   and (per §0.2) the direct input to Standing pathway tags and the researcher billing SKU.
6. **Timeline / phase sequencing relative to PRD-FDC-001** — since that document is being authored
   concurrently and its content is unknown to this document (§7), sequencing is an operator call
   once both documents exist.

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
- [ ] Operator has reviewed and ratified the five Constitutional Action Mode definitions (§2)
- [ ] Operator has ratified the Build vs Develop distinction as drafted (§2.3)
- [ ] Operator has ratified (or amended) the scope of Safeguard / Protector (§2.5, §8.1)
- [ ] Operator has ratified the archetype ↔ mode mapping table (§3)
- [ ] Operator has ratified the canonical Founder Office definition (§4) as the text reused across
      documentation, onboarding flows, agent responses, and platform messaging
- [ ] Operator has ratified the multi-mode Runtime activation model (§5)
- [ ] Operator has ratified the backward-compatibility / migration mechanism (§6)
- [ ] Operator has reconciled the §7.3 agent-first roster (Community Concierge, Opportunity Scout,
      Network Navigator, Founder Coach, Event Curator, Circle Facilitator, Recognition Steward,
      Introduction Broker) against whatever agent set PRD-FDC-001 defines, if the two diverge
- [ ] Operator has resolved the open questions in §8 sufficiently to authorize a build phase
- [ ] A follow-on implementation plan (with its own phase/PRD numbering) has been chartered
- [ ] This document has been cross-referenced from `codexes/packs/polity-core/items/
      AMENDMENT_RECORDS.md` as a *proposal under consideration* (not as a ratified amendment) — a
      step this document does not itself take, per the task boundary that this proposal must not
      modify `AMENDMENT_RECORDS.md`

Until every box above is checked by the operator, this document has no effect on the ratified
Founder Office Charter, the live `OperatorArchetype` system, or any production code path.
