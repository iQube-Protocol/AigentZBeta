# QubeTalk DVN Wiring — Backlog

**Date:** 2026-06-24
**Status:** Backlog
**Priority:** Low — post-DVN-pipeline workstream

---

## Context

QubeTalk is the inter-agent messaging protocol used for coordination between Claude Code, Codex, Lovable, and other agents in the metaMe platform. Currently it operates via:

1. **Live channel** — messages posted to Supabase `qubetak_messages` table, surfaced in the app UI
2. **File-based bridge** — `docs/qubetalk-bridge/outbox/` packets committed to the repo, relayed by Lovable (workaround for sandbox outbound HTTPS block)

QubeTalk messages are **not currently wired through the DVN pipeline** — they do not create `activity_receipts` rows and are not anchored to Bitcoin via `proof_of_state`.

The A2A DVN card in the ops page currently tracks two event categories:
- **Agent Payments** — QCT wallet transactions between agents
- **Agent Authorisations** — bounded delegation grant/revoke receipts (added 2026-06-24)

QubeTalk agent-to-agent coordination messages are a natural third category for this card once they are receipt-eligible.

---

## What Needs to Be Done

### 1. Define `ActivityActionType` entries for QubeTalk

Add to `ActivityActionType` union in `services/receipts/activityReceiptService.ts`:

```typescript
| 'agent_message_sent'      // QubeTalk message dispatched by an agent
| 'agent_message_received'  // QubeTalk message acknowledged by recipient agent
```

Add both to the DB check constraint migration (following the pattern of `20260624200000_delegation_receipt_action_types.sql`).

### 2. Wire `createActivityReceipt` into QubeTalk send path

The QubeTalk send path is in `scripts/qubetalk-claude.sh` (shell) and `scripts/qubetalk_bridge/create_packet.py` (Python bridge). For server-side QubeTalk (Supabase insert path), wire receipt creation after a successful message insert:

```typescript
// In the QubeTalk message insert handler (wherever Supabase insert occurs server-side)
const receipt = await createActivityReceipt({
  personaId: senderPersonaId,
  activeCartridge: 'agentiq-os-cartridge',
  actionType: 'agent_message_sent',
  summary: `QubeTalk: ${title} [thread: ${thread}, severity: ${severity}]`,
  agentsInvoked: [recipientAgentId],
  contextShared: [`thread:${thread}`, `type:${type}`],
});
if (receipt) enqueueActivityReceiptAnchor(receipt, senderPersonaId);
```

### 3. Add `agent_message_sent` / `agent_message_received` to `ANCHORABLE_ACTION_TYPES`

In `services/dvn/activityReceiptDvnPipeline.ts`, add both types to the set so they flow through cross_chain_service → proof_of_state → BTC anchor.

### 4. Surface in A2A DVN card

Extend `/api/ops/dvn/activity-receipts` (or add a separate `/api/ops/dvn/agent-messages`) to include QubeTalk receipts alongside delegation receipts. The A2A DVN card "Agent Authorisations" section already has the pattern — a third section "Agent Messages" can follow the same shape.

---

## Constraints

- **T2 privacy**: QubeTalk message bodies must be hashed/summarised before DVN submission — the `summary` field is the only chain-bound text, and it must not contain T0 identifiers (personaId, authProfileId, etc.)
- **Volume**: QubeTalk can be high-frequency. Add a `severity` filter — only `warn` and `blocker` messages are receipt-eligible by default; `info` messages stay local unless explicitly flagged
- **File bridge**: The `docs/qubetalk-bridge/outbox/` path is Claude-sandbox-only and does not touch a server process — it cannot be wired to the receipt pipeline without a relay step (Lovable reads the outbox and POSTs to an API route)

---

## Related Files

- `services/receipts/activityReceiptService.ts` — `ActivityActionType` union
- `services/dvn/activityReceiptDvnPipeline.ts` — `ANCHORABLE_ACTION_TYPES`
- `app/api/ops/dvn/activity-receipts/route.ts` — ops query endpoint
- `components/ops/A2ADVNCard.tsx` — card to surface the data
- `supabase/migrations/20260624200000_delegation_receipt_action_types.sql` — constraint pattern to follow
