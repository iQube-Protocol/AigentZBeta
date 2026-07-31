# Commit Brief: `7ccb102` — spec: intent chain orchestrator — draft v1 + reference template

| Field | Value |
|-------|-------|
| SHA | [`7ccb102`](https://github.com/iQube-Protocol/AigentZBeta/commit/7ccb1027eb477ce51bed0e645c6394d54fc6c12e) |
| Author | Claude |
| Date | 2026-06-02T00:14:35Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
spec: intent chain orchestrator — draft v1 + reference template

First-class spec doc for the metaMe/aigentMe intent-chain orchestrator.
Turns one-shot CTAs into stateful multi-step workflows with DVN-receipt
provenance on every state-changing transition.

Triggered by the 2026-06-01 audit finding (AigentMeWelcomeSplitTab:1227)
that the existing CTA pipeline composes briefs but never dispatches to
actor agents and never queues follow-up NBAs.

Spec covers:
- Architecture overview + authority alignment (PRD v1.0 §3)
- Chain template format (kind: compose | rpc | approve | scheduled | wait)
- Reference template: marketa.ask-partner-proposal (7 steps end-to-end,
  including a 3-day follow-up scheduled step + branching review loop)
- DB schema — single intent_chains table; per-step state reconstructable
  from orchestration_events filtered by chain_id (no dual-write)
- OrchestrationEventType union additions for chain lifecycle events
- DVN receipt contract — every state change emits a receipt-eligible
  event with T0/T1/T2 tier discipline. sanitizeReceiptMetadata strips
  any T0 (personaId, recipient PII) before emission. BTC anchoring rides
  the existing K/T policy and anchor cron we just shipped
- API surface: /api/intent-chains/{dispatch, [id], [id]/advance,
  [id]/cancel} + /api/marketa/propose (new — Marketa lacks a general
  brief intake today; only KNYT partner-pack and email connectors exist)
- UI: ExpandedNBEPill chain breadcrumb + ChainDetailDrawer + clickable
  myWorkspace intent cards
- Scheduled-step advancement piggybacks on /api/ops/sync/cron-tick
  (no new scheduler infrastructure)
- 10-commit build order with each commit independently revertable
- 6 open questions with default recommendations for operator review
- Out-of-scope list for v1 (sub-chains, agentic step substitution,
  chain-as-iQube, cross-persona handoffs)

Registered as new cartridge collection col_intent_chains alongside
col_network_economics.

Awaiting operator confirmation before commit 1 (DB migration + types +
template registry skeleton).
```

## Body

First-class spec doc for the metaMe/aigentMe intent-chain orchestrator.
Turns one-shot CTAs into stateful multi-step workflows with DVN-receipt
provenance on every state-changing transition.

Triggered by the 2026-06-01 audit finding (AigentMeWelcomeSplitTab:1227)
that the existing CTA pipeline composes briefs but never dispatches to
actor agents and never queues follow-up NBAs.

Spec covers:
- Architecture overview + authority alignment (PRD v1.0 §3)
- Chain template format (kind: compose | rpc | approve | scheduled | wait)
- Reference template: marketa.ask-partner-proposal (7 steps end-to-end,
  including a 3-day follow-up scheduled step + branching review loop)
- DB schema — single intent_chains table; per-step state reconstructable
  from orchestration_events filtered by chain_id (no dual-write)
- OrchestrationEventType union additions for chain lifecycle events
- DVN receipt contract — every state change emits a receipt-eligible
  event with T0/T1/T2 tier discipline. sanitizeReceiptMetadata strips
  any T0 (personaId, recipient PII) before emission. BTC anchoring rides
  the existing K/T policy and anchor cron we just shipped
- API surface: /api/intent-chains/{dispatch, [id], [id]/advance,
  [id]/cancel} + /api/marketa/propose (new — Marketa lacks a general
  brief intake today; only KNYT partner-pack and email connectors exist)
- UI: ExpandedNBEPill chain breadcrumb + ChainDetailDrawer + clickable
  myWorkspace intent cards
- Scheduled-step advancement piggybacks on /api/ops/sync/cron-tick
  (no new scheduler infrastructure)
- 10-commit build order with each commit independently revertable
- 6 open questions with default recommendations for operator review
- Out-of-scope list for v1 (sub-chains, agentic step substitution,
  chain-as-iQube, cross-persona handoffs)

Registered as new cartridge collection col_intent_chains alongside
col_network_economics.

Awaiting operator confirmation before commit 1 (DB migration + types +
template registry skeleton).

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md` |

## Stats

 2 files changed, 580 insertions(+)
