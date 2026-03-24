# Aigent Marketa — Phased Implementation Plan (metaKnyt Campaign + CED)

_Drafted: 2026-03-24. Reference doc — commit to repo before or alongside next deployment._

---

## Phase 0 — Foundation (Complete)

- Marketa registered as a full Aigent: `personas.ts`, `agentConfig.ts`, DB personas
- Agent selector pipeline fixed — Marketa activates correctly in runtime and thin client
- Trust/reliability indicators pulse during Marketa inference sessions

---

## Phase 1 — metaKnyt Campaign Activation _(ship first)_

**Goal:** Marketa operational as the outreach and content operator for the KNYT 3,500-investor cohort. No CED architecture required — Marketa uses her core persona and existing platform capabilities.

### 1.1 — Marketa System Prompt Tuning
- Finalize the detailed system prompt (sourced from `MARKETA_CHARTER.md`)
- Add metaKnyt universe context: KNYT characters, episodes, StartEngine campaign narrative, QriptoCent pricing anchors
- Add investor-tier framing: what a StartEngine investor needs to know, how to onboard to iQubes and Registry

### 1.2 — Campaign Content Bundle
- Composer: author the KNYT activation bundle (article + image + summary)
  - Introductory article: "What is metaKnyts and why does it matter for investors?"
  - Character spotlights (Kn0w1, Nakamoto, key KNYT cast) as sub-articles
  - Email / social copy variations for the 3,500-cohort outreach
- Publish to Registry as a campaign iQube with Marketa as the attributed author/operator
- QriptoCent pricing: set service rates for campaign consultation sessions

### 1.3 — Runtime Activation for KNYT Campaign
- Marketa selected as default agent on any KNYT-facing runtime embed
- Welcome prompt tuned: introduce Marketa + invite investor to ask about KNYT, their iQube, or how to get started
- Quick-link prompts: "Who is Kn0w1?", "What is my iQube?", "How do I invest more?", "Redeem QriptoCent"
- Trust indicator baseline: verify Marketa's provider chain (OpenAI/Venice) resolves correctly in all runtime contexts

### 1.4 — QubeTalk Handoff
- Configure Marketa → Kn0w1 handoff for deep lore/universe questions
- Configure Marketa → MoneyPenny handoff for wallet/payment questions
- Confirm handoff prompts work in both runtime and thin client

**Deliverable:** Marketa live as the investor-facing agent for the KNYT campaign, capable of content delivery, consultation, and payment routing.

---

## Phase 2 — CED Framework Integration _(post-campaign launch)_

**Goal:** Wire Cognitive Experience Design primitives into Marketa's operating stack so she moves from reactive Q&A to proactive experience orchestration.

### 2.1 — Experience Strategy Layer
- Define the nine-foci model for KNYT campaign: map each investor touchpoint to one of the nine experience dimensions
- Build the journey matrix schema: `investor_stage × intent_signal → recommended_experience`
- Implement as a structured context block appended to Marketa's system prompt at runtime (sourced from a `ced_config` iQube or DB table — not hardcoded)

### 2.2 — Next-Best-Experience (NBE) Logic
- API route: `/api/marketa/nbe` — accepts current session context, returns ranked next-best experience options
- Inputs: user stage (new/returning/investor), last intent, capsule history, QriptoCent balance
- Output: ordered list of experience recommendations with trigger prompts
- Wire into `handlePrompt` for Marketa sessions: post-inference, append NBE chip(s) to the response if signal is strong enough

### 2.3 — Journey/Engagement Matrix
- Schema: engagement stages (Awareness → Interest → Consideration → Commitment → Advocacy)
- Each stage has: content triggers, Marketa response template, escalation path, QriptoCent settlement offer
- Store in Supabase `ced_journey_matrix` table; read via API at session start

### 2.4 — iQube-Backed Client Profiles
- Marketa creates a `blakQube` for each KNYT campaign engagement: stores session history, declared interests, engagement stage
- Permissioned: client-confidential by default, Marketa-readable for session context
- Registry: list client iQubes as private entries under Marketa's operator handle `marketa@aigent`

### 2.5 — CED Config Commit
- Once 2.1–2.4 are tested on dev: commit the CED schema, migration, and API route to the repo
- Tag: `ced/v0.1-knyt`

---

## Phase 3 — Composer + Content Skill Orchestration _(parallel to Phase 2 or after)_

**Goal:** Marketa autonomously orchestrates article/image/video skill workflows from a single brief.

- **3.1** Marketa brief → Composer session handoff (pass brief as `composerSessionContext`)
- **3.2** Multi-skill bundle: Marketa triggers article + image generation in one session, links outputs as a Registry capsule
- **3.3** QriptoCent settlement: auto-generate a service receipt at bundle completion
- **3.4** Client delivery: publish capsule to client's iQube with access token

---

## Phase 4 — Third-Party Client Ops _(future)_

- Marketa onboards external clients (non-KNYT) via standard engagement intake form → iQube creation → service agreement → QriptoCent escrow
- CED framework applied to each new client: custom nine-foci map, journey matrix, NBE logic per engagement
- Marketa treasury dashboard: track QriptoCent earned per client, per service, per period

---

## Phasing Summary

| Phase | Prerequisite | Status |
|-------|-------------|--------|
| 0 — Foundation | — | Complete ✓ |
| 1 — KNYT Campaign | Phase 0 done ✓ | **Ready to start** |
| 2 — CED Integration | Phase 1 live + KNYT data to calibrate against | After campaign launch |
| 3 — Composer Orchestration | Composer Phase 3/4 done ✓ | Parallel to Phase 2 |
| 4 — Third-party Clients | CED stable, treasury working | After Phase 2+3 |

---

## Related Files

- `docs/marketa/MARKETA_CHARTER.md` — Aigent Marketa Core Charter / Constitution
- `docs/MARKETA_MVP_IMPLEMENTATION_PLAN.md` — Original MVP technical architecture
- `docs/agentiq-marketa-capabilities.json` — Capability manifest
