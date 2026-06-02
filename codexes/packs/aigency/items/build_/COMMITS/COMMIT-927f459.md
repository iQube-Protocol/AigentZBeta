# Commit Brief: `927f459` — intent chains commit 1: schema + types + template registry + reference

| Field | Value |
|-------|-------|
| SHA | [`927f459`](https://github.com/iQube-Protocol/AigentZBeta/commit/927f459ceffc1cb0c9748f54b269373d21053f47) |
| Author | Claude |
| Date | 2026-06-02T00:38:30Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 1: schema + types + template registry + reference

Build commit 1 of 10 per AGENTIQ_INTENT_CHAINS_SPEC.md. Spec also
updated to v2 with three operator-locked additions (Q¢ payment per
workflow, aigentMe-as-orchestrator naming, Factory Ingestion stub for
chain templates).

Database (supabase/migrations/20260602100000_intent_chains.sql):
- New intent_chains table: chain_id, template_id, template_version
  (snapshot at dispatch), initiating_nbe_id, initiated_by_persona_id
  (T0), initiated_by_alias_commitment (T2), cartridge, status, current
  step pointer + denormalised kind, scheduled_advance_at + wait_timeout_at
  for cron polling, context jsonb for $chain.X refs, cost_qc + charge
  status fields, last_event_id correlation
- 5 partial indexes covering cron-tick polling, per-user listing, per-
  template stats, per-cartridge filtering
- iqube_id_map.source CHECK constraint extended to accept
  'code:chainTemplate' for the Factory Ingestion stub (§6.6)
- updated_at trigger

Types (types/intentChains.ts):
- ChainTemplate, ChainStep with per-kind config unions
- Per-step kinds: compose | rpc | approve | scheduled | wait
- ChainBranch with `if`/`next`/`terminate` shape
- ChainCostMetadata stub (revenue_share + refund_policy)
- IntentChainRow (DB shape) + IntentChainView (T1-safe projection that
  strips initiated_by_persona_id)
- Ref scope conventions: $nbe.X, $prev.X, $chain.X

OrchestrationEventType union (types/orchestration.ts):
- 11 new chain lifecycle events (started, step_dispatched,
  step_completed, step_failed, step_rerouted, step_user_pending,
  completed, failed, cancelled, timeout, charge_committed,
  charge_refunded)
- proposal_drafted + proposal_redrafted for Marketa intake
- artifact_sent surfaced for chain advancement

Registry IQubeIdMapSource (types/registry-canonical.ts):
- New 'code:chainTemplate' enum value for the Factory Ingestion stub

Template registry (services/intentChains/registry.ts):
- File-based loader from services/intentChains/templates/*.json
- validateTemplate: step ID uniqueness, ref resolution, per-kind config
  presence, cycle detection on default-next graph, cost_qc bounds
- listTemplates / getTemplate / getLoadWarnings public API
- _resetForTest helper for unit tests (deferred to commit 3)

Reference template (services/intentChains/templates/marketa.ask-partner-proposal.json):
- 7 steps end-to-end: compose-brief → submit-to-marketa →
  review-proposal (with on_reject re-loop to submit) → send-to-partner
  → follow-up-delay (3 days) → follow-up-check → send-followup-nudge
- cost_qc: 900 (= $9.00 per end-to-end run)
- All refs validated (no unresolved next/branch/on_reject pointers)

Operator action required before this surfaces: apply the migration in
dev Supabase (next commit's close-report will include the SQL inline
for paste).
```

## Body

Build commit 1 of 10 per AGENTIQ_INTENT_CHAINS_SPEC.md. Spec also
updated to v2 with three operator-locked additions (Q¢ payment per
workflow, aigentMe-as-orchestrator naming, Factory Ingestion stub for
chain templates).

Database (supabase/migrations/20260602100000_intent_chains.sql):
- New intent_chains table: chain_id, template_id, template_version
  (snapshot at dispatch), initiating_nbe_id, initiated_by_persona_id
  (T0), initiated_by_alias_commitment (T2), cartridge, status, current
  step pointer + denormalised kind, scheduled_advance_at + wait_timeout_at
  for cron polling, context jsonb for $chain.X refs, cost_qc + charge
  status fields, last_event_id correlation
- 5 partial indexes covering cron-tick polling, per-user listing, per-
  template stats, per-cartridge filtering
- iqube_id_map.source CHECK constraint extended to accept
  'code:chainTemplate' for the Factory Ingestion stub (§6.6)
- updated_at trigger

Types (types/intentChains.ts):
- ChainTemplate, ChainStep with per-kind config unions
- Per-step kinds: compose | rpc | approve | scheduled | wait
- ChainBranch with `if`/`next`/`terminate` shape
- ChainCostMetadata stub (revenue_share + refund_policy)
- IntentChainRow (DB shape) + IntentChainView (T1-safe projection that
  strips initiated_by_persona_id)
- Ref scope conventions: $nbe.X, $prev.X, $chain.X

OrchestrationEventType union (types/orchestration.ts):
- 11 new chain lifecycle events (started, step_dispatched,
  step_completed, step_failed, step_rerouted, step_user_pending,
  completed, failed, cancelled, timeout, charge_committed,
  charge_refunded)
- proposal_drafted + proposal_redrafted for Marketa intake
- artifact_sent surfaced for chain advancement

Registry IQubeIdMapSource (types/registry-canonical.ts):
- New 'code:chainTemplate' enum value for the Factory Ingestion stub

Template registry (services/intentChains/registry.ts):
- File-based loader from services/intentChains/templates/*.json
- validateTemplate: step ID uniqueness, ref resolution, per-kind config
  presence, cycle detection on default-next graph, cost_qc bounds
- listTemplates / getTemplate / getLoadWarnings public API
- _resetForTest helper for unit tests (deferred to commit 3)

Reference template (services/intentChains/templates/marketa.ask-partner-proposal.json):
- 7 steps end-to-end: compose-brief → submit-to-marketa →
  review-proposal (with on_reject re-loop to submit) → send-to-partner
  → follow-up-delay (3 days) → follow-up-check → send-followup-nudge
- cost_qc: 900 (= $9.00 per end-to-end run)
- All refs validated (no unresolved next/branch/on_reject pointers)

Operator action required before this surfaces: apply the migration in
dev Supabase (next commit's close-report will include the SQL inline
for paste).

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/items/AGENTIQ_INTENT_CHAINS_SPEC.md` |
| Added | `services/intentChains/registry.ts` |
| Added | `services/intentChains/templates/marketa.ask-partner-proposal.json` |
| Added | `supabase/migrations/20260602100000_intent_chains.sql` |
| Added | `types/intentChains.ts` |
| Modified | `types/orchestration.ts` |
| Modified | `types/registry-canonical.ts` |

## Stats

 7 files changed, 859 insertions(+), 17 deletions(-)
