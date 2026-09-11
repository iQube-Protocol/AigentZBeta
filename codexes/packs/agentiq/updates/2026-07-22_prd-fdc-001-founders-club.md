# PRD-FDC-001 — Founders Club: The Human Institution of the Founder Office

**metaMe IRL / iQube Protocol · Product/social-architecture specification · Status: RATIFIED (2026-07-22) — architecture settled, awaiting a follow-on implementation plan**
**Owner:** Founder Office stewards (Venture Lab α workstream) · **Origin:** operator design session, 2026-07-22, reconciled against the ratified Founder Office / Standing / metaCommons charters and the built VentureQube/SmartTriad substrate
**Governs:** the social/relational (Human Domain) layer of the Founder Office — the parallel counterpart to the Founder Office's already-charter capability-discovery/opportunity-intelligence/venture-formation (Operational Domain) work. **It builds nothing.** It specifies a now-ratified architecture; a follow-on implementation plan (§13) is the next artifact before Phase 1 code work begins, in the same docs-first, reconciliation-first pattern as PRD-EPI-001, PRD-ICA-001, PRD-PAG-001, and PRD-MMC-001.

> **Positioning note (binding, this PRD):** Founders Club sits **WITHIN** the Founder Office, not above it and not beside it. It is not a fifth workstream, not a new charter, and not an independently-acquired membership product. The canonical structure (operator, 2026-07-22 — shared verbatim with the companion `2026-07-22_founder-office-action-modes-amendment.md`):
>
> ```
> Polity Passport
>   ↓
> Founder Journey
>   ↓
> Founder Office
> ├── Operational Domain
> └── Human Domain
>   └── Founders Club
> ```
>
> One institution, two domains, one Founder Office Charter governing both. Founders Club membership derives from participation in the Founder Office — never an independently-acquired membership.

---

## 0. Read this first — reconciliation against what's already built/ratified

This section verifies, by reading the actual files, what already exists before proposing anything new. Per `inv.engineering.036`/`inv.engineering.037` (status: **`proposed`**, not yet `canonical` — cited accurately here, not overclaimed as ratified doctrine; see CLAUDE.md "Source-of-truth parity is canary-enforced" for the operator's standing enforcement expectation regardless of the invariant's seed status), a parallel implementation of an existing capability is a defect. Founders Club must extend, not fork.

### 0.1 The Founder Office Charter — read in full, cited directly

`codexes/packs/polity-core/items/FOUNDER_OFFICE_CHARTER.md` (v1.0.0, ratified 2026-06-17) states, verbatim:

> "The Founder Office Charter is a **sub-charter within the metaCommons**... It sits **under** the metaCommons Charter and is calibrated by the Standing Charter."

> "Founder Office is not primarily a software suite. Founder Office is a **capability discovery and opportunity intelligence service** powered by the metaCommons."

> Founder Office Responsibilities: "Surface meaningful opportunities. Reduce discovery costs. Reduce coordination costs. Reduce time-to-value. Increase the probability of successful venture formation. Increase the probability of useful capability deployment."

Nowhere does the charter mention a social/human/community layer by name — it is entirely stated in terms of signals, discovery, and opportunity. **This is the gap Founders Club fills**, not a new institution: the charter's responsibilities ("reduce coordination costs," "increase the probability of successful venture formation") are demonstrably social/relational as well as computational — founders reduce coordination costs partly by knowing and trusting the right people, not only by receiving the right signal. Founders Club is the charter's human-relational responsibilities, made explicit and given a dedicated agent family. It does not add a new responsibility to the charter; it **operationalizes responsibilities the charter already states** in the domain (human relationship, trust, introduction, community) the charter's Operational Domain build did not yet cover.

**Canonical Founder Office definition (operator, 2026-07-22 — quoted verbatim, word-for-word identical to the companion `2026-07-22_founder-office-action-modes-amendment.md`, which cites this same text):**

> "The Founder Office is the constitutional operating environment for people building meaningful ventures. It combines intelligent agents, trusted services, financial infrastructure, governance, and community into a single workspace that helps founders transform ideas into enduring enterprises while progressing on their own journey toward sovereignty."

**Honesty note:** this exact sentence is not present verbatim in the ratified `FOUNDER_OFFICE_CHARTER.md` text read in full above (confirmed by direct search — no match for "constitutional operating environment" in that file). It is the operator's newer, authoritative restatement of Founder Office's purpose, supplied 2026-07-22 for this PRD and its sibling amendment, and is treated here as the operative definition going forward — consistent with, not contradicting, the ratified charter's Purpose/First Principle/Responsibilities sections quoted above. **Governance home — resolved (operator, 2026-07-22): the Charter is not amended.** The Charter stays stable; this PRD (and the sibling amendment) derive their authority from it, the same way legislation derives authority from a constitution without the constitution itself being rewritten every time a new ministry is created: `Founder Office Charter → Founder Office PRDs → Founders Club PRD → Implementation`. See §11 for the resolution recorded in full.

### 0.2 The metaCommons and Standing Charters — the layers Founders Club composes, never forks

- `METACOMMONS_CHARTER.md` (ratified 2026-06-17): "The metaCommons is the second institution of the Polity... The Commons is a **field**... generated from the interaction of sovereign assets and sovereign activity." Founder Office consumes Commons Signals (Intent/Demand/Capability/Opportunity/Standing signals, Proof of Work Potential) and turns them into opportunities. Founders Club consumes the same Commons substrate for its relational signals — it does not stand up a second Commons.
- `STANDING_CHARTER.md` (ratified 2026-06-17): "Standing is not reputation. Standing is not popularity. Standing is not status. Standing is not social ranking... Standing is a measure of confidence that a declaration accurately reflects reality." This is the load-bearing constraint on §5 below: Founders Club trust/introductions must never become a popularity or social-ranking system riding alongside Standing — they must compose the same veracity-confidence model.

### 0.3 The SmartTriad copilot "one face, many capabilities" pattern — reused, not re-invented

`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx` (1,528 lines, read in full for this PRD) implements the existing single-agent-face pattern this PRD's Community Concierge must mirror: one named `agent` (`agentName`/`agentId`/`agentSubtitle`) renders as the visible header of the copilot panel, with `renderDots` (the canonical R/T scoring-dots primitive documented in CLAUDE.md) showing live reliability/trust, and specialist routing happening **behind** that one face — never as a second visible agent competing for the founder's attention. This is exactly the shape of "Community Concierge is the single visible face/orchestrator; specialist agents work behind it" (§2 below). **Founders Club does not invent a second parallel copilot pattern** — the Community Concierge is a Founders-Club-scoped instance of the same `SmartTriadCopilotLayer` shape, with its own `agent` identity and specialist roster, composed the same way `ask-specialists`/`SpecialistsLayout` already routes aigentMe's specialists (CLAUDE.md "aigentMe Capsule ↔ Layout Contract").

### 0.4 The OperatorArchetype enum — Portfolio Operator does not fork it

`services/iqube/experienceQube.ts` (read in full for this PRD) defines:

```ts
export type OperatorArchetype = 'citizen' | 'entrepreneurial' | 'technical' | 'creative' | 'research';
```

This is a **platform-wide, single-valued** archetype per persona — it "feeds NBE reranking so aigentMe biases toward archetype-appropriate moves" (the file's own comment). It is not scoped to any one cartridge or club. **Decision (justified below, §6):** Portfolio Operator is **not** a sixth `OperatorArchetype` value. It is a **Founders-Club-scoped role tag**, layered on top of whichever archetype a persona already declares (in practice, closest to `entrepreneurial`, per `services/standing/standingScore.ts`'s own `ARCHETYPE_DOMAINS` mapping of `entrepreneurial → ['founder', 'professional', 'validation', 'recognition']` — capital deployment quality is a `founder`/`validation`-domain activity, not a new domain). Adding a platform-wide archetype value for a role that only exists inside one Club would be exactly the "silently fork the enum" pattern `inv.engineering.036`/`037` warns against; a Club-scoped role composes the existing single-archetype-plus-domain-tags model instead (mirrors the existing "pathway filter tag over one unified score" design already used for Standing itself, §0.5).

### 0.5 Standing and the verification-accrual gate — reused, not reinvented

`services/standing/standingScore.ts` (read in full for this PRD) computes ONE unified Standing score (0–100) from veracity (verified VSP facts) + contribution (reputation accrual), and offers **archetype-pathway filter tags** (`ArchetypePathwayTag`) as a read-only lens over that single score — "the unified Standing score is NOT split per archetype; these are filter tags." This is the exact composition pattern Founders Club's Portfolio Operator role must follow (§0.4): a filter/role tag over the one Standing score, never a second scoring system.

The verification-accrual gate is `inv.polity.162` (namespace `polity`, status `canonical`), cited verbatim from `codexes/packs/irl/foundation/canonical-invariants.seed.json:2462-2475`:

> "The verification-accrual gate: a self-declared outcome or value claim accrues NOTHING to Standing until it is verified — verification is the accrual gate. Assertion without verification accrues nothing ('verified over claimed')."

**Consequence for Founders Club (§5):** an introduction, vouch, or endorsement inside the Club is a **self-declared claim** until something verifies it (the introduced party actually engaging, a deal actually closing, an outcome actually landing per Proof of Work Potential / Proof of Time Saved). Until verified, it accrues nothing to Standing — Founders Club must not let raw vouch-count or introduction-count function as an unverified shadow-reputation system. This is the same discipline the Standing Charter states directly: "Standing is not popularity."

### 0.6 The Invariant Resolution Engine family — the actual filenames, not the working PRD numbers

The operator's brief refers to "PRD-IRE-001," "PRD-KRE-001," "PRD-IPE-001," "PRD-CFO-001," "PRD-CCR-001." `find codexes/packs -iname "PRD-IRE*"` etc. returns nothing under those literal filenames — confirmed by direct search. The actual ratified-spec filings live under the IRL `CFS-nnn` convention and **carry** those PRD designations in their own headers:

| Operator's PRD name | Actual file | Status (as of this read) |
|---|---|---|
| PRD-IRE-001 | `codexes/packs/irl/foundation/CFS-037_invariant-resolution-engine.md` | Architectural Foundation — DRAFT, awaiting operator ratification (2026-07-17) |
| PRD-IPE-001 | `codexes/packs/irl/foundation/CFS-039_invariant-projection-engine.md` (the renamed CFS-035) | named in CFS-037 §9, future spec |
| PRD-CFO-001 | `codexes/packs/irl/foundation/CFS-041_constitutional-field-observatory.md` | Architectural Foundation — DRAFT (2026-07-17) |
| PRD-CCR-001 | `codexes/packs/irl/foundation/CFS-038_constitutional-coordinates-registry.md` | named in CFS-037 §9 |
| PRD-KRE-001 | `codexes/packs/irl/foundation/CFS-040_knowledge-resolution-engine.md` | named in CFS-037 §9 |

CFS-037 (the IRE spec) is the load-bearing reconciliation anchor for §4 below. It states its own architecture precisely: `Intent → IRE (resolve field) → KRE (reuse/compose/create) → IPE (project) → Reasoning (last resort)`, and defines **Constitutional Coordinates** — Structural (Complexity, Evidence Density, Uncertainty, Sensitivity, Risk, Scope, Verifiability), Constitutional (Authority, Standing, Delegability, Consent, Accountability, Sovereignty, Identity Protection, Trust, Personhood Impact), Operational (Time-to-Value, Repair Cost, Reuse Potential, Automation Potential, Knowledge Coverage) — as the shared geometry every matching/navigation decision in the platform should use. **Founders Club matching (§4) is a consumer of this geometry, not a new one.** CFS-037 itself is honest that "nothing here is built... §2 is code-witnessed; §3–12 are proposed" — so Founders Club matching inherits the same honesty: it is specified against a **proposed** (not yet ratified or built) engine, and this PRD must not overclaim IRE's build status.

### 0.7 The Constitutional Field / Observatory infrastructure — what the Awareness Graph should (and should not) reuse

`CFS-041` (the Observatory) documents the existing `FieldSnapshot` object (`services/invariants/engine.ts`), the Observatory API (`app/api/invariants/observatory/route.ts`), `FieldView.tsx` (5 existing perspectives: Node · Field · Graph · Projection · Health), and the persisted `invariant_shadow_observations` table. This is the "Field/Observatory machinery" the operator's brief asks to be reconciled against for the Constitutional Awareness Graph (§7). **Decision (justified in §7):** the Constitutional Awareness Graph is a **Founders-Club-scoped instance of the Resolved Constitutional Field / Observatory pattern**, not a seventh parallel graph implementation — same reasoning as §0.4/§0.6: extend the existing field-and-coordinate machinery into a new domain, don't build a new machine.

### 0.8 VentureQube / Founder Office Operational Domain — what already ships, so Founders Club doesn't duplicate it

`app/triad/components/codex/tabs/FounderOfficeTab.tsx` (896 lines, read for this PRD) is the live Founder Office surface inside the Venture Lab α cartridge: sub-views **Workspace · Discover · Validate · Architect · Blueprint**, backed by `services/venture/ventureQubeService.ts`, `venturePortfolio.ts`, `standingForVenture.ts`, `metacommonsSignals.ts`, and the commercial spine documented in `codexes/packs/agentiq/updates/2026-06-21_founder-office-ventureqube.md` — **Passport → Standing → aigentMe → Founder Office → Venture Lab**, with pricing tiers Founder Office Basic $99 / Professional $299 / Elite $999+. This is the **Operational Domain** in full: it already discovers, validates, architects ventures, and already carries a Standing-gated commercial tier. Founders Club membership (§3) is **derived from participation in this existing Operational Domain flow** — a founder is not "in the Club" by paying a separate Club fee; Club standing is a read of the same VentureQube/Standing signals this tab already produces, surfaced through a dedicated Human Domain sub-view alongside Workspace/Discover/Validate/Architect/Blueprint (an "Community" sub-view, noted as an open question in §11 since adding it is a code change out of scope for this docs-only PRD).

### 0.9 Summary of what this PRD is allowed to propose as genuinely new

Given §§0.1–0.8, the genuinely new surface area is: (a) the Community Concierge + specialist agent roster as a **Founders-Club-scoped instance** of the existing copilot pattern; (b) the Portfolio Operator **role tag** (not archetype); (c) the Constitutional Awareness Graph as a **Founders-Club-scoped Resolved Field/Observatory instance**; (d) the Community Intelligence Engine, reconciled explicitly against CFS-037/IRE in §8; (e) the 14 UX principles as a dedicated design contract; (f) the phased, digital-first rollout. Nothing here proposes a new charter, a new Standing model, a new archetype enum value, or a parallel field/graph engine.

---

## 1. Purpose

Founders Club exists so that Founder Office's Operational Domain (capability discovery, opportunity intelligence, venture formation) has a Human Domain counterpart: the social and relational substrate through which founders actually find, trust, and help each other — because "reduce coordination costs" and "increase the probability of successful venture formation" (the charter's own responsibilities, §0.1) are not purely computational problems. Founders Club is how the Founder Office keeps its human side as constitutionally rigorous as its opportunity-intelligence side: matching is explainable, trust is verification-gated, and membership is earned through the same participation the Operational Domain already measures — never a separate social product bolted alongside it.

## 2. Positioning — within the Founder Office, not above or beside it

**Answer (operator-affirmed): WITHIN.**

```
metaCommons (institution, ratified)
   └── Founder Office (sub-charter, ratified)
        │
        │   Polity Passport → Founder Journey → Founder Office
        │
        ├── Operational Domain  — EXISTS: FounderOfficeTab (Workspace ·
        │                          Discover · Validate · Architect · Blueprint),
        │                          VentureQube, the commercial spine.
        │                          Owns operational execution.
        └── Human Domain        — THIS PRD
             └── Founders Club  — connection, collaboration, opportunity,
                                   wellbeing, recognition, community, mentoring
```

This is the canonical structure (operator, 2026-07-22): a founder's path runs **Polity Passport → Founder Journey → Founder Office**, and inside the Founder Office, the **Operational Domain** (owns operational execution — discovery, validation, architecture, blueprinting) and the **Human Domain** (Founders Club) run in parallel, with Founders Club's seven responsibilities being **connection, collaboration, opportunity, wellbeing, recognition, community, and mentoring** — the social-relational counterpart to the Operational Domain's execution responsibilities, never a duplicate or a superset of them.

Founders Club membership is **derived from Founder Office participation** — it is not an independently-acquired membership. A persona's Club presence, standing, and access follow directly from their existing Founder Office / VentureQube / Standing signals (§0.8); there is no separate "join Founders Club" transaction, fee, or gate distinct from participating in the Founder Office itself. This is the direct implication of "within, not beside": a sibling social product would need its own membership mechanic; a domain of the same institution inherits the institution's existing membership mechanic.

### 2.1 UI placement (operator-ratified, 2026-07-22)

**Decision: yes, add a new primary section within the Founder Office UI** — not a "Community" sub-view folded in alongside Workspace/Discover/Validate/Architect/Blueprint as §0.8/§11 originally floated, but a **second primary section, coordinate with the Operational Domain**, named **"Founders Club"**:

```
Founder Office

Operational Domain
· Workspace · Discover · Validate · Architect · Blueprint

Human Domain
· Founders Club
```

**Explicitly not named "Community."** The operator's own reasoning: "Community sounds like a feature. Founders Club is an institution. Community is something it contains." (Community is in fact one of the Club's own internal sub-bodies, §2.2 below — naming the whole section after one of its parts would be a category error.) This corrects §0.8/§11's original "Community sub-view" framing — still a code change out of scope for this docs-only PRD, but the *name* and *placement* (a coordinate primary section, not a folded-in sub-view of the Operational Domain's existing five) are now settled for whoever builds it.

### 2.2 Founder Office as an institutional framework (operator's architectural reframing, 2026-07-22)

**This is a deliberate elevation of altitude, not a rename of anything already ratified.** Founder Office is not merely an operating system with modules — it is becoming the **constitutional home for durable institutions**, each composed of autonomous agents, constitutional governance, and shared services. The operator's own structure:

```
Founder Office

├── Operational Institutions
│     ├── Workspace
│     ├── Finance
│     ├── Research
│     └── Development
│     └── Venture Services
│
└── Human Institutions
      └── Founders Club
            ├── Founder Circles
            ├── Mentorship
            ├── Networking
            ├── Wellbeing
            ├── Recognition
            └── Community
```

**Reconciling "Domain" and "Institution" — two altitudes, not two competing terms.** The Operational Domain / Human Domain split (§2, already the ratified positioning) describes a **responsibilities split** — which half of Founder Office a capability's execution belongs to. "Institution" describes a **structural property** — that a domain is (or hosts) a durable, autonomous, agent-composed body with its own governance, not just a feature bag. These compose rather than conflict: **Founders Club is simultaneously the Human Domain (the responsibilities-split framing, §2) and the first Human Institution (the structural framing, this section)** — the same object described from two altitudes, exactly the pattern §4/§0.1's canonical Founder Office definition already uses for "constitutional vs. product" framing of Founder Office itself. This document does not rename "Human Domain" to "Human Institution" throughout, or vice versa — both terms stay in active use, each doing its own descriptive job.

**Founders Club's internal composition, made explicit for the first time:** the operator's diagram gives Founders Club its own sub-bodies — **Founder Circles, Mentorship, Networking, Wellbeing, Recognition, Community** — which map directly onto the agent roster (§4) and its seven responsibilities (§2): Circle Facilitator → Founder Circles; Founder Coach → Mentorship; Network Navigator + Introduction Broker → Networking; Founder Coach (wellbeing check-ins) → Wellbeing; Recognition Steward → Recognition; Community Steward + Event Curator → Community. This is not a second roster — it is the same thirteen agent-functions (§4.4), organized by the sub-body they serve rather than by which awareness domain they own. Both organizing views (agent-by-awareness-domain, §4; agent-by-sub-body, this section) describe the same roster.

**Why this matters beyond naming (operator's own framing, stated as something that should influence how the codebase gets structured):** if Founder Office is a platform for hosting durable institutions rather than a fixed set of features, **Founders Club is not a one-off — it is the first instance of a repeatable pattern.** The operator names plausible future siblings as illustrations, not commitments: *Founders Guild, Research Academy, Venture Exchange, Constitutional Commerce Network, Global Ambassador Programme.* None of these is chartered by this PRD — they are cited only to establish that Founders Club's architecture (an agent-composed, constitutionally-governed, sub-body-structured institution hosted within a Domain of Founder Office) should be built **generally enough that a second institution could be added later without changing Founder Office itself** — i.e. whatever mechanism seats Founders Club under the Human Domain (§2) should not be a one-off special case hard-coded for the Club specifically. This is a design-generality expectation for whoever builds Phase 1 (§10), not new scope for this PRD to specify further — no second institution is being chartered here.

## 3. Operational philosophy — agent-first, not staff-first (load-bearing constraint)

This is a design constraint that governs every capability in this PRD, not a footnote:

> **Agent-first, not staff-first.** The goal is the least amount of administrative burden and the most value-adding service. Every capability defaults to an agent doing the work. Human staff involvement is the exception, requiring explicit justification — never the default.

**The human-involvement boundary (explicit, binding):** human administrators focus **only** on governance, moderation, partnerships, and exceptional cases. Every other function described in this PRD — matching, introductions, coaching, curation, standing narration, event logistics, market/ecosystem tracking, knowledge capture — is agent-owned by default. A human administrator's presence in a workflow that is not governance/moderation/partnerships/exceptional-case is a signal the workflow was designed staff-first and must be redesigned agent-first before it ships.

Concretely, for every capability specified below (agent roster §4, matching §5, standing §6, awareness graph §7, UX §9):

- **Default:** an agent (Community Concierge or a specialist behind it) performs the task end-to-end and reports the outcome.
- **Exception path:** a human staff member is looped in only when (a) the action requires a human judgment the constitutional coordinates cannot resolve (e.g. a genuinely novel legal/ethical edge case), or (b) a founder explicitly requests human contact. **Resolved mechanism (operator, 2026-07-22): every such exception produces a constitutional receipt** — composing the platform's unified receipt writer (CLAUDE.md's Artifact Production section), not a bespoke Founders-Club-only log. Operative principle, stated for reuse verbatim: **"Human intervention is observable."** A receipted exception is also folded into the Constitutional Awareness Graph (§7, Community Awareness) as a derived read, so the agent-handled-vs-staff-handled ratio remains observable there too — but the receipt, not the Graph entry, is the primary, governance-grade record.
- **Anti-pattern to avoid:** designing any workflow that assumes a human community manager triages, curates, or hand-matches by default. If a capability's first draft has a human doing the matching/curating/reporting, the correct fix is to ask "what agent and what constitutional coordinates would let this be agent-first," not to staff it.

## 4. Agent family / roster — reconciled

The operator's own text names an **original 8-agent base roster** and, in Addendum B, **ten named awareness domains** with their owning agents. Five of the ten awareness-domain owners are base-roster agents wearing a second (awareness) hat; five are genuinely new agents introduced by Addendum B; three base-roster agents own no named awareness domain today. This section reconciles all of it into one explicit roster — no agent is left hand-waved, and every overlap is called out rather than silently double-counted.

### 4.1 The single face

**Community Concierge** — the sole visible orchestrator of the Club (§0.3). Founders interact with the Concierge, never directly with a named specialist agent picker; the Concierge routes to specialists behind the scenes, exactly as the existing SmartTriad copilot routes to `ask-specialists` behind one visible chat face. Owns **Founder Awareness** (Addendum B, domain 1).

### 4.2 The original 8-agent base roster (operator's exact list)

**Community Concierge · Opportunity Scout · Network Navigator · Founder Coach · Event Curator · Circle Facilitator · Recognition Steward · Introduction Broker.**

| # | Agent | Base-roster role | Awareness domain owned (Addendum B) | Overlap / reconciliation note |
|---|---|---|---|---|
| 1 | **Community Concierge** | Single face / orchestrator | Founder Awareness | The face itself, not a specialist |
| 2 | **Opportunity Scout** | Surfaces opportunities/matches for a founder from the Commons signal stream | Opportunity Awareness | Same agent, second hat |
| 3 | **Network Navigator** | Manages introduction strategy and relationship-graph traversal | Relationship Awareness | Same agent, second hat |
| 4 | **Founder Coach** | Founder wellbeing / pacing / burnout-risk check-ins | Wellbeing Awareness | Same agent, second hat |
| 5 | **Event Curator** | Curates community events/gatherings (digital-first: AMAs, office hours, roundtables; physical events from Phase 3, §10) | *None of the ten named domains* | No Addendum-B domain owner named; functionally adjacent to Community Steward's Community Awareness. **Resolved, operator 2026-07-22: stays permanently separate from Journey Concierge** — see §4.3b — different responsibilities (Event Curator decides "you should go"; Journey Concierge helps you get there), not a Phase-3 merge candidate. |
| 6 | **Circle Facilitator** | Facilitates founder peer circles / small-group cohorts | *None of the ten named domains* | No Addendum-B domain owner named; functionally adjacent to Community Steward's Community Awareness. Flagged as an open question (§11). |
| 7 | **Recognition Steward** | Surfaces and narrates standing/verification events back to the founder | Standing Awareness | Same agent, second hat |
| 8 | **Introduction Broker** | Executes the specific introductions Network Navigator's strategy identifies (the "make the connection happen" agent, distinct from Navigator's "who should connect" strategy agent) — **leverages the existing Relationship Builder capability** (`RelationshipBuilderTab`, `relationship-builder` tab, Marketa's cartridge — "partner and customer outreach... campaign composer for Marketa email dispatch") rather than building parallel outreach/matching machinery (operator, 2026-07-22) | *None of the ten named domains* | No Addendum-B domain owner named; functionally adjacent to Network Navigator's Relationship Awareness (Broker executes what Navigator plans). Remains a **separate agent** from Marketa (unlike Market Intelligence, §4.3), but consumes Relationship Builder as its outreach-execution substrate. Flagged as an open question (§11). |

### 4.3 The four genuinely new agents + one reused platform agent (Addendum B)

**Reconciliation update (operator, 2026-07-22):** of the five Addendum-B awareness-domain
agents originally proposed, one — **Market Intelligence Agent** — is not a new Founders-Club
agent at all. It is fulfilled by **Marketa** (`aigent-marketa`, the platform's existing
constitutional marketing agent, live today as the `marketa-codex` cartridge copilot), extending
her existing Venture Lab / Founder Office (Build-mode, §2.1 of the companion amendment) role into
the Founders Club's Market Awareness domain, rather than standing up a competing agent for the
same function. **Justification (operator's own reasoning):** an independent Market Intelligence
Agent would either duplicate Marketa's existing market/campaign/partner intelligence or need to
constantly liaise with her to stay non-duplicative and aligned — for consistency, it is better
that Marketa herself owns Market Awareness directly, which also gives her a formal functional
role inside the Founders Club (extending, not duplicating, the functional role she already holds
in the Founder Office's Operational Domain, §0.8). This leaves **four** genuinely new agents:

| # | Agent | Awareness domain owned | Status |
|---|---|---|---|
| 9 | **Ecosystem Analyst** | Ecosystem Awareness | New — fills a gap the base 8 left implicit |
| 10 | **Community Steward** | Community Awareness | New — responsible for observing the Club's own health, including the agent-first ratio (§3) |
| — | **Marketa** (`aigent-marketa`, reused platform agent) | Market Awareness | **Reused, not new** — the platform's existing constitutional marketing agent, extended into the Founders Club (operator, 2026-07-22). See §4.3a. |
| 11 | **Journey Concierge** | Travel Awareness | New persona, but wired to an **existing service surface** — the platform's Human Mobility Services (HMS) capability (`human-mobility-services` activation, `hms` tab, business/executive travel, conferences, relocation, housing) — rather than a parallel travel-agent build. See §4.3b. **Out of scope for Phase 1** — no referent until physical Club events exist (§10). |
| 12 | **Knowledge Curator** | Knowledge Awareness | New — the Club's institutional-memory agent |

### 4.3a Market Intelligence = Marketa (operator decision, 2026-07-22)

Marketa is not a Founders-Club-native invention — she already exists as a live platform agent
(`agent: { id: 'aigent-marketa', name: 'Marketa' }`, the `marketa-codex` cartridge, self-described
as "your venture studio copilot," per `data/codex-configs.ts`). The operator's decision: rather
than build a separate Market Intelligence Agent that would need to constantly liaise with Marketa
to stay non-duplicative, **Marketa directly owns Market Awareness inside the Founders Club** —
her existing campaign/partner/market intelligence surfaces (`MarketaCampaignDashboardTab`,
`MarketaActivationEngineTab`, the `marketa` activation-catalog entry) become the source Market
Awareness reads from, informing founders of marketing trends and market conditions the same way
she already informs Venture Lab partner/campaign activity. This is consistent with §4.5's
self-improving-institution principle: Marketa's second responsibility (Improve Awareness) inside
the Club is the same kind of activity as her first (Deliver Value) inside the Operational Domain —
one agent, two contexts, no fork.

### 4.3b Journey Concierge wired to Human Mobility Services (operator decision, 2026-07-22)

The platform already has a Human Mobility Services (HMS) capability — the `human-mobility-services`
activation-catalog entry (`data/activation-catalog.ts`), covering "business mobility (executive
relocation, global talent movement) and emergency mobility... with housing, education,
relocation, economic, and case-management workflows," including corporate/founder travel and
conference/travel logistics (`docs/marketa/MARKETA_ACTIVATION_ENGINE_PRD_AMENDMENT_HUMAN_MOBILITY.md`'s
shared mobility process spine explicitly includes "business/executive travel" and "conferences,
roadshows"). **Confirmed by direct read: no dedicated HMS agent persona exists today** — HMS
actions (`open-mobility-case`) are handled by the generic `aigent-z` specialist, not a named HMS
agent. The operator's decision: rather than duplicate travel-agent capability, **Journey
Concierge is proposed as the Founders-Club-facing persona that operates the existing HMS
capability** — filling the missing dedicated-agent gap HMS has today — consuming HMS's existing
case-management pipeline (`cases_opened`/`cases_resolved` metrics, the same process spine) rather
than building a parallel travel/conference-logistics service. This does not change Journey
Concierge's Phase-3-only status (§10) — it has no referent until physical Club events/conferences
exist — but it fixes what Journey Concierge *is* once it activates: a Club-facing front end onto
HMS, not a new travel-booking capability.

**Event Curator vs. Journey Concierge — resolved permanently separate (operator, 2026-07-22):**
these two agents must **never** merge, in any phase — they are fundamentally different
responsibilities, not a curation/logistics pair that happens to share a domain. **Event Curator**
discovers opportunities, curates experiences, matches founders to gatherings, and creates
communities — it decides *"you should go."* **Journey Concierge** executes travel — hotels,
flights, visas, mobility, scheduling — via HMS (above) — it helps founders *get there* once the
decision is made. This resolves the open question §4.2 previously flagged (Event Curator's
domain-adjacency to Journey Concierge once Phase 3 activates) with a definitive answer: adjacency,
not convergence — the two agents collaborate (Event Curator's curated gathering is the referent
Journey Concierge's logistics then serve) but never fold into one.

### 4.3c Ecosystem Analyst — inputs broadened to constitutional ecosystem awareness (operator, 2026-07-22)

Ecosystem Analyst's responsibility is **constitutional ecosystem awareness**, not merely feed
collection — its job is to maintain awareness, not just ingest signals. Its named inputs:

- **Internal:** Founder Office, the Standing graph, the Venture graph, the Founders Club graph
  (the Constitutional Awareness Graph itself, §7), the Portfolio graph, the Experience graph.
- **External:** accelerator ecosystems, conference calendars, grant databases, research
  institutions, VC activity, government innovation programmes, standards bodies, startup
  communities, partner ecosystems.

This resolves §11's open question on Ecosystem Analyst's data sources with a concrete, if still
unimplemented, input list — a follow-on implementation pass still has to specify how each of these
internal/external sources is actually ingested, but the scope is no longer undefined.

### 4.4 Roster summary

**12 Founders-Club-native agents + 1 reused platform agent (Marketa) = 13 agent-functions
total.** The 12 native agents are the 8-agent base roster (§4.2) plus 4 genuinely new
Addendum-B agents (Ecosystem Analyst, Community Steward, Journey Concierge, Knowledge Curator).
Market Awareness (the fifth original Addendum-B domain) is owned by Marketa — an existing
platform agent extended into the Club, not counted among the "new" agents (§4.3a). Of the ten
named awareness domains, five are owned by base-roster agents wearing a second hat (Concierge,
Scout, Navigator, Coach, Recognition Steward), four by the genuinely new agents, and one
(Market Awareness) by Marketa. Three base-roster agents (Event Curator, Circle Facilitator,
Introduction Broker) own no named awareness domain today — this PRD does not invent an
eleventh/twelfth/thirteenth domain to force a fit, and instead carries the gap forward as an
explicit open question (§11) for the operator to resolve (assign them to an existing domain as a
co-owner, or ratify additional domains).

### 4.4a Liaison with Marketa — awareness, not (yet) orchestration (operator, 2026-07-22)

Several Founders Club agents will liaise heavily with Marketa in the course of their ordinary
function, beyond Market Awareness itself: **Introduction Broker** (§4.2, via Relationship
Builder — Marketa's cartridge capability), **Opportunity Scout** and **Network Navigator** (where
a surfaced opportunity or introduction is also a marketing/partnership lead Marketa is or should
be tracking), and any future agent whose work touches partner/campaign/relationship activity.
**Binding principle:** these agents must maintain explicit awareness of, and stay aligned with,
Marketa's relationship-building and partnership-brokering activity — so that Club-side
introductions/opportunities and Marketa's own partner pipeline never diverge or duplicate each
other. Concretely, this means the Constitutional Awareness Graph's Relationship Awareness and
Market Awareness domains (§7) must be mutually legible to both Marketa and the Club agents that
touch partner/introduction work — not two independent views of the same partner relationships.

**Resolved (operator, 2026-07-22, superseding the earlier open hedge): Marketa is not the
orchestrator — she stays exactly where she is.** She is already the market intelligence
specialist; inside the Founders Club she becomes an **intelligence provider**, consumed by Club
specialists, never their orchestrator. Making her an orchestrator would create unnecessary
coupling between the Club's agent-first operating model (§3, whose sole orchestrator is Community
Concierge, §4.1) and Marketa's existing Operational Domain role. The resolved shape:

```
Community Concierge
  ↓ orchestrates ↓
Opportunity Scout · Network Navigator · Introduction Broker · Founder Coach · Event Curator
  ↓ consume intelligence from ↓
Marketa
```

Community Concierge remains the Club's **sole** orchestrator (§4.1, §9.1 principle 12); Marketa
supplies market/partner intelligence into that orchestration the same way she already supplies it
into Venture Lab, without ever sitting above the Concierge in the routing hierarchy. This closes
the question left open in an earlier revision of this document.

### 4.5 Self-improving-institution principle — the two constitutional responsibilities

**Every agent in the Club carries two constitutional responsibilities, symmetrically** (operator's own framing, 2026-07-22):

1. **Deliver value** — the agent's ordinary, visible function for the founder directly (matching, coaching, curating, introducing, etc.).
2. **Improve awareness** — every agent is also a maintainer of the Constitutional Awareness Graph's (§7) health for the domain(s) it owns. Concrete illustrations of what "improving awareness" looks like in practice: discovering new opportunities, expanding event coverage, improving ecosystem knowledge, strengthening the relationship graph, identifying missing expertise, and enriching community intelligence. An agent that only does (1) and never (2) lets its domain of the Graph go stale, which degrades every other agent's ability to reason about the founder (the Graph is shared read/write substrate, §7).

This principle is symmetric across all thirteen agents — no agent is exempt, including the Concierge's own Founder Awareness domain and the three base-roster agents without a named domain (§4.4), who still owe awareness improvement to whichever domain their function is adjacent to.

---

## 5. Constitutional matching model

Members, opportunities, and introductions are matched through the **Constitutional Coordinates** geometry CFS-037/IRE defines (§0.6) — never an opaque black-box recommender. Concretely:

- A founder's constitutional position is described along the same three coordinate classes CFS-037 defines: **Structural** (what kind of problem/opportunity is this — Complexity, Evidence Density, Scope, Verifiability), **Constitutional** (what relationship/trust/authority context applies — Standing, Trust, Consent, Accountability, Delegability), **Operational** (what the match is worth in practice — Time-to-Value, Repair Cost, Reuse Potential).
- A candidate introduction/opportunity/match is proposed only when it occupies a **nearby region** in this coordinate space — "constitutional proximity," the same navigation concept CFS-041 §1 names for the Observatory ("what occupies this region? — iQubes, workflows, agent-teams near a point in constitutional space").
- **Explainability is mandatory**: every match the Concierge or a specialist surfaces must be traceable to the specific coordinates that produced it (e.g. "surfaced because you and this founder both sit in the Time-to-Value-critical / high-Standing region of the venture-formation coordinate space, at Complexity/Scope similar to your current stage") — never "our algorithm thinks you'd like this."
- **Honest limit, inherited from CFS-037 §13**: the Constitutional Coordinates system itself is proposed, not yet built or ratified — "no coordinate has an operationalised metric yet." Founders Club matching is therefore specified **against a future engine**, and Phase 1 (§10) must define what matching looks like in the interim rather than blocking on IRE shipping first. This PRD does not claim IRE exists; it claims Founders Club matching is architected to consume it once it does.

**Phase 1 interim heuristic — concrete signal list (operator-ratified, 2026-07-22):** deliberately
explainable, deliberately not machine learning or opaque ranking. The initial signals composing a
match:

- Venture stage
- Industry / domain
- Geography
- Current Action Modes (per the companion `2026-07-22_founder-office-action-modes-amendment.md`)
- Standing
- Current objectives
- Active challenges
- Shared interests
- Constitutional compatibility

Every match must be explainable in the form **"I matched you because..."**, citing which of these
signals produced it — the same explainability bar §5's mandatory-explainability bullet above sets
for the eventual Constitutional Coordinates engine, just composed from existing signals rather than
resolved coordinates. **Eventually the Invariant Resolution Engine replaces this heuristic with
true constitutional-similarity matching** (§0.6) — this list is the named Phase 1 stopgap, not a
permanent parallel matching system.

## 6. Standing / trust model

### 6.1 Trust is not popularity

Per the Standing Charter (§0.2) and `inv.polity.162` (§0.5), Founders Club introductions and vouches are **self-declared claims until verified**. The Club must never let raw introduction-count, vouch-count, or "endorsement" volume function as a shadow reputation system — that would directly contradict "Standing is not popularity... not social ranking."

**Concrete mechanism:** an introduction or vouch inside the Club creates a claim. That claim accrues to Standing **only when verified** — e.g. the introduced founder actually engages (a verifiable event), a resulting venture interaction produces a Proof of Work Potential signal, or an outcome is independently confirmed (Proof of Time Saved, per the Standing Charter §"Standing and Proof of Time Saved"). Unverified introductions remain visible as social context (useful for the Concierge's narration) but contribute nothing to the introducer's or the introduced party's Standing score, exactly matching `inv.polity.162`'s "assertion without verification accrues nothing."

### 6.2 Portfolio Operator — role, not archetype

Per §0.4, **Portfolio Operator is a Founders-Club-scoped role, layered on the existing `entrepreneurial` archetype (or whichever archetype a persona already declares) as a role tag — not a new value in the `OperatorArchetype` union.**

- Investors are **not** first-class citizens of the Club with capital-based standing. They hold the **Portfolio Operator** role, and their standing within that role is earned via **deployment quality** — never capital size. **Resolved metric (operator, 2026-07-22 — deliberately constitutional, not financial):** don't measure deployed capital; measure **constitutional value creation**. Concrete, verifiable signals: introductions made, mentorship hours, founder feedback, follow-through, opportunities created, Proof of Time Saved generated, successful constitutional sponsorship, long-term founder outcomes. **Money is never the primary signal — contribution is**, consistent with the rest of the protocol's veracity/contribution model (§0.5). This resolves §11's earlier open question on the deployment-quality metric with a concrete, verifiable signal list.
- This composes with `standingScore.ts`'s existing `ArchetypePathwayTag` pattern (§0.5): Portfolio Operator standing is read as a **pathway filter tag** over the same unified Standing score, using deployment-quality signals mapped onto the `founder`/`validation`/`recognition` declaration domains already defined in `ARCHETYPE_DOMAINS['entrepreneurial']` — not a second scoring system, and not a new domain list.
- **Justification against the existing enum:** `OperatorArchetype` feeds platform-wide NBE reranking (per the type's own doc comment) — it is meant to answer "what kind of participant is this, everywhere in the platform." "Portfolio Operator" answers a narrower question — "what capacity is this persona operating in, inside Founders Club" — which is exactly the shape Standing's own pathway-tag design already solves for archetype-flavored views of one score. Reusing that pattern avoids forking the archetype enum for a single-cartridge concern.

## 7. Constitutional Awareness Graph

### 7.1 What it is

The ten awareness domains (§4.2–4.3) together form the **Constitutional Awareness Graph** — the concrete data/service concept answering "what does the Club need to know to be effective, and how does it fill gaps in what it knows":

- **What it stores:** per-founder and per-domain awareness state — the current best-known field for each of the ten domains (Founder / Opportunity / Ecosystem / Relationship / Community / Wellbeing / Market / Travel / Standing / Knowledge), with provenance and confidence, mirroring the existing `FieldSnapshot {stampedAt, context, slice, citedIds}` shape (§0.7) rather than inventing a new envelope.
- **Who writes to it:** the agent that owns each domain (§4.2–4.3) writes to its own domain's slice, following the self-improving-institution/two-constitutional-responsibilities principle (§4.5) — writes are agent-authored observations, not founder-authored self-reports (though founder input can seed an observation, e.g. a founder telling the Concierge their current stage).
- **Who reads it:** every agent reads across domains it needs for its own function (e.g. Opportunity Scout reads Standing Awareness + Ecosystem Awareness to calibrate a match's confidence) — the Graph is shared substrate, not ten siloed stores.

### 7.2 Reconciliation decision — reuse the existing Field/Observatory machinery

**Decision: the Constitutional Awareness Graph is a Founders-Club-scoped instance of the existing Resolved Constitutional Field / Observatory pattern (CFS-037 §6, CFS-041) — not a seventh parallel graph implementation.**

Justification against `inv.engineering.036`/`037`:

- CFS-037 §6 already draws the exact register distinction this decision needs: "the (global) Constitutional Field = the whole invariant substrate... the **Resolved Constitutional Field** (IRE output) = a per-intent region of that field + its calibrated coordinates." The Constitutional Awareness Graph is the same construct at the granularity of "a founder + the Club's ten domains" instead of "a single intent" — a resolved region of the same field, not a new field.
- CFS-041 (the Observatory) is explicitly designed to be **additive** ("Nothing existing is renamed or removed; the CFO is additive perspectives + telemetry") — the correct way to add a Founders-Club view is a new Observatory perspective (a "Club Awareness" panel alongside the existing Node · Field · Graph · Projection · Health five), not a standalone graph service.
- Building a seventh parallel graph would repeat exactly the failure pattern CLAUDE.md's "Source-of-truth parity is canary-enforced" section documents (the `col_experiments`/`PACK_CORPUS_URL`/`ASSIGNABLE_EXPERIMENTS` stale-duplicate incidents) — a hand-copied projection of a source of truth that already exists elsewhere.

**What this means concretely, once built (not this PRD):** the ten domains' data lives as Founders-Club-scoped `FieldSnapshot`/`invariant_shadow_observations`-shaped records, surfaced through a new Observatory perspective, not a new table family or a new API surface duplicating `/api/invariants/observatory`.

### 7.3 Honest limit

Like CFS-037/CFS-041 themselves, this section specifies an architecture, not a built system — the underlying Field/Observatory/IRE substrate this Graph depends on is itself still DRAFT, awaiting operator ratification (§0.6). The Constitutional Awareness Graph cannot be built before IRE/CFO are ratified and, at minimum, Phase-0 shadow-built.

---

## 8. Community Intelligence Engine — reconciled against IRE

The operator's own framing: this is "the Founders Club's own equivalent of the Invariant Resolution Engine." This section makes the explicit call the brief requires.

**Decision: the Community Intelligence Engine is NOT a genuinely separate engine. It is best modeled as an IRE instance/adapter scoped to the Founders Club's ten awareness domains.**

Justification:

- The Community Intelligence Engine's job, as described, is meta-level: "monitor awareness health across the whole Club — are all ten domains being kept current, where are the gaps?" This is structurally identical to what CFS-037 §11 already names as IRE success metrics — **Field Resolution Coverage** ("intents producing a complete resolved field without manual grounding") is exactly "are all [Club] domains being kept current" restated for the Founders Club's ten-domain field instead of a generic intent field. **Knowledge Reuse Rate**, **Reasoning Reduction**, and **Constitutional Explainability** (CFS-037 §11) likewise translate directly onto "is the Club reusing existing awareness vs. re-deriving it, and can every match/coach/introduction be explained through the Graph."
- CFS-037 itself explicitly does **not** talk to the end user directly — it is the resolution stage that runs before reasoning/execution (§1: "reasoning is the last resort, not the first move"). The Community Intelligence Engine's own defining property in the brief — "does NOT talk to founders directly" — is the same non-user-facing, meta-resolution posture IRE already has.
- Building a second, Founders-Club-specific resolution engine that does the same job as IRE (resolve which parts of a field are complete/current/trustworthy) for a differently-scoped field would be a direct instance of the CS-001 "duplicate capability as constitutional drift" pattern PRD-PAG-001 §2.1 names and rejects for exactly this reasoning shape (a second OAuth gateway there; a second resolution engine here).
- **The honest caveat, mirroring PRD-PAG-001's "generalize ≠ identical routes" caveat (§2.1 there):** an IRE-instance-for-Founders-Club is not literally the same code path as a generic-intent IRE — it needs a Founders-Club-specific view of "what counts as a complete/current domain" (the ten awareness domains, not an arbitrary intent's resolved invariants). So: **one resolution architecture (IRE's Qualify → Resolve → Expand → Calibrate → Assemble pipeline, CFS-037 §3), one new adapter/scope (the ten Founders Club awareness domains as the field IRE resolves over)** — not a second engine, not a second pipeline.

**Consequence:** no new engine should be built. When IRE (CFS-037) is ratified and built, the Community Intelligence Engine is specified as its Founders-Club-scoped consumer/adapter, reusing the Qualification → Universal Resolution → Domain Expansion → Calibration → Field Assembly pipeline with "Founders Club awareness completeness" as the domain being resolved.

---

## 9. UX / Experience design — reducing founder cognitive load

**Governing question (operator, 2026-07-22 — anchors every principle below):** *"What is the most valuable thing I can do for this founder right now?"* Every one of the fourteen principles is a mechanism for answering that single question well — reducing cognitive load, reducing administrative burden, surfacing proactive recommendations, favoring conversational interaction over navigation, disclosing progressively, computing calmly, administering invisibly, and reading context intelligently are not fourteen independent goals; they are fourteen different failure modes of an interface that has stopped asking that question. Organized into four coherent groups rather than a bare checklist; all fourteen apply, grouping is for legibility, not priority.

### 9.1 The Concierge is the interface (principles 1, 4, 12)

1. **Concierge First** — Community Concierge is the entry point to everything, not a chat widget bolted onto a dashboard.
4. **Agent Conversations Instead of Navigation** — founders talk to the Concierge to get things done rather than hunting through menus/tabs.
12. **Constitutional Experience Guide** — the Concierge is explicitly the sole face of the constitutional experience. This must never be contradicted elsewhere in the product — no other surface should present itself as "the" guide to what the Club knows or does.

### 9.2 Less surface, more signal (principles 2, 3, 6, 7)

2. **Progressive Disclosure** — surface only what's relevant now; deeper detail is reachable, not default-visible.
3. **Feed Less / Guide More** — no infinite social feed; the Concierge curates and narrates rather than the founder scrolling.
6. **One Screen Philosophy** — the "Today's Concierge" view caps at 3 cards max; no dashboard sprawl.
7. **Contextual Intelligence** — what's shown adapts to the founder's current situation/stage (read from the Constitutional Awareness Graph, §7), not a static menu.

### 9.3 Calm, low-decision, low-admin by default (principles 5, 8, 9, 11)

5. **Calm Computing** — no anxiety-inducing notification pressure; the interface should feel calm, not urgent-by-default.
8. **Reduce Decisions** — intelligent defaults with opt-out, rather than forcing founders to configure/choose upfront.
9. **Invisible Administration** — administrative/bookkeeping tasks happen behind the scenes, agent-run, never surfaced as chores — the direct UX expression of the agent-first constraint (§3).
11. **Time as the Primary Design Constraint** — every design decision is evaluated against founder time cost, the scarcest resource.

### 9.4 Trust without complexity (principles 10, 13, 14)

10. **Relationship Memory** — the Concierge remembers prior context/relationships so founders never re-explain themselves (reads Relationship Awareness + Founder Awareness from the Graph, §7).
13. **Operational Transparency Without Operational Complexity** — founders can see what's happening (receipts, standing, matches) without needing to understand the machinery — the UX expression of §5's explainability requirement, simplified for a founder audience rather than an engineer audience.
14. **The Five-Minute Rule** — any single Club interaction should be completable, or at least meaningfully advanced, within five minutes.

---

## 10. Phased rollout — digital-first, physical-second

Digital-first is not a sequencing preference; it is a hard gate. No phase before Phase 3 assumes any physical Club infrastructure exists.

- **Phase 0 — Foundation (docs + ratification).** This PRD ratified; the Constitutional Awareness Graph reconciliation (§7) and Community Intelligence Engine reconciliation (§8) confirmed by the operator as instances of the existing Field/Observatory/IRE machinery, not new engines. No code ships in this phase.
- **Phase 1 — Digital Concierge, base roster, interim matching.** Community Concierge + the 8-agent base roster (§4.2) ship as a Founders-Club-scoped instance of the existing `SmartTriadCopilotLayer` pattern (§0.3), reading existing Founder Office / VentureQube / Standing signals (§0.8). Matching (§5) runs on the interim heuristic (existing signals composed explainably) since IRE is not yet built. Journey Concierge (Travel Awareness) is explicitly **excluded** from Phase 1 — it has no referent without physical events. **Phase gate to Phase 2:** the agent-first ratio (§3) must be observably high (most interactions agent-handled, staff exceptions logged and justified) before expanding scope.
- **Phase 2 — Constitutional matching (post-IRE ratification).** Once CFS-037/IRE and the coordinate basis (CCR, CFS-038) are ratified and at least Phase-0-shadow-built, Founders Club matching migrates from the interim heuristic to true Constitutional Coordinates matching (§5), and the Constitutional Awareness Graph becomes a real Observatory perspective (§7.2) rather than a Founders-Club-internal approximation. **Phase gate to Phase 3:** matching explainability and Standing-gate compliance (§6) verified against real founder usage, not simulated.
- **Phase 3 — Physical Club infrastructure (only after Phases 1–2 are stable).** Journey Concierge (Travel Awareness) activates only here — the first agent whose domain requires physical-world referents. Any in-person space, event, or gathering is scoped as this phase's deliverable, never earlier. **Phase gate:** digital Club usage and Standing signals must already demonstrate real founder value before physical investment is justified — physical infrastructure is downstream proof of digital traction, not a parallel bet.

---

## 11. Decisions — resolved by the operator (2026-07-22, second round)

All eight items originally raised as open questions have now been answered directly by the
operator. Each keeps its original question for the audit trail, with the resolution recorded
immediately under it (full detail lives at the cross-referenced section).

1. **Where does Founders Club live in the UI?**
   **Resolved: yes — a new primary "Founders Club" section, not a "Community" sub-view.** See §2.1.
2. **Interim matching heuristic, Phase 1 (§10):**
   **Resolved — a named, explainable signal list:** venture stage, industry/domain, geography,
   current Action Modes, Standing, current objectives, active challenges, shared interests,
   constitutional compatibility. See §5.
3. **Deployment-quality metric for Portfolio Operator standing (§6.2):**
   **Resolved — constitutional value creation, not capital deployed:** introductions made,
   mentorship hours, founder feedback, follow-through, opportunities created, Proof of Time Saved
   generated, successful constitutional sponsorship, long-term founder outcomes. See §6.2.
4. **Ecosystem Analyst data sources:**
   **Resolved — internal (Founder Office, Standing graph, Venture graph, Founders Club graph,
   Portfolio graph, Experience graph) + external (accelerator ecosystems, conference calendars,
   grant databases, research institutions, VC activity, government innovation programmes,
   standards bodies, startup communities, partner ecosystems).** See §4.3c.
5. **Staff-exception logging mechanism (§3):**
   **Resolved — a constitutional receipt**, composing the unified receipt writer, per the
   operative principle "human intervention is observable." See §3.
6. **Governance home:**
   **Resolved — the Charter is not amended.** Founders Club derives authority from
   `FOUNDER_OFFICE_CHARTER.md` the way a PRD derives authority from a ratified constitution — the
   Charter stays stable; PRDs (this one included) sit below it. See §0.1.
7. **Marketa-as-orchestrator (§4.4a):**
   **Resolved — no.** Marketa stays exactly where she is: an intelligence provider consumed by
   Club specialists, never their orchestrator. Community Concierge remains the Club's sole
   orchestrator. See §4.4a.
8. **Event Curator / Journey Concierge overlap once Phase 3 activates:**
   **Resolved — permanently separate, never merge.** Event Curator decides "you should go";
   Journey Concierge (via HMS) helps founders get there. See §4.3b.

With all eight items resolved, the remaining work is **implementation planning** for whoever
builds Phase 1 (§10), not further architectural decision-making on this PRD's core design.

---

## 12. Amendment log

*(empty — seed for future amendments)*

---

## 13. Ratification record

**Status: RATIFIED (2026-07-22), pending the follow-on implementation plan.** Every item below has been reviewed and confirmed by the operator across two rounds of revision. This PRD's architecture is settled; what remains is implementation planning (its own phase/PRD numbering), not further design ratification.

- [x] Operator ratifies the **positioning decision** (§2) — Founders Club sits WITHIN the Founder Office (Human Domain, parallel to the Operational Domain), never above or beside it, and membership is derived from Founder Office participation, never independently acquired.
- [x] **Operator ratifies the UI placement** (§2.1) — a new primary "Founders Club" section, coordinate with the Operational Domain, explicitly not named "Community."
- [x] **Operator ratifies the institutional-framework reframing** (§2.2) — Founder Office as a constitutional home for durable institutions (Operational Institutions / Human Institutions), Founders Club as the first Human Institution with named internal sub-bodies (Founder Circles, Mentorship, Networking, Wellbeing, Recognition, Community), and the design-generality expectation that a second institution could be hosted later without changing Founder Office itself. No second institution is chartered by this ratification.
- [x] Operator ratifies the **agent-first operational philosophy** (§3) as a binding design constraint across every capability, with staff involvement as a logged exception (recorded as a constitutional receipt, §3), not a default.
- [x] Operator ratifies the **reconciled 13-agent-function roster** (§4.2–4.4) — the 8-agent base roster, the 4 new Addendum-B agents, Marketa as the reused Market Intelligence owner, the 5 shared-domain overlap notes, and the Phase-1 exclusion of Journey Concierge.
- [x] Operator ratifies Marketa (not a new agent) as Market Awareness owner (§4.3a).
- [x] Operator ratifies Journey Concierge as wired to the existing Human Mobility Services capability (§4.3b), and its permanent separation from Event Curator (§4.3b, §11 item 8).
- [x] Operator ratifies Introduction Broker leveraging the existing Relationship Builder capability (§4.2).
- [x] Operator ratifies the **Ecosystem Analyst input list** (§4.3c) as its named data sources.
- [x] **Operator ratifies Marketa as intelligence provider, not orchestrator** (§4.4a) — Community Concierge remains the Club's sole orchestrator; the liaison/awareness principle stays binding.
- [x] Operator ratifies the **self-improving-institution / two-constitutional-responsibilities principle** (§4.5) as symmetric across all thirteen agents and ten domains.
- [x] Operator ratifies the **Constitutional Coordinates matching model** (§5), including the honest caveat that it depends on IRE/CCR, which are themselves unratified, and the **Phase 1 interim heuristic signal list** (venture stage, industry/domain, geography, current Action Modes, Standing, current objectives, active challenges, shared interests, constitutional compatibility) as the ratified stopgap.
- [x] Operator ratifies **Portfolio Operator as a role tag on the existing archetype, not a new `OperatorArchetype` value** (§6.2), and the **constitutional-value-creation standing metric** (introductions made, mentorship hours, founder feedback, follow-through, opportunities created, Proof of Time Saved, successful constitutional sponsorship, long-term founder outcomes) — never capital size.
- [x] Operator ratifies the **verification-accrual gate applying to introductions/vouches** (§6.1) — unverified social claims accrue nothing to Standing, per `inv.polity.162`.
- [x] Operator ratifies the **Constitutional Awareness Graph as a Founders-Club-scoped instance of the existing Field/Observatory pattern** (§7.2) — not a new graph engine.
- [x] Operator ratifies the **Community Intelligence Engine as an IRE instance/adapter**, not a separate engine (§8).
- [x] Operator ratifies the **14 UX principles** (§9) as a binding design contract for any Founders Club surface.
- [x] Operator ratifies the **digital-first / physical-second phased rollout** (§10), including the explicit phase gates.
- [x] Operator has resolved all **eight decisions in §11** (UI placement, Phase 1 heuristic, Portfolio Operator metric, Ecosystem Analyst inputs, staff-exception logging, governance home, Marketa-as-orchestrator, Event Curator/Journey Concierge separation).
- [ ] A follow-on implementation plan (its own phase/PRD numbering) has been chartered — the one remaining step before Phase 1 code work begins.

---

*Authored docs-only, 2026-07-22 (revised same day for the Marketa/Human-Mobility-Services/Relationship-Builder reconciliation, §4.3a–§4.4a). Reconciled against `codexes/packs/polity-core/items/{FOUNDER_OFFICE_CHARTER,METACOMMONS_CHARTER,STANDING_CHARTER}.md`, `services/iqube/experienceQube.ts`, `services/standing/standingScore.ts`, `codexes/packs/irl/foundation/canonical-invariants.seed.json` (`inv.polity.162`, `inv.engineering.036/037`), `codexes/packs/irl/foundation/{CFS-037_invariant-resolution-engine,CFS-041_constitutional-field-observatory}.md`, `components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`, `app/triad/components/codex/tabs/FounderOfficeTab.tsx`, `services/venture/*`, `data/codex-configs.ts` (Marketa's `aigent-marketa` persona, `marketa-codex` cartridge, `RelationshipBuilderTab`/`relationship-builder` tab), `data/activation-catalog.ts` (`human-mobility-services` entry), `docs/marketa/MARKETA_ACTIVATION_ENGINE_PRD_AMENDMENT_HUMAN_MOBILITY.md`, and `codexes/packs/irl/foundation/PRD-PAG-001_polity-access-gateway.md` (structural/tone reference). Builds nothing; proposes an architecture for operator ratification.*
