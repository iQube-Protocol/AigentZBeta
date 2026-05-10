# metaMe Personal Assistant Alpha — Cold-Start Briefing for the Aigent Me Agent

**Date:** 2026-05-11
**Audience:** Agent picking up the metaMe Personal Assistant Alpha project (a fresh workstream)
**Status:** Foundation ready. Spine (Phase 1–3) closed. KNYT v1+v2 closed. Build Aigent Me on top of these.

You have not seen this codebase. This document is your full cold-start. Read it end-to-end. Don't write a line of code until §10.

---

## 1. What you are building

### Product

**metaMe Personal Assistant** — the user's sovereign personal operating space inside the metaMe Runtime.

### Agent

**Aigent Me** — the user-facing assistant that operates from the **metaMe cartridge**. Aigent Me coordinates the user's daily routines, active goals, tasks, cartridge interactions, approvals, artifacts, and trusted activity receipts.

### What Aigent Me ties together

| Layer | Responsibility | Where it lives |
|---|---|---|
| **Guardian** | Trust, safety, permissions, identifiability, confidentiality | Spine (`services/access/`) — already operational |
| **Runtime** | Sovereign experience canvas | `app/api/aa/v1/runtime/_lib/runtimeShell.ts` — already operational |
| **metaMe cartridge** | User's coordinating command space | NEW — your primary build surface |
| **Studio** | Document, campaign, media, creative production | Existing primitives in `services/studio/`, `app/triad/components/codex/composer/` |
| **Registry / Ingestion Factory** | Composable tools, skills, iQubes, cartridges | Existing — `app/api/registry/`, `services/registry/` |
| **Google Workspace** | Gmail, Calendar, Drive, Docs, Slides | NEW — your build surface (Phase C) |
| **Specialist agents** | Marketa, Quill, Aigent Z, Aigent C, KNYT guide | Existing — `services/orchestration/` |
| **AgentiQ Venture Lab** | KPIs, venture goals, ops progress | Existing — `app/(shell)/marketa/`, `services/campaign/` |
| **iQubes** | Governed context objects | Existing — Phase 2 encryption, Phase 3 receipts already enforce iQube discipline |

### Core proposition (lock this — don't drift)

> Aigent Me turns metaMe into a sovereign personal operating space where users can brief, decide, create, coordinate, and record trusted progress across their cartridge universe.

---

## 2. What is already operational — DO NOT rebuild any of this

### Spine (Phase 1–3, fully shipped)

| Function | What it does |
|---|---|
| `getActivePersona(request)` | Server-side T0 identity resolver. NEVER expose its return value to the browser. |
| `evaluateAccess(persona, descriptor, action)` | Single decision gate. Every gated action must flow through this. |
| `userOwnsAsset(personaId, assetId)` | Ownership check. |
| `GET /api/wallet/active-persona` | Browser-safe T1 surface (HMAC envelope, no T0 ids). |
| `buildCodexUrl(slug, opts)` | Cross-cartridge linking with `personaSessionToken` propagation. |
| `cohortAliasService.computeAliasCommitment` | Real T2 alias commitment for receipts. |
| `emitDecisionReceipt(...)` | Receipt emission — durable + on-chain via Bitcoin ordinal pipeline. |
| `streamStateCPlaintext` | Server-decrypted content delivery for state-C iQubes. |
| `tokenOwnership.{ownsErc721, ownsErc1155}` | ERC-721/1155 ownership checks for token-credential gating. |

### KNYT v1+v2 (fully shipped)

| Function | What it does |
|---|---|
| `engagementService.recordEngagement` | engagement_events → crm_rewards on completion. |
| `referralService.creditQualifiedReferral` | Bring-a-Knight + Herald reward chain. |
| `/api/wallet/tasks/share-link` | Per-persona referral code mint via HMAC. |
| `/api/referral/resolve-code` | Reverse lookup at signup. |
| `/api/wallet/knyt/rewards/redeem` | Spine-gated claim → DVN credit. |
| Wallet drawer Tasks tab | Surfaces task cards with action buttons. |
| Order HUD QuestRail | Single active-task panel. |
| `KnytLivingCanonTemplate` | 21 Sats branch UI + submission shell. |

### What this means for you

When Aigent Me needs to:
- **resolve who's logged in** → call `getActivePersona`
- **gate any action** → call `evaluateAccess` — never write a parallel gate
- **emit a receipt for any decision** → call `emitDecisionReceipt`
- **read or deliver iQube content** → call `streamStateCPlaintext`
- **link across cartridges** → use `buildCodexUrl`
- **reward the user for completing something** → fire `engagementService.recordEngagement`
- **track a referral or share link** → reuse the KNYT pattern (see §6.b)

You build on top of these. You do not reimplement them. CLAUDE.md § Identity & Access Spine — CANONICAL SoT lists the files locked behind operator approval — extend by composition, not forking.

---

## 3. Required reading before any code lands

In this exact order. Don't skim — these are the contract.

### Spine workstream (mine)

1. `CLAUDE.md` § Identity & Access Spine — CANONICAL SoT (top of file, marked PARAMOUNT)
2. `codexes/packs/agentiq/updates/2026-05-09_spine-integration-brief-knyt-rep-rewards-tasks.md` — the integration brief; written for KNYT but every consumer follows it
3. `codexes/packs/agentiq/updates/2026-05-08_phase-1-iam-spine-closure.md` — Phase 1 closure
4. `codexes/packs/agentiq/updates/2026-05-09_phase-2-encryption-decisions.md` — Phase 2 decisions
5. `codexes/packs/agentiq/updates/2026-05-10_phase-3-closure.md` — Phase 3 closure (alias-anchored receipts)
6. `codexes/packs/agentiq/updates/2026-05-10_post-phase-3-workplan-deferred.md` — the spine workplan that's deferred

### KNYT workstream (the agent before you)

7. `codexes/packs/agentiq/updates/2026-05-10_knyt-rep-rewards-tasks-decisions.md` — KNYT v1 decisions
8. `codexes/packs/agentiq/updates/2026-05-10_knyt-rep-rewards-tasks-closure.md` — KNYT v1 closure
9. `codexes/packs/agentiq/updates/2026-05-10_knyt-tasks-operationalization-backlog.md` — KNYT v2 ops
10. `codexes/packs/agentiq/updates/2026-05-11_knyt-v2-polish-final-two-items.md` — KNYT v2 polish closure

### Type contracts (read 100%)

11. `types/access.ts` — full identity / access / receipt types
12. `types/orchestration.ts` — agent role + event types
13. `types/persona.ts` — persona + FIO types

### Surface code (skim, don't deep-read)

14. `services/identity/getActivePersona.ts`
15. `services/access/evaluateAccess.ts`
16. `services/access/policyResolvers.ts`
17. `services/access/receiptEmitter.ts`
18. `services/orchestration/orchestrationEvents.ts`
19. `services/rewards/engagementService.ts`
20. `services/rewards/referralService.ts`
21. `app/api/aa/v1/runtime/_lib/runtimeShell.ts` — runtime menu + Be-label substitution
22. `app/triad/components/codex/tabs/KnytTab.tsx` — task-card pattern (your model for metaMe tabs)
23. `app/triad/components/codex/liquidTemplates/KnytLivingCanonTemplate.tsx` — `__knytPendingTaskSlug` consumer pattern (your model for cross-cartridge deep links)

---

## 4. Architecture proposal — how Aigent Me layers on existing primitives

### 4.a Identity (locked by spine)

Aigent Me is **not** a persona. Aigent Me is an **agent**, distinct from the user's persona. The spine's `ActivePersonaContext` is the user identity; Aigent Me is the agent acting on the user's behalf.

```
                                ┌────────────────┐
   user signs in                │ ActivePersonaContext (T0)
                                │   personaId
                                │   identifiability
                                │   cohortMemberships
                                └────────┬───────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │ Aigent Me            │  ← acts ON BEHALF of persona
                              │   declares: 'pseudo' │
                              │   actor type: agent  │
                              └──────┬───────────────┘
                                     │
                          identifiability floor clamp
                          (most-restrictive of agent/user)
                                     │
                                     ▼
                          evaluateAccess(persona, descriptor, action)
```

Aigent Me must register in the agent registry and declare its own identifiability. The spine's existing clamp (already in `getActivePersona`) ensures receipts attribute via the most-restrictive level when an agent acts on behalf of a human.

### 4.b Surface — the metaMe cartridge

Build the metaMe cartridge as a sibling to KNYT in `app/triad/components/codex/`. Use `KnytTab.tsx` as the structural model — same template engine, same auto-tab-switch deep-link pattern, same wallet drawer integration.

Suggested initial tabs (decisions-doc them first):

| Tab slug | Purpose |
|---|---|
| `home` | Daily briefing — today's calendar, top emails needing decision, top tasks, top approvals |
| `routines` | Recurring user routines (morning brief, weekly review, etc.) |
| `goals` | Active goals with progress signals |
| `tasks` | Consolidated tasks across all cartridges (KNYT, future cartridges) |
| `approvals` | Guardian-gated actions awaiting consent |
| `artifacts` | Generated outputs (Studio docs, campaigns, etc.) |
| `receipts` | Trusted activity log — every Aigent Me decision with on-chain attribution |

### 4.c Trust / safety — Guardian integration

Every Aigent Me action that touches user data, sends a message, or commits a value transfer goes through `evaluateAccess` with the appropriate action class. Guardian's veto path is `policy-blocked` reason on the AccessDecision.

Example action mapping:

| Aigent Me action | evaluateAccess action class |
|---|---|
| Read calendar event | `read` |
| Read email thread | `read` |
| Send email on user's behalf | `transfer` (tx-class — FIO required) |
| Schedule meeting | `transfer` (tx-class) |
| Compose Studio doc | `invoke` |
| Publish doc to registry | `mint` (tx-class) |
| Approve a queued action | `policy-escalation` (sync-receipt-required) |

### 4.d Content access — iQube wrapping

Every artifact Aigent Me touches becomes a **governed context object** (an iQube). For Phase 2 (Google connectors), this means:

- Reading an email thread = creating an in-memory iQube descriptor for the thread
- Reading a calendar event = same
- Storing a Drive file reference = same
- The user's daily briefing IS an iQube — composed at request time, gated by `evaluateAccess('read')`

Use the existing `getContentDescriptor` pattern; don't create a parallel one.

### 4.e Receipts — every decision is auditable

Every Aigent Me decision — every email read, every calendar slot scheduled, every artifact composed — emits an OrchestrationEvent through `emitDecisionReceipt`. Phase 3.4's batcher inscribes them on Bitcoin via the cross_chain_service canister. The `actor_alias_commitment` is the spine's T2 attribution — the user is provably the actor without exposing personaId.

This gives the user a **trusted activity log** as a first-class product feature, not a developer afterthought.

### 4.f Specialist routing

Aigent Me is the **router**, not the implementer. When the user asks for something Marketa / Quill / Aigent Z / Aigent C / KNYT guide handles better, Aigent Me dispatches.

The dispatch contract is already in `services/orchestration/orchestrationService.ts` (handover via `OrchestrationEvent.from_role` / `to_role`). You consume this; you don't extend it.

### 4.g Studio + Registry composition

When Aigent Me needs to produce something (a campaign brief, a slide deck, a registry-grade iQube), it launches Studio with a typed input context and reads the result back. Studio's existing `services/studio/` primitives handle the production; Aigent Me handles the brief and review.

### 4.h Google Workspace — new connectors (Phase C)

This is the only piece of the Aigent Me stack that doesn't already have an existing primitive. You'll need:

- OAuth flow (server-side, refresh-token-aware)
- Token storage (encrypted using `services/content/encryption.ts` — DON'T fork)
- Connector services per Google API (Gmail, Calendar, Drive, Docs, Slides)
- Each connector emits a receipt on every read via `emitDecisionReceipt('read')`

Token custody decision is critical (see §6.a).

---

## 5. What's already built that you reuse — full cross-reference

### Identity / Access
- `services/identity/getActivePersona.ts` — caller resolution
- `services/identity/cohortAliasService.ts` — T2 commitment
- `services/access/evaluateAccess.ts` — gate
- `services/access/policyResolvers.ts` — credential routing
- `services/access/receiptEmitter.ts` — receipt emission
- `services/access/tokenOwnership.ts` — ERC-721/1155 ownership
- `services/identity/personaAddressResolver.ts` — persona → chain address

### Content
- `services/content/encryption.ts` — AES-256-GCM with HKDF
- `services/content/stateCDelivery.ts` — server-decrypted streams
- `services/content/getContentDescriptor.ts` — descriptor builder

### Rewards / Engagement / Referrals
- `services/rewards/engagementService.ts` — engagement_events
- `services/rewards/referralService.ts` — Bring-a-Knight + Herald
- `app/api/wallet/tasks/share-link/route.ts` — per-persona code mint
- `app/api/referral/resolve-code/route.ts` — reverse lookup
- `app/api/referral/process/route.ts` — link recording
- `app/api/wallet/knyt/rewards/redeem/route.ts` — claim flow

### Orchestration
- `services/orchestration/orchestrationEvents.ts` — event emission
- `services/orchestration/orchestrationService.ts` — agent handover
- `services/orchestration/agentVoices.ts` — agent identity registry
- `services/orchestration/journeyTelemetry.ts` — journey-stage tracking

### Cartridge surfaces (your model)
- `app/triad/components/codex/tabs/KnytTab.tsx` — full cartridge tab pattern
- `app/triad/components/codex/liquidTemplates/registry.ts` — template engine
- `app/triad/components/codex/liquidTemplates/KnytLivingCanonTemplate.tsx` — deep-link consumer pattern

### Wallet drawer integration
- `app/components/content/SmartWalletDrawer.tsx` — task surface (read it; the new metaMe cartridge ties into the same drawer)

---

## 6. Decisions you need from the operator BEFORE writing code

### a. Google Workspace token custody

| Option | Pros | Cons |
|---|---|---|
| Per-persona row in `personas.google_tokens` (encrypted via Phase 2 lib) | Simplest; reuses existing encryption | Token rotation needs migration |
| Separate `google_tokens` table (encrypted, FK to persona_id) | Clean separation; rotation friendly | New table + RLS policies |
| KMS-backed token storage | Highest trust | Phase 4-style infra; not in current scope |

Default recommendation: separate table with Phase 2 encryption. Make the call before Phase C starts.

### b. OAuth scope set (read-only vs read-write)

Read-only is the conservative start. Read-write requires `evaluateAccess('transfer')` gating + Guardian approval queue. Pick before §C.0.

### c. Aigent Me persona model

| Option | Description |
|---|---|
| Singleton agent | One `aigent-me` declared once in agent registry; all users share the agent identity, distinguished by the persona it acts on behalf of |
| Per-user instance | Each user has their own `aigent-me-<personaId>` instance — more invasive, more receipts complexity |

Singleton is cheaper and cleaner. Pick before §A.2.

### d. Specialist routing taxonomy

Which intent classes route to which specialist?

```
brief / draft a doc       → Quill (composition specialist)
schedule / book / send    → Aigent Me (direct, with Guardian veto)
campaign / cohort outreach → Marketa
KNYT lore / quest help    → KNYT guide
crypto / chain tx help    → Nakamoto
ambiguous                 → Aigent Z (orchestrator)
```

Operator confirms or amends before §D.1.

### e. Trust gating — what requires Guardian approval

| Action | Guardian gate? |
|---|---|
| Read calendar | No |
| Send email | YES — async approval queue |
| Schedule on user's behalf | YES |
| Compose Studio doc | No |
| Publish to registry | YES |
| Cross-cartridge token transfer | YES — already enforced by spine |

Operator confirms boundary.

### f. Cartridge command vs in-cartridge surface

Does Aigent Me appear:
- Globally (always-on copilot in every cartridge)?
- Only inside the metaMe cartridge?
- Both, but with different scopes?

Recommendation: **Both**, with the metaMe cartridge as the home base + a global Aigent Me copilot button (similar to the existing CodexCopilotLayer). Decide before §A.1.

### g. iQube wrapping policy for Google artifacts

Every Google artifact (email, event, file) wrapped as iQube on first read?
- Pro: full receipt trail; user owns the artifact's metadata sovereignly
- Con: heavier write path; storage cost

Or: iQube wrapping only on user opt-in (e.g. "remember this for me")?

Operator's call.

---

## 7. Phased build plan — 6 phases, surgical commits per phase

Each phase ends with a closure doc in `codexes/packs/agentiq/updates/`. Each commit is a single decision/file/symptom — same surgical-change protocol as the spine and KNYT workstreams.

### Phase A — Foundation (no Google yet)

| # | Step | Deliverable |
|---|---|---|
| A.0 | Decisions doc | All §6 decisions locked in `2026-05-XX_metame-aigent-me-decisions.md` |
| A.1 | metaMe cartridge bootstrap | Skeleton tabs (home / routines / goals / tasks / approvals / artifacts / receipts) following KnytTab pattern |
| A.2 | Aigent Me agent identity | Registers in `services/orchestration/agentVoices.ts`; declared identifiability per §6.c |
| A.3 | Guardian integration | `evaluateAccess` action class extension if needed; approvals queue model + table |

### Phase B — Daily routines + Tasks

| # | Step | Deliverable |
|---|---|---|
| B.1 | Routines tab | Recurring routines (morning brief, weekly review) with cron integration |
| B.2 | Active Goals tab | User goals with progress signals; reuses engagementService for tracking |
| B.3 | Tasks consolidation | Cross-cartridge task aggregation; pulls from KNYT + future cartridges |
| B.4 | Approvals queue | Guardian-required actions surfaced for user consent |

### Phase C — Google Workspace integration

| # | Step | Deliverable |
|---|---|---|
| C.0 | OAuth + scope decisions | Locked from §6.a + §6.b |
| C.1 | Read-only connectors | Gmail / Calendar / Drive metadata reads |
| C.2 | Write connectors | Gated via `evaluateAccess('transfer')` + Guardian approval queue |
| C.3 | iQube wrapping | Per §6.g policy |

### Phase D — Specialist coordination

| # | Step | Deliverable |
|---|---|---|
| D.0 | Routing taxonomy locked | Per §6.d |
| D.1 | Aigent Me as router | Intent classifier → dispatch via OrchestrationEvent |
| D.2 | Receipt on every dispatch | Per the spine integration brief |

### Phase E — Studio + Registry integration

| # | Step | Deliverable |
|---|---|---|
| E.1 | Aigent Me launches Studio | Brief → Studio → review → user approves |
| E.2 | Aigent Me reads Registry | Available iQubes + cartridges surfaced |
| E.3 | Composition flow | brief → studio → review → publish |

### Phase F — Venture Lab progress

| # | Step | Deliverable |
|---|---|---|
| F.1 | KPI dashboard | Existing canvases surfaced in metaMe |
| F.2 | Active venture goals | With on-chain progress receipts |

### Closure

After each phase, write a closure doc capturing:
- What shipped
- What's deferred (with reasoning)
- The verification queries / smoke tests
- The remaining backlog

Same pattern as the spine's `2026-05-10_phase-3-closure.md`.

---

## 8. Hard rules — lifted directly from the spine + KNYT briefs

| Don't | Why |
|---|---|
| Don't fork `getActivePersona`, `evaluateAccess`, `evaluateAccess`, `cohortAliasService`, `emitDecisionReceipt` | These are the canonical contract — CLAUDE.md PARAMOUNT |
| Don't put `personaId` / `authProfileId` / `rootDid` / `kybeAttestation` in browser-bound JSON or chain-bound receipts | T0 leak — privacy contract violation, breaks compliance |
| Don't bypass `evaluateAccess` for any Aigent Me action that touches user data, value, or shared state | Single decision authority — that's the whole point |
| Don't store Google tokens unencrypted | Use `services/content/encryption.ts`. Period. |
| Don't write a parallel orchestration / handover system | Use `OrchestrationEvent` + the existing routing in `services/orchestration/` |

---

## 9. Coordination — you are not alone in the codebase

The spine team (me) has just shipped. The KNYT agent has just shipped. Both will continue to land work. Two rules:

1. **Don't modify these without operator approval:**
   - `services/identity/`
   - `services/access/` (entire directory)
   - `services/content/encryption.ts`
   - `services/content/stateCDelivery.ts`
   - `services/orchestration/orchestrationEvents.ts`
   - `services/orchestration/orchestrationService.ts`
   - `types/access.ts`
   - `types/orchestration.ts`
   - `services/rewards/engagementService.ts`
   - `services/rewards/referralService.ts`
   - `app/triad/components/codex/tabs/KnytTab.tsx`

2. **Announce shared-file edits via QubeTalk bridge** — see CLAUDE.md § QubeTalk Bridge. Especially for `app/components/content/SmartWalletDrawer.tsx`, `CLAUDE.md` itself, and any persona-row schema migration.

---

## 10. Suggested first commit

**Don't start coding feature work yet.** First commit = decisions doc.

Path: `codexes/packs/agentiq/updates/2026-05-XX_metame-aigent-me-decisions.md`

Document the answers to all §6 decisions (operator-confirmed). Pre-register in `codexes/packs/agentiq/collections.json` under `col_updates`. Push, get operator review, then start §A.1.

This pattern (decisions-doc-first) prevents schema/contract drift and matches how the spine + KNYT teams shipped without surprises.

---

## 11. Smoke test before any merge

Per CLAUDE.md, the spine smoke gate must pass:

```bash
node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
  --personaId=<a-persona-you-own> \
  --owned=<an-asset-the-persona-owns> \
  --txGuard=<an-asset-id>
```

If you've added new spine surface area (new action class, new credential type, new descriptor state), extend `verify-spine.mjs` rather than building parallel verification.

---

## 12. Branch convention + push rules

Branch off `dev` after `git pull`. Push your work to `claude/<your-session-suffix>` for the auto-merge to dev → Amplify deploy. CLAUDE.md § Push Commit Messages MANDATORY applies — every push commit message names the actual content being pushed.

Don't push directly to `dev` or `main`. The auto-merge workflow handles `claude/**` → `dev` for you.

---

## 13. TL;DR for the agent picking this up cold

1. Read the 23 docs/files listed in §3 in order
2. Get operator answers on the 7 decisions in §6
3. First commit = decisions doc, not code
4. Build on top of spine + KNYT primitives (don't rebuild — §5 lists what exists)
5. Phases A through F (§7), each closing with a closure doc
6. Run `verify-spine.mjs` before every merge
7. Don't touch the locked files in §9 without operator approval
8. T0 ids stay server-side; receipts attribute via T2; surface T1 to browsers

The spine and KNYT workstreams have proven this pattern. Aigent Me follows it. The product is sovereign by construction — every decision auditable, every artifact governed, every action gated. That's metaMe.

---

## Appendix A — Quick architecture diagram

```
                              USER (via metaMe Runtime)
                                       │
                                       ▼
                    ┌──────────────────────────────────────┐
                    │ metaMe cartridge tabs                │
                    │ (home / routines / goals / tasks /   │
                    │  approvals / artifacts / receipts)   │
                    └─────────────────┬────────────────────┘
                                      │
                                      ▼
                          ┌───────────────────────┐
                          │   Aigent Me (router)  │
                          └───────┬───────────────┘
                                  │
        ┌───────────────┬─────────┼────────────┬───────────────────┐
        │               │         │            │                   │
        ▼               ▼         ▼            ▼                   ▼
   Quill (compose)  Marketa  Aigent Z    KNYT guide        Specialists
                    (campaign) (orchestrator)   (lore)
        │               │         │            │                   │
        └───────────────┴─────────┼────────────┴───────────────────┘
                                  │
                                  ▼
                        ┌──────────────────────┐
                        │  evaluateAccess      │  ← single gate
                        │  (Guardian veto)     │
                        └──────┬───────────────┘
                               │
                  ┌────────────┼─────────────┐
                  ▼            ▼             ▼
             Studio      Registry      Google Workspace
             (compose)   (iQubes)      (Gmail/Cal/Drive)
                  │            │             │
                  └────────────┴─────────────┘
                               │
                               ▼
                   emitDecisionReceipt
                   (alias-anchored, on-chain)
                               │
                               ▼
                   Trusted activity log
                   (visible in metaMe → receipts tab)
```

---

## Appendix B — Operator setup checklist

Before kickoff:

- [ ] Confirm new agent has read this doc end-to-end
- [ ] Confirm new agent has read the 23 dependent docs/files in §3
- [ ] Make the 7 decisions in §6 (or schedule a session to do so)
- [ ] Provision Google Workspace OAuth client (Phase C requires this)
- [ ] Decide token custody approach (§6.a)
- [ ] Confirm cartridge surface scope (§6.f)
- [ ] Confirm Guardian gating boundary (§6.e)
- [ ] Add the new agent's session branch to QubeTalk bridge so they can coordinate

When ready, the agent's first task is the decisions doc (§10), not code.
