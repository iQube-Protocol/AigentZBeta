# Intent Chain Orchestrator — Spec

**Status:** Draft v1. Awaiting operator confirmation before build.
**Date:** 2026-06-01
**Owners:** Aigent Z + metaMe + Marketa workstream.
**Triggered by:** Audit finding (2026-06-01) — CTAs generate briefs but never dispatch to actor agents; no follow-up NBA chains are materialized. Diagnostic: `app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx:1227`.

The goal: turn a CTA from a one-shot brief into a stateful multi-step workflow with cryptographic provenance — every state-changing step emits a DVN-receipt-eligible orchestration event so the chain's history is anchored to BTC alongside the rest of the canonical plane.

---

## 1. Architecture overview

A CTA is the **entry point** to a **chain template**. A chain template is a declarative DAG of steps; each step has a target actor, an expected outcome event, and a `next` reference. Chain instances live in a thin `intent_chains` table; per-step state is reconstructable from `orchestration_events` filtered by `chain_id`.

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks CTA pill "Ask Marketa for partner proposal"        │
│                              │                                  │
│                              ▼                                  │
│  POST /api/intent-chains/dispatch { template_id }               │
│    ├── lookup template (services/intentChains/templates/*.json) │
│    ├── INSERT intent_chains row (chain_id, current_step_id=0)   │
│    ├── EMIT 'intent_chain_started' (DVN-eligible)               │
│    └── execute step 0 (kind=compose → return UI cue to client)  │
│                              │                                  │
│                              ▼                                  │
│  User writes brief in composer (existing path)                  │
│  Brief artifact lands → POST /api/intent-chains/advance         │
│    ├── EMIT 'intent_chain_step_completed' (DVN-eligible)        │
│    ├── lookup next step (kind=rpc, endpoint=/api/marketa/propose)│
│    ├── EMIT 'intent_chain_step_dispatched' (DVN-eligible)       │
│    ├── server-side fetch → Marketa drafts proposal              │
│    ├── EMIT 'intent_chain_step_completed' (DVN-eligible)        │
│    └── advance to step 2 (kind=approve → materialize NBA pill)  │
│                              │                                  │
│                              ▼                                  │
│  User sees new pill on metaMe: "Review Marketa's proposal"      │
│  ... pattern repeats until terminal step                        │
│                              │                                  │
│                              ▼                                  │
│  EMIT 'intent_chain_completed' (DVN-eligible) — anchor seals    │
└─────────────────────────────────────────────────────────────────┘
```

**Authority alignment (PRD v1.0 §3):**

| Authority | Role in chain orchestrator |
|---|---|
| Identity spine | Caller resolution on every chain endpoint via `getActivePersona` |
| Access spine | Gates which CTAs a user can start (existing nbeCatalog persona filter) |
| Orchestrator | Decides chain dispatch + step advancement — NEW |
| DVN | Receives one receipt per state-changing event via existing Stage 6 plumbing |
| BTC anchor | Seals chain history via existing K/T policy (no chain-specific anchor logic) |

The orchestrator is the only new authority. Everything else is reuse.

---

## 2. Chain template format

Templates live as JSON files under `services/intentChains/templates/`. Loaded once at startup into an in-memory registry keyed by `template_id`.

```typescript
interface ChainTemplate {
  id: string;                          // e.g. "marketa.ask-partner-proposal"
  label: string;                       // human-readable, surfaced in UI
  description: string;                 // optional long-form
  cartridge_scope?: string[];          // restrict to cartridges (e.g. ['venture-lab'])
  triggered_by_nbe?: string[];         // nbeIds that can dispatch this chain
  steps: ChainStep[];
  on_failure?: 'halt' | 'continue';    // default 'halt' — chain enters 'failed' status
  receipt_eligible: boolean;           // default true — every step emits a DVN receipt
}

interface ChainStep {
  id: string;                          // unique within template; numeric or slug
  label: string;                       // surfaced as pill breadcrumb "Step 2: Review proposal"
  actor: 'user' | 'marketa' | 'aigent-c' | 'aigent-z' | 'moneypenny' | 'system';
  kind: 'compose' | 'rpc' | 'approve' | 'scheduled' | 'wait';

  // For kind='compose' (user-facing): client opens composer overlay
  composer?: {
    kind: 'doc' | 'email' | 'slack' | 'note';
    seed_prompt_ref?: string;          // path into prior steps' outputs
  };

  // For kind='rpc' (server-side dispatch): orchestrator calls the endpoint
  rpc?: {
    endpoint: string;                  // e.g. "/api/marketa/propose"
    method?: 'POST' | 'PUT' | 'PATCH'; // default POST
    body_from?: 'prev_artifact' | 'chain_context' | 'static';
    body_static?: Record<string, unknown>;
    expected_outcome_event_type: OrchestrationEventType;
                                       // listener key
  };

  // For kind='approve' (user-facing): NBA pill rendered with artifact
  approve?: {
    artifact_ref: string;              // e.g. "$prev.proposal_artifact_id"
    confirm_label: string;             // e.g. "Send to partner"
    reject_label: string;              // e.g. "Revise"
    on_reject_next?: string;           // step_id to re-route to on reject
  };

  // For kind='scheduled': cron-tick advances when delay elapses
  scheduled?: {
    delay: { value: number; unit: 'minutes' | 'hours' | 'days' };
    materialize_as: 'nba' | 'silent';  // 'nba' surfaces a pill; 'silent' just advances
  };

  // For kind='wait': passive — listener fires advance when matching event lands
  wait?: {
    expected_outcome_event_type: OrchestrationEventType;
    timeout?: { value: number; unit: 'hours' | 'days' };
    on_timeout_next?: string;          // step_id to route to on timeout
  };

  // Common
  next: string | null;                 // next step_id; null = terminal
  branches?: ChainBranch[];            // optional decision logic
  receipt_metadata_keys?: string[];    // keys to copy from chain context into receipt metadata
}

interface ChainBranch {
  if: string;                          // predicate, e.g. "outcome.proposal_drafted"
  next: string;                        // step_id
  terminate?: boolean;                 // alternative to next; ends chain
}
```

**Template validation** runs at startup. Invalid templates (cycles, dangling next refs, missing required fields per kind) refuse to load and log a CloudWatch warning.

---

## 3. Reference template — `marketa.ask-partner-proposal`

```json
{
  "id": "marketa.ask-partner-proposal",
  "label": "Ask Marketa for a partner proposal",
  "description": "End-to-end partner outreach chain: user composes brief → Marketa drafts proposal → user reviews + sends → 3-day follow-up.",
  "cartridge_scope": ["venture-lab", "agentiq-knyt"],
  "triggered_by_nbe": ["marketa.ask-partner-proposal"],
  "receipt_eligible": true,
  "on_failure": "halt",
  "steps": [
    {
      "id": "compose-brief",
      "label": "Compose partner brief",
      "actor": "user",
      "kind": "compose",
      "composer": {
        "kind": "doc",
        "seed_prompt_ref": "$nbe.handoffHint"
      },
      "next": "submit-to-marketa",
      "receipt_metadata_keys": ["artifact_id", "title"]
    },
    {
      "id": "submit-to-marketa",
      "label": "Submit brief to Marketa for proposal",
      "actor": "marketa",
      "kind": "rpc",
      "rpc": {
        "endpoint": "/api/marketa/propose",
        "method": "POST",
        "body_from": "prev_artifact",
        "expected_outcome_event_type": "proposal_drafted"
      },
      "next": "review-proposal",
      "receipt_metadata_keys": ["brief_artifact_id", "proposal_artifact_id"]
    },
    {
      "id": "review-proposal",
      "label": "Review Marketa's proposal",
      "actor": "user",
      "kind": "approve",
      "approve": {
        "artifact_ref": "$prev.proposal_artifact_id",
        "confirm_label": "Send to partner",
        "reject_label": "Revise with Marketa",
        "on_reject_next": "submit-to-marketa"
      },
      "next": "send-to-partner",
      "receipt_metadata_keys": ["proposal_artifact_id", "decision"]
    },
    {
      "id": "send-to-partner",
      "label": "Send proposal to partner",
      "actor": "marketa",
      "kind": "rpc",
      "rpc": {
        "endpoint": "/api/connectors/execute",
        "method": "POST",
        "body_from": "chain_context",
        "body_static": { "connector": "marketa.send-transactional" },
        "expected_outcome_event_type": "artifact_sent"
      },
      "next": "follow-up-delay",
      "receipt_metadata_keys": ["proposal_artifact_id", "recipient", "message_id"]
    },
    {
      "id": "follow-up-delay",
      "label": "Wait 3 days for partner reply",
      "actor": "system",
      "kind": "scheduled",
      "scheduled": {
        "delay": { "value": 3, "unit": "days" },
        "materialize_as": "silent"
      },
      "next": "follow-up-check",
      "branches": [
        { "if": "outcome.partner_replied", "terminate": true }
      ]
    },
    {
      "id": "follow-up-check",
      "label": "No reply from partner — chase or close?",
      "actor": "user",
      "kind": "approve",
      "approve": {
        "artifact_ref": "$chain.proposal_artifact_id",
        "confirm_label": "Send follow-up nudge",
        "reject_label": "Close — partner declined / silent"
      },
      "next": null,
      "branches": [
        { "if": "decision == 'confirm'", "next": "send-followup-nudge" },
        { "if": "decision == 'reject'", "terminate": true }
      ]
    },
    {
      "id": "send-followup-nudge",
      "label": "Send follow-up nudge to partner",
      "actor": "marketa",
      "kind": "rpc",
      "rpc": {
        "endpoint": "/api/connectors/execute",
        "method": "POST",
        "body_from": "chain_context",
        "body_static": { "connector": "marketa.send-transactional", "template": "partner_followup_nudge" },
        "expected_outcome_event_type": "artifact_sent"
      },
      "next": null,
      "receipt_metadata_keys": ["recipient", "message_id"]
    }
  ]
}
```

**Notes on the example:**

- Step IDs are slugs, not numeric — easier to read in receipts/logs.
- `$prev.X` resolves to the previous step's outcome payload field `X`. `$chain.X` resolves to anything written into the chain's context map by any prior step. `$nbe.X` reads from the originating NBE.
- The `review-proposal` step's `on_reject_next: "submit-to-marketa"` creates a re-loop — the user can request Marketa redraft. The re-loop counts as a new step instance with a new receipt.
- The terminal step (`send-followup-nudge` or any branch ending in `terminate: true`) triggers `intent_chain_completed` emission.

---

## 4. Database schema

One new table. No changes to existing tables.

```sql
-- supabase/migrations/<ts>_intent_chains.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.intent_chains (
  chain_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  initiated_by_persona_id uuid NOT NULL,       -- T0; never serialized to JSON
  initiated_by_alias_commitment text,          -- T2; safe in receipts
  initiating_nbe_id text,                      -- which CTA started this chain
  cartridge text,                              -- scope for filtering /workspace views

  status text NOT NULL CHECK (status IN (
    'active',          -- chain is in flight
    'waiting',         -- step kind=scheduled or kind=wait is pending
    'completed',       -- terminated normally
    'failed',          -- a step's expected_outcome timed out or returned error AND on_failure='halt'
    'cancelled'        -- operator-cancelled
  )),
  current_step_id text,                        -- null when terminated
  current_step_kind text,                      -- denormalised for cron filtering
  scheduled_advance_at timestamptz,            -- for kind='scheduled' steps

  context jsonb NOT NULL DEFAULT '{}'::jsonb,  -- accumulating chain context map
                                               -- (artifact_ids, recipients, etc.)

  started_at timestamptz NOT NULL DEFAULT now(),
  terminated_at timestamptz,
  termination_outcome text,                    -- 'completed' | 'failed' | 'cancelled' | 'timeout'

  -- Audit trail correlation
  last_event_id uuid,                          -- pointer to most recent orchestration_events row

  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intent_chains_status_idx
  ON public.intent_chains (status, scheduled_advance_at) WHERE status IN ('active', 'waiting');
CREATE INDEX IF NOT EXISTS intent_chains_persona_idx
  ON public.intent_chains (initiated_by_persona_id, started_at DESC);
CREATE INDEX IF NOT EXISTS intent_chains_template_idx
  ON public.intent_chains (template_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS intent_chains_cartridge_idx
  ON public.intent_chains (cartridge, status) WHERE cartridge IS NOT NULL;

ALTER TABLE public.intent_chains ENABLE ROW LEVEL SECURITY;

-- Per-step state is reconstructable from orchestration_events filtered by
-- metadata.chain_id — no separate steps table needed. Reduces write
-- amplification + keeps the audit trail in one place.

COMMIT;
```

**Why no separate `intent_chain_steps` table:** every step transition emits an `orchestration_events` row. That table already carries `metadata: jsonb` which holds `chain_id`, `step_id`, `step_index`, `outcome`. To reconstruct a chain's step history, query `orchestration_events WHERE metadata->>'chain_id' = '<chain_id>' ORDER BY created_at`. This avoids dual writes + keeps the receipt trail as the single source of truth.

---

## 5. `OrchestrationEventType` union additions

```typescript
// types/orchestration.ts — add to the existing union
export type OrchestrationEventType =
  | ...existing
  | 'intent_chain_started'           // chain instance created, step 0 dispatched
  | 'intent_chain_step_dispatched'   // server initiated step (rpc/scheduled/wait)
  | 'intent_chain_step_completed'    // step's expected outcome observed
  | 'intent_chain_step_failed'       // step returned error or timed out
  | 'intent_chain_step_rerouted'     // step branched to non-default next
  | 'intent_chain_step_user_pending' // user-facing step materialized as NBA pill
  | 'intent_chain_completed'         // chain terminated normally
  | 'intent_chain_failed'            // chain terminated via on_failure='halt'
  | 'intent_chain_cancelled'         // operator cancelled
  | 'intent_chain_timeout'           // kind='wait' or 'scheduled' timed out without advance
  // Marketa intake events (new) — emitted by /api/marketa/propose
  | 'proposal_drafted'               // Marketa returned a proposal artifact
  | 'proposal_redrafted'             // Marketa returned a revised proposal (re-loop)
;
```

---

## 6. DVN receipt generation contract — *every* state change

This is the operator-mandated guarantee: every chain state transition produces a DVN-receipt-eligible event. The audit trail is cryptographically anchored end-to-end via the existing Stage 6 + anchor-cron pipeline.

### Which events emit receipts

| Event type | Receipt content (in `metadata` jsonb) | Lifecycle moment |
|---|---|---|
| `intent_chain_started` | `chain_id`, `template_id`, `initiating_nbe_id`, `step_0_id`, `actor_alias_commitment` | Chain instance created |
| `intent_chain_step_dispatched` | `chain_id`, `step_id`, `step_kind`, `actor`, `dispatch_target` (endpoint or NBA ref) | Step begins |
| `intent_chain_step_completed` | `chain_id`, `step_id`, `outcome_event_id`, `artifact_id?`, `receipt_metadata_keys` evaluated | Step's expected outcome observed |
| `intent_chain_step_failed` | `chain_id`, `step_id`, `error_class`, `error_message` (truncated to 200 chars) | Step error / timeout |
| `intent_chain_step_rerouted` | `chain_id`, `from_step_id`, `to_step_id`, `branch_predicate` | Branch path taken |
| `intent_chain_step_user_pending` | `chain_id`, `step_id`, `pill_id` | User-facing step queued |
| `intent_chain_completed` | `chain_id`, `template_id`, `terminal_step_id`, `outcome_summary`, `total_steps`, `duration_ms` | Chain terminates normally |
| `intent_chain_failed` | `chain_id`, `failed_step_id`, `error_class` | Chain enters failed state |
| `intent_chain_cancelled` | `chain_id`, `cancelled_by_persona_alias_commitment`, `reason` | Operator-cancelled |
| `intent_chain_timeout` | `chain_id`, `waiting_step_id`, `timeout_unit` | Wait/scheduled timed out |

All emit with `receipt_eligible: true`. The existing `emitOrchestrationEvent` plumbing in `services/orchestration/orchestrationEvents.ts` writes to `orchestration_events`, which Stage 6 reads and emits to the PoS canister. The anchor cron we just shipped seals these to BTC within the configured T window (default 15 min).

### Receipt content rules — what's T0 vs T2

| Field | Tier | Inclusion |
|---|---|---|
| `chain_id`, `template_id`, `step_id` | T2 | Always |
| `actor_alias_commitment` | T2 | Always — proves who initiated without revealing persona id |
| `artifact_id` | T2 | When step produced or consumed an artifact |
| `outcome_hash` | T2 | sha256 of the outcome payload (proves what happened without leaking content) |
| `dispatch_target` | T2 | Endpoint path only (`/api/marketa/propose`), no payload |
| `error_message` | T1 | Truncated to 200 chars; T0-bearing content (PII, etc.) stripped at emit time |
| `initiated_by_persona_id` | T0 | **NEVER in receipt metadata** — stored only on `intent_chains` row |
| `recipient` (e.g. partner email) | T0 | **NEVER in receipt metadata** — store on artifact, reference by `artifact_id` |

The orchestrator passes events through a `sanitizeReceiptMetadata()` helper before emission. Tests assert no T0 fields leak (mirror the existing canary-test pattern in `tests/persona-broadcast-handshake.test.ts`).

### What the BTC anchor proves

After a chain runs end-to-end, the chain's full history is sealed in BTC within T minutes. For an auditor, given a chain_id:

1. Query `orchestration_events WHERE metadata->>'chain_id' = '<chain_id>'`
2. Each row has its anchor txid via the existing receipt batching (Merkle root anchored)
3. Reconstruct the chain's state transitions + cryptographic ordering
4. Verify every transition produced an artifact reference that can be independently validated (artifact integrity hashes)

This is the same audit pattern as iQube mint receipts — chains slot into the existing receipt plane with zero new infrastructure.

---

## 7. API surface

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `/api/intent-chains/dispatch` | POST | Start a chain from a CTA. Body: `{ template_id, initiating_nbe_id?, context_seed? }`. Returns `{ chain_id, current_step_id, step_kind, dispatch_hint }` | Spine — any signed-in persona that can see the originating CTA |
| `/api/intent-chains/[chain_id]` | GET | Chain detail — current state + reconstructed step history via orchestration_events join | Spine — owner-or-admin |
| `/api/intent-chains/[chain_id]/advance` | POST | Called internally on step completion. Body: `{ outcome_event_id, branch_predicate_result? }`. Returns new `current_step_id`. **Not user-facing** | Service-role (server-to-server) |
| `/api/intent-chains/[chain_id]/cancel` | POST | Operator cancel. Body: `{ reason? }`. Emits `intent_chain_cancelled` | Spine — owner-or-admin |
| `/api/intent-chains?status=active` | GET | List chains for the calling persona | Spine — caller's own only (admin can pass `?persona_id=`) |
| `/api/marketa/propose` | POST | **NEW** — Marketa's brief intake. Body: `{ brief_artifact_id, chain_id, step_id }`. Generates proposal artifact + emits `proposal_drafted` event | Spine — any signed-in persona |

Outcome listener is **not** a separate endpoint — it's an inline hook in `services/orchestration/orchestrationEvents.ts::emitOrchestrationEvent` that calls `advanceChainIfNeeded(event)` synchronously after insert. Keeps the listener loop in-process; no separate worker.

Scheduled-step advancement is handled by **extending the existing anchor cron** (`/api/ops/sync/cron-tick`) to also query `intent_chains WHERE current_step_kind = 'scheduled' AND scheduled_advance_at <= now()` and call `advance` on each. No new scheduler; reuses the trigger you wire for the anchor cron.

---

## 8. UI contract

### `ExpandedNBEPill` chain breadcrumb

When a pill belongs to a chain, render a small breadcrumb at the top:

```
┌─────────────────────────────────────────────────────────────┐
│  ↳ Ask Marketa for partner proposal · Step 3 of 5           │
│  ─────────────────────────────────────────────────────────  │
│  [existing pill content]                                    │
└─────────────────────────────────────────────────────────────┘
```

The breadcrumb is a link to the chain detail drawer. Props extension on `ExpandedNBEPill`:

```typescript
interface ChainBreadcrumb {
  chain_id: string;
  chain_label: string;
  step_index: number;          // 1-based
  total_steps: number;
  step_label: string;
}

// existing ExpandedNBEPillProps
interface ExpandedNBEPillProps {
  ...
  chainBreadcrumb?: ChainBreadcrumb;  // optional — present only for chain pills
}
```

### myWorkspace tab — clickable intent cards

Per operator ask: intent cards on `MyWorkspaceTab` become clickable. Each card carries either:

- `pill_id` — opens the originating pill in an `ExpandedNBEPill` overlay
- `chain_id` — opens the chain detail drawer

Card already has the source intent reference; we just attach a click handler + render a small chevron affordance.

### Chain Detail Drawer (new component)

`components/metame/chains/ChainDetailDrawer.tsx`:

- Header: chain label + status badge (`Active` / `Waiting` / `Completed` / `Failed` / `Cancelled`)
- Step list with status per step (current step highlighted, completed steps checked, future steps faded)
- Each completed step shows: timestamp, artifact link (if any), outcome summary, **anchor txid + DVN receipt id**
- "Cancel chain" button for the chain owner (calls `POST /api/intent-chains/[id]/cancel`)

The anchor txid link goes to the BTC explorer — operators can independently verify the receipt is anchored.

---

## 9. Build order

Ordered for minimum-risk-per-commit. Each commit is independently revertable.

| # | Commit | Files | Test |
|---|---|---|---|
| 1 | DB migration + types + template registry skeleton | `supabase/migrations/<ts>_intent_chains.sql`, `types/intentChains.ts`, `services/intentChains/registry.ts`, the JSON template for `marketa.ask-partner-proposal` | Migration applies cleanly; registry loads + validates the one template |
| 2 | OrchestrationEventType union additions + sanitizer | `types/orchestration.ts`, `services/orchestration/sanitizeReceiptMetadata.ts` + tests | Sanitizer test asserts no T0 leaks |
| 3 | Dispatcher + advancer core + outcome listener hook | `services/intentChains/dispatcher.ts`, `services/intentChains/advancer.ts`, hook into `emitOrchestrationEvent` | Unit test: dispatch chain, simulate event, assert advance |
| 4 | API routes — dispatch / advance / detail / cancel | `app/api/intent-chains/*` | Curl: dispatch returns chain_id; detail returns step history |
| 5 | Marketa intake: `POST /api/marketa/propose` | `app/api/marketa/propose/route.ts` | Drafts a stub proposal artifact; emits `proposal_drafted` |
| 6 | Cron extension for scheduled steps | Edit `/api/ops/sync/cron-tick/route.ts` to also advance scheduled chains | Unit test: schedule a chain with 1-min delay, fire cron, assert advance |
| 7 | Wire `AigentMeWelcomeSplitTab` seam (line 1227): after `create-artifact` succeeds, advance the active chain | `AigentMeWelcomeSplitTab.tsx` | Manual: click CTA → brief composed → chain progresses to step 2 |
| 8 | `ExpandedNBEPill` chain breadcrumb + `ChainDetailDrawer` | `components/metame/cards/ExpandedNBEPill.tsx`, `components/metame/chains/ChainDetailDrawer.tsx` | Manual: pill shows breadcrumb; drawer renders step history |
| 9 | `MyWorkspaceTab` clickable intent cards | `app/triad/components/codex/tabs/MyWorkspaceTab.tsx` | Manual: card click opens pill / drawer |
| 10 | Close report — registered in cartridge updates collection | `codexes/packs/agentiq/updates/<ts>_intent-chain-orchestrator-close.md` | n/a |

**Estimated effort:** ~8–12 hours across all commits if there are no surprises. Commits 1–6 are backend; 7–9 are UI; 10 wraps it up. Operator can pause after any commit and still ship a useful subset.

---

## 10. Authority compliance

Maps to PRD v1.0 §3 Source-of-Authority Matrix:

| Authority | Chain orchestrator behaviour |
|---|---|
| Identity spine | Every chain endpoint calls `getActivePersona(request)`. T0 persona id stored on `intent_chains` row; only T2 alias commitment in receipts. |
| Access spine | Chain dispatch checks the originating CTA is in the caller's nbeCatalog (existing filter). Per-step user-facing approvals check ownership via the spine's `evaluateAccess` for the step's artifact. |
| Resolver | Untouched. Chains operate at a layer above iQube resolution. |
| Lifecycle | Untouched. Chains don't transition iQube lifecycle; if a step needs to do so, it calls the canonization queue or mint saga via its `rpc` step. |
| Receipt plane | All chain state transitions emit DVN-eligible orchestration_events. Stage 6 + anchor cron seal them to BTC. |
| Hard delete | Chains are never hard-deleted. `cancel` sets `status='cancelled'` + emits receipt; row persists. |

No spine files modified. No access gates removed.

---

## 11. Open questions / tradeoffs to confirm

| # | Question | Default recommendation | Rationale |
|---|---|---|---|
| 1 | Should chains be re-runnable from a failed step, or is failure terminal? | Re-runnable via `cancel` + `dispatch` (new chain instance). Failed chains stay failed. | Keeps chain instances immutable; new run = new chain_id = new audit trail |
| 2 | If the user cancels mid-chain, do we cancel scheduled/wait steps? | Yes — `status='cancelled'` short-circuits the cron's `advance` call | Predictable; cancellation is total |
| 3 | If Marketa's proposal step times out (30 min default?), what's the behaviour? | Emit `intent_chain_step_failed`, set chain `status='failed'`. Operator sees a pill: "Marketa proposal step failed — retry?" | Surfaces the issue; no silent stuck chains |
| 4 | Can a chain step trigger another chain (sub-chain)? | Out of scope for v1; revisit after we have ≥3 templates running | Avoid orchestration complexity until we know we need it |
| 5 | How are templates versioned? Operators may edit a template after live chains exist. | Embed `template_version` on `intent_chains` row at dispatch time; chain runs against the version it started with. Template edits create v2 used by new chains only. | Backwards-safe; chains in flight don't change behaviour |
| 6 | Should the chain detail drawer show DVN receipt content inline, or just txid + link? | Just txid + BTC explorer link. The full receipt content is admin-only via Stage 6 receipts tab. | UI doesn't need to re-implement receipt rendering; operators have a canonical surface for that |

Flag any answer you'd change before I build.

---

## 12. Out of scope (future work)

- **Sub-chains** (chain triggers another chain) — Q4 above.
- **Conditional skips** beyond simple branches — e.g. "skip step 3 if context.skip_flag is true". Templates can be authored around it.
- **Agentic step substitution** — letting Aigent Z replace a declarative step with a freeform action mid-chain. This is the "declarative vs agentic" tradeoff; v1 stays declarative.
- **Chain templates as iQubes** — registering templates as canonical iQubes with their own provenance/governance. Currently they're file-based + repo-versioned.
- **Cross-persona chains** — a chain where step 3 dispatches to a different user's metaMe (e.g. handoff). Auth model needs design.
- **Chain library catalog UI** — a "Browse available chains" surface for operators to discover and dispatch chains independent of CTAs. Today chains are only triggered by their `triggered_by_nbe` CTAs.

---

## 13. Files reference (post-build)

```
services/intentChains/
  registry.ts                          # load + validate templates
  dispatcher.ts                        # POST /dispatch logic
  advancer.ts                          # advance + emit + branch evaluation
  sanitizeReceiptMetadata.ts           # T0/T1/T2 enforcement
  templates/
    marketa.ask-partner-proposal.json
    (future templates)

types/intentChains.ts                  # ChainTemplate, ChainStep, ChainBranch, IntentChainStatus
types/orchestration.ts                 # OrchestrationEventType additions

supabase/migrations/<ts>_intent_chains.sql

app/api/intent-chains/
  dispatch/route.ts
  [chain_id]/route.ts                  # GET detail
  [chain_id]/advance/route.ts          # POST advance (service-role)
  [chain_id]/cancel/route.ts           # POST cancel
  route.ts                             # GET list

app/api/marketa/propose/route.ts       # NEW Marketa intake

app/api/ops/sync/cron-tick/route.ts    # EXTEND to advance scheduled chains

components/metame/cards/ExpandedNBEPill.tsx   # add chainBreadcrumb prop
components/metame/chains/ChainDetailDrawer.tsx # NEW
app/triad/components/codex/tabs/AigentMeWelcomeSplitTab.tsx  # wire seam at line 1227
app/triad/components/codex/tabs/MyWorkspaceTab.tsx           # clickable cards

codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS.md         # first-class doc post-build
```

---

**End of intent-chain orchestrator spec.**

Awaiting operator confirmation before commit 1.
