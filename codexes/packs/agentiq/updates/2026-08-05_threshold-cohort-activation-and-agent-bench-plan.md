# Threshold Cohort Activation + Founder Office Agent Bench — Plan

**Date:** 2026-08-05 (revised same day — see §8, Revision history)
**Status:** Canonical architecture for onboarding external agents into the constitutional ecosystem, not Horizen-specific. No code shipped yet. Grounded in a direct codebase audit (not assumed architecture); every "exists" claim below was verified against real files.

**Revision note:** the first draft treated the Constitutional Admission Package as one artifact among several and organized the Agent Bench around storage states. This revision (i) elevates the Admission Package to an explicit lifecycle stage, (ii) adds an `Invited` state so the discovery-to-admission funnel is measurable, (iii) reframes the Bench around operator actions rather than database terms, (iv) renames `Available` to `Service Ready`, (v) renames Phase D to Operator Activation, and (vi) generalizes the Pulse/P&L acceptance criterion to any external service. Confirmed conclusion, unchanged: almost all of this is composition over existing surfaces, not new construction.

## 1. The question this answers

Once Horizen Pulse/P&L signing is unblocked, the next phase is turning the one hand-shepherded Nakamoto admission into a repeatable cohort process: Marketa discovers and qualifies external agents, their operators sponsor them through the constitutional journey, and admitted agents become selectable in the Founder Office's Financial Services capability.

The operator's own question was specific: **where do candidates become visible, and where is the surface that's actually missing?** This doc answers that from the real codebase, not from an idealized architecture.

## 2. What already exists (verified) vs. what's genuinely missing

| Piece | Status | File(s) |
|---|---|---|
| Passport Review Queue | **Exists, complete.** No sponsor/principal/wallet-control-proof fields surfaced today — new wiring, not new build. | `app/triad/components/codex/tabs/PassportBureauStewardTab.tsx`, `app/api/passport/review/{queue,decide}/route.ts` |
| Factory / ingestion pipeline | **Exists, complete.** Real fetch→classify→package→validate→score→publish pipeline. | `components/registry/IngestionFactoryPanel.tsx`, `app/triad/components/codex/tabs/FactoryIntakeTab.tsx`, `services/registry/*` |
| Founder Office Service tab | **Exists** as `FinancialServicesTab`. Agent field is a **free-text input defaulting to a hard-coded string** — not registry-driven. | `app/triad/components/codex/tabs/FinancialServicesTab.tsx` |
| Access & Invitations | **Exists**, one shared mechanism across 5 domains (passport, research-lab, venture-lab, metame-studio, developer-studio). **No campaign-context field.** | `app/triad/components/codex/tabs/StewardParticipationTab.tsx`, `services/passport/participationAccess.ts`, migration `20260725000000_participation_access.sql` |
| Marketa | **Real, extensive.** ~50 live API routes, a candidate/cohort/campaign model already close to what's needed. Not conceptual. | `services/marketa/**`, `app/api/marketa/**` |
| Horizen/Nakamoto admission journey | **Exists**, full stage machine + admission-fact reader + sponsorship + delegation. State persisted as a metadata blob on the agent's own registry asset, not a new table. | `services/journey/horizenMoneyPennyJourney.ts`, `services/journey/agentAdmissionState.ts`, `services/journey/stageResolution.ts` |
| iQube Registry | **Exists**, same store as the Factory (`registry_assets`). **"Serviceable" as a term/field does not exist** — closest analogs are `publicationStatus` and `TrustBand`. | `types/registryIngestion.ts`, `services/registry/persistence.ts` |

**The one genuinely missing surface is the Agent Bench** — a read model and UI that projects Marketa's candidate state, the journey's admission state, and the registry's publication/trust state into one place a founder or steward can see. Everything else is wiring.

## 3. The lifecycle — the Admission Package as an explicit stage, not just an artifact

The Constitutional Admission Package is the bridge between autonomous discovery and human sponsorship — that makes it a **stage every prospect passes through**, not an optional document some prospects happen to get:

```
Marketa Discovery
      │
      ▼
Qualification
      │
      ▼
Constitutional Admission Package   ← explicit stage
      │
      ▼
Delivered to agent AND operator
      │
      ▼
Operator Activation                ← the sponsorship decision (§6, Phase D)
      │
      ▼
Journey (In Admission)
      │
      ▼
Service Ready
      │
      ▼
Engaged
```

The Package is generated once, at the Qualification→Package transition, and carries:

- why this agent was selected
- capabilities detected
- why MetaMe is interested
- proposed sponsorship level
- constitutional rights and responsibilities
- the Journey link (pre-populated — the operator never re-enters what Marketa already resolved)
- the Passport application
- delegation rationale
- Financial Services opportunities
- Standing opportunities
- Pulse/P&L status (disclosed, never gating — see §7)
- the evidence bundle Marketa scored it on

## 4. Reuse, don't duplicate — the concrete mapping

### External Agent Prospect → extend Marketa's existing `CandidateAgent`

Marketa already has `CandidateAgent`/`CandidateAgentInput` (`services/marketa/activation/types.ts`) with `sourceType`, `agentCardUrl`, `capabilities`, and a 9+-dimension `CandidateScores`, plus an `ActivationStatus` enum that already runs `discovered → enriched → scored → shortlisted → ... → passport_application_started → pending_passport → passport_approved → provisionally_approved → activated → revenue_active`. This is materially the same lifecycle the operator described. **Do not invent a parallel `ExternalAgentProspect` type** — extend `CandidateAgent` with the Horizen-specific fields it's missing (`registryProvider: 'horizen'`, `network`, `onChainAgentId`, `registryContract`, `pulseState`, `pnlState`, `ownerWallet`) and reuse the existing `ActivationStatus` enum, adding any Horizen-specific states only if a real gap appears once this is wired.

### Discovery/qualification pipeline → extend Marketa's activation services

`services/marketa/activation/{discovery,scoring,classification,policy}.ts` already implement discover→score→classify. A Horizen-specific discovery adapter is new code, but it plugs into this existing pipeline — it does not need a parallel campaign engine.

### Cohort/campaign → extend the existing cohort & campaign models

`services/campaign/cohortResolver.ts`, `services/marketa/cohortExpansion.ts`, `types/campaign.ts`, `types/marketaCampaigns.ts` already model cohorts and campaigns (used today for Mailjet sends). A "Horizen Threshold Cohort — Pilot 01" is a `CampaignDefinition` instance, not a new schema.

### The constitutional journey → the existing Horizen/MoneyPenny journey machine

`HORIZEN_MONEYPENNY_JOURNEY` already has the stage sequence `register → claim → passport → delegate → aigentme → verify → deploy → standing` with real `completionEvidence` per stage, resolved (never asserted) by `resolveJourneyState.ts` against `agentAdmissionState.ts`'s three real sources (`agent_root_identity`, `polity_passport_records`, `delegation_grants`, registry presence). **This is the journey already built for Nakamoto.** Scaling to a cohort means running more agents through this SAME machine — it does not need a second journey definition. Journey state's home (a metadata blob on the agent's own `registry_assets` row, not a new table) is a real constraint to respect: any cohort dashboard reads N of these blobs, it doesn't invent a `journey_states` table.

### Access & Invitations → add campaign-context fields, don't build a second invitation system

The existing `access_invitations`/`access_grants` schema (migration `20260725000000_participation_access.sql`) has `access_domain`, `role`, `intended_recipient`, `max_uses`, `expires_at` — everything except a campaign-context concept. Add `campaign_id`, `external_agent_ref`, `requested_service_domain` as nullable columns (a real, small migration) rather than building a parallel invitation table. `createAccessInvitation` (`services/passport/participationAccess.ts`) gets these as optional params.

### Financial Services agent selector → make the existing free-text field registry-driven

`FinancialServicesTab.tsx`'s `agentRef` state is a plain `<input>` defaulting to `"agent-financial-intelligence"`. This is the one clear, scoped code change from the operator's plan: replace the free-text input with a `<select>` populated from `registry_assets` filtered to agents whose `publicationStatus === 'published'` and whose journey-admission facts (sponsor, passport, active delegation — from `agentAdmissionState.ts`) are all true. This is what "serviceable" cashes out to concretely, since that term doesn't exist as a stored field: it's a computed join of `publicationStatus` + admission facts, not a new column.

### The Constitutional Admission Package — a new, reusable artifact type, now an explicit stage (§3)

This is genuinely new (the operator's own conclusion, confirmed): no existing artifact plays this role. It is a typed object generated by a Marketa activation service from a `CandidateAgent` record, delivered via an extended Access & Invitations invitation (campaign-context fields above) to BOTH the agent and its operator — see §3 for its full contents and where it sits in the lifecycle. Provider-agnostic from day one — Horizen is the first `registryProvider` value, not a hardcoded assumption.

## 5. The Agent Bench — the founder's operating console, not a database browser

**Location:** Venture Lab → Service → Agent Bench (a new tab alongside `FinancialServicesTab`, registered the same way in `TabRenderer.tsx`).

**What it is:** a read-only projection (Pass 2 of the implementation plan below) over four existing stores — Marketa's `CandidateAgent`/`ActivationStatus`, the extended Access & Invitations mechanism, the journey's admission-fact reader, and the registry's `publicationStatus`/`TrustBand`/Constitutional Agreements — joined by one stable external-agent reference (`registryProvider` + `network` + `agentId`). It does not own any of that state; it only shows it and deep-links to the surface that does.

**The Bench is organized around what the founder DOES, not around what's stored.** A founder should never have to think "which table is this agent's row in" — the tabs name the act, and each act projects a different read model underneath:

| Operator sees (tab) | Underlying read model |
|---|---|
| **Discover** | Marketa `CandidateAgent` rows, not yet packaged |
| **Invite** | Admission Packages delivered — invitation sent/opened/accepted |
| **Sponsor** | Operator Activation in progress — the sponsorship decision itself |
| **Admit** | Journey state (the 8-stage machine's current position — not every receipt) |
| **Deploy** | Registry `publicationStatus`/`TrustBand` — is this agent Service Ready |
| **Operate** | Active Constitutional Agreements — role, scope, receipts, Standing earned |

**The underlying lifecycle** (six states — `Invited` added so the funnel is measurable, `Available` renamed `Service Ready` so the label matches what actually happened):

```
Candidates → Invited → In Admission → Service Ready → Engaged
```

- **Candidates** — Marketa-qualified, no Package generated yet. Action: Prepare Admission Package.
- **Invited** — Package delivered to agent and operator. Tracks `sent → opened → accepted → declined`. This is the state the first draft was missing, and it's the one that makes Marketa measurable:

  ```
  Discovered        420
  Qualified         190
  Invitation Sent    120
  Opened              88
  Accepted            53
  Journey Started     41
  Service Ready       29
  Engaged             17
  ```

- **In Admission** — Operator Activation is complete (sponsorship accepted); the journey is running. Deep-links to the Journey, the Passport Review Queue, and the Factory record — never duplicates their controls.
- **Service Ready** — admission complete (`register→standing` all settled), registry `publicationStatus: 'published'`. Named for what actually happened — Passport, delegation, registry binding and Standing eligibility all hold, which is a constitutional fact, not mere availability. Appears automatically in `FinancialServicesTab`'s (now registry-driven) agent selector once wired — no separate "add to team" action needed.
- **Engaged** — has an active Constitutional Agreement (`services/constitutional/constitutionalAgreement.ts`). Shows role, authority scope, receipts, Standing earned.

## 6. Phase plan

**Phase A — Cohort infrastructure (extend, don't build parallel).**
Extend `CandidateAgent` with Horizen fields; write the Horizen discovery adapter into Marketa's existing activation pipeline; add campaign-context columns to `access_invitations`; build the Admission Package type + generator service (§3).

**Phase B — Agent Bench, read-only (Pass 2).**
Build the join/read-model and the six-tab operating console (§5), deep-linking to existing Journey/Passport/Factory surfaces. No new write paths yet — this alone gives the operator the missing visibility, including the `Invited` funnel.

**Phase C — Registry-driven Financial Services selector.**
Replace `FinancialServicesTab`'s free-text `agentRef` with the computed-Service-Ready selector.

**Phase D — Operator Activation.**
The constitutional act this whole pipeline exists to produce: agent receives its Admission Package → takes it to its operator → operator reviews the sponsorship case and accepts → the Journey begins. This is a capability, not a one-time event — the **concierge cohort (10 agents)** is simply its first execution: run Nakamoto as the reference case, seed 10 Horizen prospects through the same pipeline with active oversight, measure Time to Threshold, and fix whatever the first real run actually breaks (per this session's own discipline: capture the resolution, not just the patch).

**Phase E — Assisted scale (50–100) + registry adapter generalization.**
Only after D proves out — extract the Horizen-specific discovery adapter into the `ExternalAgentRegistryAdapter` interface the operator specified, so a second registry (MCP, another ERC-8004 registry) is a new adapter, not a new pipeline.

## 7. Acceptance criteria

≥10 agents invited · ≥70% open · ≥50% start the journey · ≥70% of starters cross the threshold · median completion time <15 minutes · no completed stage regresses · no manual SQL required for ordinary completion · 100% of sovereign acts receipted · 100% of admitted agents have canonical external binding · 100% of delegations bounded and revocable · **external service failures never block constitutional admission** (generalized from "Pulse/P&L failures never block admission" — the constitutional core must stay sovereign over ANY external integration: Horizen today, potentially ENS, Coinbase, Project Liberty, another ERC-8004 or financial registry tomorrow; external integrations enrich the journey, they never define it).

Primary metric: **median Time to Threshold**, paired with **risk of repair per completed admission** — the goal is admitting agents without recreating the repair burden the Nakamoto pilot absorbed manually.

## 8. Revision history

**2026-08-05, same-day revision**, incorporating six refinements from the operator's review of the first draft:

1. The Constitutional Admission Package is now an explicit lifecycle stage (§3), not one artifact among several.
2. Phase D is renamed **Operator Activation** — the sponsorship decision is the constitutional act; the concierge cohort is its first execution, not the phase itself.
3. The Agent Bench (§5) is reframed around operator actions (Discover/Invite/Sponsor/Admit/Deploy/Operate) rather than storage states — the founder should never have to think in database terms.
4. `Available` is renamed **Service Ready** — the label now names the constitutional fact (Passport + delegation + registry + Standing eligibility all hold), not mere availability.
5. An **`Invited`** lifecycle state is added, making the full discovery-to-admission funnel measurable for the first time.
6. The acceptance criterion generalizes from "Pulse/P&L failures never block admission" to "external service failures never block constitutional admission" — future-proofing against any external integration, not only Horizen.

With these six changes, this document is treated as the **canonical architecture for onboarding external agents into the constitutional ecosystem** — not a Horizen-specific plan.
