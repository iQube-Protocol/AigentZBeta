# Intent Chain Orchestrator — v1 Close Report

**Status:** v1 shipped on `dev`. 10 commits, ~3300 lines of code + spec + reference template.
**Date:** 2026-06-02
**Spec:** `codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md` (v2 — operator-approved with Q¢ payment + aigentMe orchestrator + Factory Ingestion stub)
**Build branch:** `claude/dreamy-gates-mMqNv` (auto-merged + direct-pushed to `dev` per session)

---

## What was the problem

Operator audit (2026-06-01) found that the metaMe/aigentMe CTA pipeline did **inference + brief drafting** but stopped before **dispatch + chaining**:

- "Ask Marketa for a partner proposal" correctly suggested + composed a Google Doc brief
- Brief landed in Drive (`/api/assistant/create-artifact:1227`) — **but was never submitted to Marketa**
- No follow-up NBA chain was materialized — the user manually had to remember to ship the brief, follow up, etc.

The operator's framing: CTAs should set off a **chain of NBA events that culminate in a desired outcome**.

---

## What shipped

A declarative chain orchestrator with cryptographic provenance + Q¢ economics + UI surfaces. Built on existing primitives — no new infrastructure beyond two Supabase tables.

### Commit roll-up

| # | Commit | Scope |
|---|---|---|
| 1 | `927f459c` | DB migration (`intent_chains` + `intent_chain_feedback`) + types + template registry skeleton + reference template (`marketa.ask-partner-proposal`, 7 steps, $9/run) + `iqube_id_map` extended with `'code:chainTemplate'` source |
| 2 | `375df582` | `sanitizeReceiptMetadata` with T0/T1/T2 enforcement + canary test suite |
| 3 | `43120584` | Dispatcher + advancer + refs (`$nbe.X` / `$prev.X` / `$chain.X` resolution + tiny branch-predicate grammar) + inline listener hook in `emitOrchestrationEvent` |
| 4 | `8b7f98f1` | 7 API routes: dispatch, list, detail, cancel, complete-step, feedback PUT/GET, admin aggregate |
| 5 | `9db46a19` | Missing Marketa intake (`POST /api/marketa/propose`) + Factory Ingestion loader for chain templates (`loadChainTemplateRows`) |
| 6 | `a905e0ed` | Cron extension — scheduled steps + wait timeouts ride the existing `/api/ops/sync/cron-tick` (no new scheduler infrastructure) |
| 7 | `9c15b5db` | Seam wiring in `AigentMeWelcomeSplitTab.tsx:1227` — dispatch chain on CTA approve, advance on artifact create |
| 8 | `5a336253` | `ExpandedNBEPill` chain breadcrumb + `ChainDetailDrawer` (step history + cancel button + like/dislike feedback footer per §6.7) |
| 9 | `0077105d` | `MyWorkspaceTab` clickable intent cards → opens chain detail drawer |
| 10 | _this commit_ | Close report |

### The marketa worked example, end-to-end (post-ship)

```
User clicks CTA "Ask Marketa for a partner proposal" (existing NBE catalog)
  └─ handleApprovalApprove (AigentMeWelcomeSplitTab):
     ├─ POST /api/assistant/intent → IntentQube created (existing)
     ├─ POST /api/intent-chains/dispatch                                 [NEW commit 7]
     │   └─ resolves marketa.ask-partner-proposal template by NBE id
     │   └─ INSERT intent_chains row, charge 900 Q¢ (stub)
     │   └─ emit intent_chain_started + intent_chain_charge_committed
     │       (DVN-receipt-eligible, T0 stripped via sanitizer)
     │   └─ open composer (compose-brief step)
     └─ chainsByIntent[intentId] = chain_id

User writes brief in composer (existing flow)
  └─ handleComposeGoogleDoc:
     ├─ POST /api/assistant/create-artifact → Google Doc in Drive (existing)
     └─ POST /api/intent-chains/[chain_id]/complete-step                 [NEW commit 7]
         └─ advancer.completeUserStep
         └─ emit intent_chain_step_completed (compose-brief)
         └─ transition to submit-to-marketa (rpc kind)
         └─ advanceRpcStep:
             ├─ emit intent_chain_step_dispatched
             ├─ POST /api/marketa/propose                                 [NEW commit 5]
             │   ├─ stub draft of proposal artifact
             │   └─ emit proposal_drafted with chain_id + proposal_artifact_id
             └─ inline listener hook catches proposal_drafted
                 └─ onStepOutcomeObserved → review-proposal (approve kind)
                     └─ emit intent_chain_step_user_pending
                     └─ pill materializes on metaMe with chain breadcrumb [NEW commit 8]

User reviews proposal → clicks "Send to partner"
  └─ POST /api/intent-chains/[chain_id]/complete-step { decision: 'confirm' }
     └─ advance to send-to-partner (rpc)
     └─ POST /api/connectors/execute → Mailjet send
     └─ emit artifact_sent → advance to follow-up-delay (scheduled, 3 days)
     └─ chain.status='waiting', scheduled_advance_at=+3d

Cron tick runs every minute (existing /api/ops/sync/cron-tick)            [extended commit 6]
  └─ tickChainAdvances queries scheduled chains with elapsed delay
  └─ 3 days later: advanceScheduledChain → transition to follow-up-check
     └─ emit intent_chain_step_user_pending
     └─ pill: "No reply from partner — chase or close?"

User clicks chase → send-followup-nudge rpc → artifact_sent
  └─ next: null → chain.status='completed'
  └─ emit intent_chain_completed with total_steps + duration_ms

User opens myWorkspace tab → sees intent card with "↳ chain" hint [NEW commit 9]
  └─ Click → ChainDetailDrawer opens                              [NEW commit 8]
  └─ Step history rendered with timestamps + receipt indicators
  └─ Feedback footer: 👍 Like / 👎 Dislike (with "what didn't work" comment textarea)
  └─ Like = single-click submit; Dislike opens textarea
  └─ PUT /api/intent-chains/[chain_id]/feedback
  └─ emit intent_chain_feedback_recorded (DVN-receipt; comment_present
      bool only — comment text stays in DB for training corpus)
```

Every transition emits a DVN-receipt-eligible orchestration_events row. The K/T anchor cron seals them to BTC within the 15-min audit SLA. The chain is a cryptographically verifiable workflow.

---

## Authority compliance (spec §10)

| Authority | Status |
|---|---|
| Identity spine | Every chain endpoint resolves caller via `getActivePersona`. T0 `initiated_by_persona_id` stored on `intent_chains` row, NEVER in receipt metadata or JSON projections. Explicit column allowlists on every list endpoint's select. |
| Access spine | Q¢ debit at dispatch (v1 stub — wallet integration TODO marked in `dispatcher.ts`). `cost_qc` recorded + `charge_status='committed'` so the receipt shape is correct. NBE authorization (`triggered_by_nbe`) + cartridge scope guards enforced. |
| Orchestrator = **aigentMe** | Server-side dispatcher + advancer act as aigentMe's delegate. Every step transition emits an event the operator can audit. metaMe guardian retains final override (untouched). |
| Resolver | Untouched. Chains operate at a layer above iQube resolution. |
| Receipt plane | All 13 chain event types emit through `emitOrchestrationEvent` with `receipt_eligible: true` and pass through `sanitizeReceiptMetadata` (T0 stripped, T1 transforms applied, T2 preserved). Stage 6 + anchor cron seal them to BTC. |
| Hard delete | Chains are never hard-deleted. Cancel sets `status='cancelled'` + emits receipt; row persists. |

T0/T1/T2 guardrail tests in `tests/sanitize-receipt-metadata.test.ts` — every CLAUDE.md forbidden field stripped at any depth (top, nested, array items), `comment` → `comment_present` bool, `error_message` truncated to 200 chars.

---

## Operator actions required

### 1. Apply the migration (already done per 2026-06-01 confirmation)

`supabase/migrations/20260602100000_intent_chains.sql` — verified by operator via `pg_get_constraintdef` query.

### 2. Set `ORCHESTRATOR_SERVICE_TOKEN` in Amplify

Server-to-server auth for the advancer's RPC calls (currently only `/api/marketa/propose`). Same pattern as `CRON_TRIGGER_TOKEN`:

```bash
openssl rand -hex 32
```

Add to Amplify env vars. Already in the env allowlist (`scripts/create-env-production.js`). A redeploy after setting picks it up.

### 3. (Optional) Seed chain template into registry

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://dev-beta.aigentz.me/api/admin/registry/backfill?source=code:chainTemplate"
```

Expected: 1 record processed, 1 populated (the reference template). After this, `marketa.ask-partner-proposal` shows up in `/registry` Browse with `legacy_primitive_type='WorkflowQube'`.

### 4. Verify end-to-end (after Amplify deploy)

In a browser signed in as a persona with the `marketa.ask-partner-proposal` NBE in their catalog:

1. Click the CTA on metaMe
2. Approve
3. Verify in DevTools Network: `POST /api/intent-chains/dispatch` returns `chain_id`
4. Write a brief in the composer
5. After artifact lands, verify `POST /api/intent-chains/[chain_id]/complete-step` returns the new state
6. Open MyWorkspace tab → the intent card should show "↳ chain"
7. Click → drawer opens with step history
8. Anchor cron continues to advance the chain through the rest of the steps

---

## What's deferred to v1.1 / v1.5+

| Deferred | Why | Surface |
|---|---|---|
| Actual LLM-driven proposal generation in `/api/marketa/propose` | Stub returns marker artifact id. Stub flag (`stub: true` in response) makes the limitation explicit + greppable. | The endpoint accepts the real generator drop-in; just replace the stub block. |
| Wallet Q¢ debit at dispatch | Spec §6.5 — currently records cost + marks committed without ledger write | `dispatcher.ts` — TODO comment marks the seam |
| Intent ↔ chain precise correlation in `MyWorkspaceTab` | List endpoint omits `chain.context` for bandwidth. v1 uses "most recent chain" fallback. | `MyWorkspaceTab.tsx` — small follow-on to fetch context per chain |
| Full canonization of chain templates as iQubes | v1 ships Factory Ingestion stub (templates appear in registry). Full meta+blak+token + governance pending. | Backlog: workstream when third-party authoring lands |
| Sub-chains (chain triggers chain) | Locked OOS per §11 #4. Revisit after ≥3 templates in production. | — |
| Agentic step substitution | Locked OOS — chains stay declarative for v1 | — |
| Chain library browser UI | Operators can only trigger chains via authored CTAs in v1 | — |
| Workflow marketplace + revenue share | `cost_metadata.revenue_share` stub on template; v1 ignores | — |

---

## Files reference

```
supabase/migrations/
  20260602100000_intent_chains.sql                              # 2 tables + RLS + CHECK extension

types/
  intentChains.ts                                               # ChainTemplate, ChainStep, ChainBranch, IntentChainRow, IntentChainView
  orchestration.ts                                              # OrchestrationEventType union extended (13 new events)
  registry-canonical.ts                                         # IQubeIdMapSource extended ('code:chainTemplate')

services/intentChains/
  registry.ts                                                   # load + validate templates from JSON
  dispatcher.ts                                                 # dispatchChain entry point
  advancer.ts                                                   # advanceChainIfNeeded listener + onStepOutcomeObserved
                                                                #   + advanceScheduledChain + timeoutWaitChain
  refs.ts                                                       # $nbe.X / $prev.X / $chain.X resolution + branch eval
  cronAdvance.ts                                                # tickChainAdvances called by /api/ops/sync/cron-tick
  templates/
    marketa.ask-partner-proposal.json                           # reference template (7 steps, $9)

services/orchestration/
  sanitizeReceiptMetadata.ts                                    # T0/T1/T2 enforcement + buildChainReceiptMetadata helper
  orchestrationEvents.ts                                        # listener hook calling advanceChainIfNeeded

services/registry/backfill/
  runBackfill.ts                                                # extended with loadChainTemplateRows + SOURCE_LOADERS map

app/api/intent-chains/
  dispatch/route.ts                                             # POST start a chain
  route.ts                                                      # GET list
  [chain_id]/route.ts                                           # GET detail + history + feedback
  [chain_id]/cancel/route.ts                                    # POST cancel
  [chain_id]/complete-step/route.ts                             # POST user-driven advancement (compose/approve)
  [chain_id]/feedback/route.ts                                  # GET + PUT (efficacy loop)
  feedback/aggregate/route.ts                                   # GET (admin-only template aggregate)

app/api/marketa/
  propose/route.ts                                              # NEW Marketa brief intake (was missing)

app/api/ops/sync/
  cron-tick/route.ts                                            # EXTENDED — now also drives chain advancement

components/metame/cards/
  ExpandedNBEPill.tsx                                           # chainBreadcrumb prop + clickable breadcrumb UI
components/metame/chains/
  ChainDetailDrawer.tsx                                         # NEW — step history + cancel + feedback footer

app/triad/components/codex/tabs/
  AigentMeWelcomeSplitTab.tsx                                   # SEAM — dispatch chain on Act + advance on artifact create
  MyWorkspaceTab.tsx                                            # clickable intent cards open drawer

scripts/
  create-env-production.js                                      # added ORCHESTRATOR_SERVICE_TOKEN to env allowlist

tests/
  sanitize-receipt-metadata.test.ts                             # T0/T1/T2 canary

codexes/packs/agentiq/items/
  AGENTIQ_INTENT_CHAINS_SPEC.md                                 # canonical spec (v2 with operator additions)
codexes/packs/agentiq/updates/
  2026-06-02_intent-chain-orchestrator-v1-close.md              # this report
```

---

## Lines of code (approximate)

- Migration: ~150 LOC SQL
- Types: ~200 LOC
- Services (registry + dispatcher + advancer + refs + cronAdvance): ~1100 LOC
- Sanitizer + tests: ~430 LOC
- API routes (7 chain routes + Marketa propose): ~700 LOC
- UI (ExpandedNBEPill extension + ChainDetailDrawer + MyWorkspaceTab wiring): ~600 LOC
- Reference template: ~100 LOC JSON
- Spec doc: ~900 LOC markdown

Total: ~4200 lines across spec + code + tests, with the spec doc as the canonical contract.

---

## What this enables

Beyond the immediate Marketa worked example, the orchestrator unlocks:

1. **CTAs that survive across agent handoffs.** Today's CTAs ran to one artifact and stopped. Chains keep state across user → Marketa → user → Mailjet → 3-day wait → user — with cryptographic receipts at every transition.

2. **Workflow economics.** `cost_qc` per template + Access spine gating means any chain can be priced. Future: third-party authors publish chains; revenue shares; per-cartridge subscription tiers.

3. **Auditor-defensible automation.** Every state change → DVN-receipt → BTC anchor within K/T policy SLA. Auditor can verify "this chain ran, here's the BTC anchor that seals the proof."

4. **Learning loop.** Like/dislike + dislike-comment corpus on every chain run. v1.5+ workstreams cluster comments per template, surface template-health metrics, feed comments into Aigent Z's per-template tuning. Closed loop.

5. **Sub-chain readiness.** Templates as Factory Ingestion primitives → full iQube canonization → templates become first-class registry citizens with their own provenance + governance. Sub-chains (chain calls chain) becomes natural once a template is an iQube.

---

**End of Intent Chain Orchestrator v1 close report.**

10/10 commits complete. Ready for operator validation in dev.
