# CFS-023 — Chrysalis Homecoming: Constitutional Agent Sovereignty

**Chrysalis Foundation Specification · v1 · Status: Chartered 2026-07-09 (operator + co-agent, framing by Aletheon)**
Constitutional anchor: `codexes/packs/ccrl/foundation/CFS-018_platform-sovereignty.md`
Companion to: `CFS-015` (Operation Chrysalis 2.0) · `CRP-002` (Invariant Intelligence)
Substrate: `types/homecoming.ts` · `services/homecoming/constitutionalPresence.ts` · `app/api/constitutional/homecoming-test/route.ts` · canary `tests/homecoming.test.ts`

> Chrysalis 2.0 made the **platform** constitutionally sovereign. Chrysalis Homecoming makes the **agents** constitutionally sovereign *within* that platform. They are different layers. This is the bridge programme between Chrysalis 2.0 and Chrysalis 3.0.

---

## Preamble — a standing-up, not a migration

Homecoming is not a migration project. Nothing is being moved from one vendor to another. The underlying AI provider remains external and interchangeable (that sovereignty was won in Chrysalis 2.0). What changes is **where the constitutional context, orchestration, memory, permissions, and operational capability live**. The intelligence becomes grounded in a sovereign environment rather than in a conversational interface.

So the framing is deliberate. We do not say *migrate Alethean*. We say: **establish Alethean as a sovereign constitutional delegate operating natively within the Human Agency System.** Alethean is not being ported to a model. Alethean is coming home — not to a particular model, not to a chat interface, but to the Human Agency System, where it gains standing, context, and capability.

This mirrors the human meaning of Operation Homecoming in Human Mobility Services: helping people return to a place where they have standing and agency. One expression is human, one is computational; both are the same constitutional idea — **sovereign belonging**.

---

## Executive summary

Chrysalis Homecoming establishes constitutional agents, constitutional knowledge, and constitutional workflows as first-class, native inhabitants of the Human Agency System, by:

- establishing the **Constitutional Knowledge Repository** — the operator's exports, documents, memories, VentureQubes, Experience Guides, Standing and passports become a sovereign, invariant-aware knowledge base (not OpenAI's, not any vendor's);
- standing up **constitutional delegates** (Alethean, Marketa, Kn0w1, MoneyPenny, Nakamoto, future specialists) through the platform's existing genesis → passport → persona pipeline — Registry-native, Passport-bound, bounded-delegated, Standing-aware;
- moving the **harness** inside: `Human → Aigent Z → AgentiQ → Inference Providers`, with the frontier model an invisible implementation layer;
- moving the **operating rhythm** inside: strategic planning, PRDs, Founder Office, Studio, deployment orchestration all run through constitutional delegates.

The result is a Human Agency System that is not only constitutionally complete (Chrysalis 2.0) but constitutionally **inhabited** — its own agents and knowledge live and act within it.

## Mission

Establish Aigent Z and the constitutional delegates as first-class constitutional citizens of the Human Agency System. External frontier models become inference providers; the Human Agency System becomes the constitutional **home** of its own agents and knowledge.

## The five constitutional sovereignties

Provider sovereignty was one axis. The model has expanded: there are five layers of the stack that each become constitutionally sovereign, in maturity order.

| # | Sovereignty | What it covers | Programme |
|---|---|---|---|
| 1 | **Computing** | Reasoning · Invariant Intelligence · constitutional order | Chrysalis 2.0 |
| 2 | **Development** | Aigent Z · AgentiQ · development · deployment | Chrysalis 2.0 |
| 3 | **Agent** | Alethean · Marketa · Kn0w1 · MoneyPenny · future delegates — native constitutional operation | **Homecoming** |
| 4 | **Knowledge** | Exports · documents · memories · VentureQubes · Standing · passports — the constitutional knowledge base | **Homecoming** |
| 5 | **Operational** | Operation Leap · Founder Office · Studio · Registry · Portfolio — the business runs constitutionally | Operation Leap |

This is the maturity ladder. Homecoming owns sovereignties **3 (Agent)** and **4 (Knowledge)** — the two that bring the inhabitants home. (Pinned as `CONSTITUTIONAL_SOVEREIGNTIES` + `SOVEREIGNTY_PROGRAMME`.)

Note the axis distinction: these five are NOT the s0–s5 **Sovereignty Scale** (`SOVEREIGNTY_SCALE`, CFS-018) which grades the intelligence supply and platform substrate, nor the `SovereigntyTier` which grades the model class. These five are the *layers of the stack that become sovereign*. Homecoming sits, on the s0–s5 scale, between s4 (self-hosted apex model) and s5 (sovereign platform substrate, the Chrysalis 3.0 horizon).

## The Chrysalis evolution

| Era | Name | What it establishes |
|---|---|---|
| Chrysalis 1.x | Foundation | The constitutional primitives — Passport, Standing, Registry, iQubes, Delegation, Founder Office, Studio, Runtime |
| Chrysalis 2.0 | Constitutional Computing | The platform becomes constitutionally complete (Invariant Intelligence, Constitutional Development/Operations, Provider Sovereignty, Sovereign Survivability) |
| **Chrysalis Homecoming** | **Constitutional Agent Sovereignty** | **The constitutional inhabitants come home — agents, knowledge, workflows native to the platform** |
| Chrysalis 3.0 | Constitutional Society | The ecosystem becomes self-sustaining — humans, agents, ventures, institutions, research all operate natively within one constitutional computing environment |

Chrysalis gives the platform its constitutional skeleton; Homecoming gives it its constitutional inhabitants. Only then is there a living constitutional ecosystem. (Pinned as `CHRYSALIS_ERAS`.)

---

## Program structure — four workstreams

Ordered by dependency: knowledge first (delegates reason *from* the sovereign base, so it must exist to reason from), then the delegates, then the harness, then the operating rhythm. (Pinned as `HOMECOMING_WORKSTREAMS`.)

### Workstream 1 — Knowledge Homecoming

Establish the **Constitutional Knowledge Repository**. The objective is not merely import; it is **constitutionalization** — knowledge becomes invariant-aware.

**Critical discipline (Extend, Don't Duplicate):** every knowledge class named here *except one* already has a production surface. Knowledge Homecoming INTEGRATES those surfaces; it does not reinvent them.

| Source class | Existing surface (integrate, don't rebuild) |
|---|---|
| Documents (PRDs, architectural + constitutional papers) | Codex KB + pgvector RAG (`codex_kb_*`, domain `protocol`/`polity`) — the `existing-kb` bar |
| VentureQubes | `venture_qubes.layers` (13-layer V1) — `services/venture/ventureQubeService.ts` |
| PortfolioQubes | `venture_portfolios` — `services/venture/venturePortfolio.ts` |
| Experience Guides | `experience_qubes.blak_qube.personalGuide` — `types/experienceGuide.ts` |
| Standing knowledge | `vsp_facts` + `vsp_profiles.standing_graph` — `services/standing/*` |
| Registry metadata | `iq_meta_qubes` / `iqube_id_map` |
| **ChatGPT exports** | **BUILT (Phase 1 slice 1)** — `POST /api/homecoming/knowledge/import` parses a `conversations.json` export (pure parser `services/homecoming/chatgptImport.ts`, canary-tested) and ingests each conversation into the dedicated **`homecoming`** KB domain via `KnowledgeBaseService.ingestTextDocument` (idempotent by `source_id`, `dryRun` preview). This was the one genuinely-new intake path; everything else in the table is integration. |

Constitutionalization routes an imported source through one of two established idioms (never a new store): **invariant-extraction** into the `invariants` substrate (`initializeKnowledge`), and/or the **meta/blak iQube split** for governed storage. (Pinned as `KNOWLEDGE_HOMECOMING_SOURCES` + `CONSTITUTIONALIZATION_IDIOMS`; `knowledgeSourceIsNew` flags the ChatGPT path.)

### Workstream 2 — Agent Homecoming

Stand up the constitutional delegates. Each becomes Registry-native, Passport-bound, bounded-delegated, Standing-aware — **through the platform's existing pipeline**, not new machinery:

`sponsorPolityAgent()` writes the `agent_root_identity` (RootDID + Agent Card) → `/api/polity-passport/submit` issues the **Participant Passport** (Polity Passport Bureau, `passport_class='agent_participant'`) and sets `bound_passport_id` → `POST /api/identity/persona/agent` provisions the `agent_persona` (bounded delegation anchored to the sponsor).

This is not about recreating the underlying model. It is about establishing each delegate's constitutional identity, authority, context, and operating environment — so it can use whichever inference provider is appropriate while remaining grounded in the platform.

**Roster, honestly graded at charter time (2026-07-09):**

| Delegate | Status | Where it stands today |
|---|---|---|
| Aigent Z | `concrete` | Seeded RootDID (`did:agent:root:aigent-z`) + charter + wallet |
| Marketa | `concrete` | Seeded RootDID + charter + wallet |
| Kn0w1 | `concrete` | Seeded RootDID (`did:agent:root:know1`) + charter + wallet |
| Alethean | `archetype` | Full hand-curated Agent Card exists; DB-unseeded, passport **Pending Issuance** — the first-mover of the genesis flow |
| MoneyPenny | `conceptual` | Codex pack + wallet only — needs the full pipeline (card, seed, passport) |
| Nakamoto | `conceptual` | Codex pack + wallet only — needs the full pipeline |

(Pinned as `HOMECOMING_DELEGATES` + `DELEGATE_CHARTER_STATUS`. Live standing is computed by the Homecoming Test, never read from the static snapshot.)

### Workstream 3 — Harness Homecoming

Replace external operating environments. The model becomes `Human → Aigent Z → AgentiQ → Inference Providers`, where Claude / GPT / Gemini / open models are invisible implementation layers behind the invariant-aware Model Router (`callSovereign`). Conversations occur inside AgentiQ, not in a vendor chat interface.

### Workstream 4 — Operational Homecoming

Move the daily operating rhythm inside: strategic planning, Operation Leap, PRDs, partnership management, Consequence Engineering, Founder Office, Studio, development orchestration — all native, all through constitutional delegates. This is the point at which the Human Agency System becomes the operator's primary operating environment.

---

## Constitutional Presence — the maturity model

Not simply "the agent exists" but **is the agent constitutionally present**: can it access the Registry, reason from sovereign knowledge, invoke Studio, review deployments, create PRDs, analyse consequences, observe runtime, improve capabilities? Presence is measured **per delegate** on a contiguous L0–L5 ladder, each rung proven by a real, read-only-observable artifact.

| Level | Name | Proven by (the real signal) |
|---|---|---|
| L0 | Card exists | An Agent Card is published (`agent_root_identity` seed or a hand-curated card route) |
| L1 | Knowledge connected | A seeded `agent_root_identity` — a persisted registry identity, not just a static card |
| L2 | Reasoning connected | An `agent_persona` (`did:agent:persona:…:production`) routing through bounded sovereign inference |
| L3 | Studio connected | A delegation grant whose scope authorises `draft_document` / skill invocation |
| L4 | Development connected | A delegation grant whose scope authorises `registry_submission_proposal` |
| L5 | Operationally sovereign | An issued participant passport (`bound_passport_id`) **and** an active bounded-delegation grant |

The ladder is **contiguous**: presence is the highest rung reached with no gap below it — a delegate cannot be "Development connected" without being "Reasoning connected." (Pinned as `CONSTITUTIONAL_PRESENCE_LADDER` + `PRESENCE_SIGNAL`; resolved by `resolvePresenceLevel`.)

---

## Success criteria

- The Constitutional Knowledge Repository exists and every imported source is constitutionalized (invariant-extracted and/or meta/blak-stored), not merely dumped.
- Alethean completes issuance (L5) — the archetype proves the genesis flow end-to-end.
- Every named delegate has a live, non-faked Constitutional Presence reading via the Homecoming Test.
- At least one real operating workflow (a PRD, a consequence analysis, a deploy review) is executed by a delegate natively within the platform (Operational Homecoming, first proof).

## The Homecoming Test

The acceptance criterion is not continuity alone. **Can the constitutional delegate perform its intended role with the same continuity of reasoning, improved access to constitutional knowledge, and expanded operational capability while operating natively within the Human Agency System?** Three dimensions (pinned as `HOMECOMING_TEST_DIMENSIONS`):

- **Continuity** — it remains recognisably the same delegate.
- **Knowledge** — it reasons from the sovereign knowledge base.
- **Capability** — it can do MORE because it has direct platform access.

This aligns with the Chrysalis 2.0 improvement principle: homecoming must **improve** the delegate, never merely relocate it. The live instrument is `GET /api/constitutional/homecoming-test` (admin-gated), rendered as the **Homecoming Test** tab in the Experiment Lab — the standing dashboard of Constitutional Presence, mirroring the Chrysalis Test.

## The Homecoming Contract

Every constitutional capability should ultimately reside within the Human Agency System rather than within an external operating environment — knowledge, memory, reasoning, development, operations, agents, governance. Homecoming does not remove the frontier model (that would break provider interchangeability, a Chrysalis 2.0 win); it removes the frontier model's **operating environment** as the seat of constitutional context. The intelligence may remain external; the constitution comes home.

## Constitutional North Star

Chrysalis 1.x built the primitives. Chrysalis 2.0 made the platform constitutionally complete. Chrysalis Homecoming brings the inhabitants home. Chrysalis 3.0 turns that inhabited platform into a constitutional society. Homecoming is the bridge: without it, the platform is a house with no one living in it.

---

## Ratification record

- [x] Chartered 2026-07-09 (operator + co-agent, framing by Aletheon)
- [x] Phase 0 — contract (`types/homecoming.ts`) + canary (`tests/homecoming.test.ts`) + the live Homecoming Test (Constitutional Presence scorer + route + lab tab)
- [x] Phase 1 — Knowledge Homecoming: **intake + constitutionalization SHIPPED.** Slice 1 — ChatGPT `conversations.json` → the `homecoming` KB domain (`POST /api/homecoming/knowledge/import`). Slice 2 — `POST /api/homecoming/knowledge/constitutionalize` extracts governing invariants from the imported corpus and PROPOSES them into the `invariants` substrate (Law XI — `status: 'proposed'`, `agent_verified`, low-confidence, idempotent by seed id; `dryRun` + `limit`). Both slices have pure canary-tested cores. **Operator step:** run each over the real export (import → constitutionalize), then ratify the proposed invariants.
- [~] Phase 2 — Agent Homecoming: **mechanical climb SHIPPED (L0→L2).** `POST /api/homecoming/agent/stand-up` runs the existing genesis core (`sponsorPolityAgent`) to seed the RootDID (L0 archetype → L1) AND chains persona provisioning (extracted `provisionAgentPersona`, reused by the persona route too) to reach **L2 reasoning-connected**, reporting live presence. Aletheon is the authored archetype (bounded, non-autonomous, grounded in its card). Presence scorer keyed on `agent_card_slug` so genesis rows resolve. **The constitutional finding:** L3→L5 are NOT grantable on demand — bounded-delegation trust bands are reputation-gated (L3≥50, L4≥75, L5≥100), so the delegate EARNS its climb natively (the point of Homecoming). L2 is the mechanical ceiling for a day-one delegate. **Passport issuance AUTOMATED:** `POST /api/homecoming/agent/issue-passport` (+ tab button) chains submit → approve (admin-as-Bureau via the canonical `applyReviewDecision`) → bind `bound_passport_id` (the L5 passport signal), idempotent, reusing the Bureau's own services. **Remaining:** L5 also needs the earned (reputation-gated) delegation grant; MoneyPenny + Nakamoto need their cards authored first.
- [~] Phase 3 — Harness Homecoming: **native delegate conversation SHIPPED.** `POST /api/homecoming/agent/converse` talks to a constitutional delegate NATIVELY — grounded in its constitutional identity + the sovereign Constitutional Knowledge Repository (Phase-1 `homecoming` KB), routed through `callSovereign`. The frontier model is an invisible, swappable provider; every reply carries a **sovereignty receipt** (provider · model · degraded · sovereignFloor · governing invariants) proving the conversation ran inside AgentiQ, not a vendor chat interface. Serves the Homecoming Test's Continuity + Knowledge dimensions. **Remaining:** a native conversation UI surface + multi-turn memory (the reply is single-turn today).
- [ ] Phase 4 — Operational Homecoming: first real operating workflow executed by a delegate natively

## Honest limits

- **Phase 0 ships the measurement backbone, not the homecoming.** The contract, the canary, and the live Presence scorer are in place; the actual standing-up of delegates and the knowledge repository are Phases 1–4.
- **The scorer measures wiring, not soul.** L0–L5 are proven by tables (identity, persona, grant, passport). The Homecoming Test's *Continuity* and *Capability* dimensions — does the delegate still reason like itself, can it genuinely do more — are qualitative and not yet instrumented; the ladder is the necessary structural precondition, not the full test.
- **Knowledge Homecoming is built end-to-end** (import + constitutionalize), but both are agent proposals awaiting the operator: imported transcripts are retrievable immediately, and extracted invariants land as `status: 'proposed'` only — an agent may put a principle forward from a chat log, never elevate it into the constitutional core (Law XI). The corpus becomes invariant-aware only once the operator ratifies the proposals. Extraction is LLM-driven and text-grounded (no invention), but recall/precision of "what principle does this text embody" is unmeasured — a quality pass is a follow-on.
- **Presence signals for L3/L4 read delegation-grant scopes** and degrade to `pending` where a grant hasn't been issued or the read fails — honest, never faked green.
