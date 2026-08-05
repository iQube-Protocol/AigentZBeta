# Threshold Cohort Activation + Founder Office Agent Bench — Plan

**Date:** 2026-08-05
**Status:** Planning document — no code shipped yet. Grounded in a direct codebase audit (not assumed architecture); every "exists" claim below was verified against real files.

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

## 3. Reuse, don't duplicate — the concrete mapping

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

### The Constitutional Admission Packet — a new, reusable artifact type

This is genuinely new (the operator's own conclusion, confirmed): no existing artifact plays this role. It should be a typed object (agent-facing rationale + operator-facing sponsorship case + evidence bundle + pre-populated journey link), generated by a Marketa activation service from a `CandidateAgent` record, and delivered via an extended Access & Invitations invitation (campaign-context fields above). Provider-agnostic from day one — Horizen is the first `registryProvider` value, not a hardcoded assumption.

## 4. The Agent Bench — the one new surface

**Location:** Venture Lab → Service → Agent Bench (a new tab alongside `FinancialServicesTab`, registered the same way in `TabRenderer.tsx`).

**What it is:** a read-only projection (Pass 2 of the implementation plan below) over three existing stores — Marketa's `CandidateAgent`/`ActivationStatus`, the journey's admission-fact reader, and the registry's `publicationStatus`/`TrustBand` — joined by one stable external-agent reference (`registryProvider` + `network` + `agentId`). It does not own any of that state; it only shows it and deep-links to the surface that does.

**Four views**, matching the discoverable → admissible → serviceable distinction:

- **Candidates** — Marketa-qualified, not yet invited or in-journey. Actions: Prepare Constitutional Admission Packet, Dismiss.
- **In Admission** — journey started. Shows the 8-stage machine's current position only (not every receipt). Actions deep-link to the Journey, the Passport Review Queue, and the Factory record — never duplicate their controls.
- **Available** — admission complete (`register→standing` all settled), registry `publicationStatus: 'published'`. Action: appears automatically in `FinancialServicesTab`'s (now registry-driven) agent selector — no separate "add to team" action needed once that selector is wired.
- **Engaged** — has an active Constitutional Agreement (`services/constitutional/constitutionalAgreement.ts`). Shows role, authority scope, receipts, Standing earned.

## 5. Phase plan

**Phase A — Cohort infrastructure (extend, don't build parallel).**
Extend `CandidateAgent` with Horizen fields; write the Horizen discovery adapter into Marketa's existing activation pipeline; add campaign-context columns to `access_invitations`; build the Constitutional Admission Packet type + generator service.

**Phase B — Agent Bench, read-only (Pass 2).**
Build the join/read-model and the four-view UI, deep-linking to existing Journey/Passport/Factory surfaces. No new write paths yet — this alone gives the operator the missing visibility.

**Phase C — Registry-driven Financial Services selector.**
Replace `FinancialServicesTab`'s free-text `agentRef` with the computed-serviceable selector.

**Phase D — Concierge cohort (10 agents).**
Run Nakamoto as the reference case, seed 10 Horizen prospects through the same pipeline with active oversight; measure Time to Threshold; fix whatever the first real cohort run actually breaks (per this session's own discipline: capture the resolution, not just the patch).

**Phase E — Assisted scale (50–100) + registry adapter generalization.**
Only after D proves out — extract the Horizen-specific discovery adapter into the `ExternalAgentRegistryAdapter` interface the operator specified, so a second registry (MCP, another ERC-8004 registry) is a new adapter, not a new pipeline.

## 6. Acceptance criteria (carried from the operator's own list, unchanged)

≥10 agents invited · ≥70% open · ≥50% start the journey · ≥70% of starters cross the threshold · median completion time <15 minutes · no completed stage regresses · no manual SQL required for ordinary completion · 100% of sovereign acts receipted · 100% of admitted agents have canonical external binding · 100% of delegations bounded and revocable · Pulse/P&L failures never block admission.

Primary metric: **median Time to Threshold**, paired with **risk of repair per completed admission** — the goal is admitting agents without recreating the repair burden the Nakamoto pilot absorbed manually.
