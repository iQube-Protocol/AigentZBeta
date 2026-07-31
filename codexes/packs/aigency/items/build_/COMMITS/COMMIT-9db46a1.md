# Commit Brief: `9db46a1` — intent chains commit 5: Marketa propose intake + Factory Ingestion stub

| Field | Value |
|-------|-------|
| SHA | [`9db46a1`](https://github.com/iQube-Protocol/AigentZBeta/commit/9db46a19fe1854946346163f39a48f625ce75063) |
| Author | Claude |
| Date | 2026-06-02T01:15:29Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
intent chains commit 5: Marketa propose intake + Factory Ingestion stub

POST /api/marketa/propose — the missing intake the audit surfaced.
Pre-this commit, Marketa only had partner-pack/propose (KNYT-scoped) +
connectors/execute (email only). This is the generalized brief intake
the intent-chain advancer dispatches to.

Auth — dual path:
- X-Chain-Orchestrator-Token (server-to-server from advanceRpcStep
  via the new ORCHESTRATOR_SERVICE_TOKEN env var) — the canonical
  chain-driven flow
- OR signed-in admin/partner via getActivePersona — for manual ops
  + future direct-call clients

Body: { brief_artifact_id (required), chain_id, step_id,
        initiated_by_alias_commitment, ...context }

Behaviour (v1):
- Generates proposal_artifact_id (uuid-prefixed)
- Attempts persist to a marketa_proposals table (skipped silently if
  the table doesn't exist in dev — orchestration_events row is the
  durable record)
- Emits proposal_drafted orchestration_event with metadata.chain_id +
  proposal_artifact_id + brief_artifact_id — this is what advances
  the chain to the next step via the inline advancer hook
- Returns { proposal_artifact_id, stub: true } until the canonical
  LLM-driven generation lands

The stub flag is intentional — it makes the v1 limitation explicit
and easy to grep when wiring the production LLM path.

services/registry/backfill/runBackfill.ts:
- New loadChainTemplateRows loader. Each template in
  services/intentChains/templates/*.json registers as a synthetic
  ToolQube primitive with iqube_id = syntheticIQubeId('code:chainTemplate', t.id),
  legacy_primitive_type='WorkflowQube', notes recording version + cost_qc.
- Registered 'code:chainTemplate' in SOURCE_LOADERS map.
- Templates now show up in /registry Browse + Score Coverage counts
  per §6.6 Factory Ingestion stub. Full canonization (meta+blak+token
  + governance) is the deferred follow-on workstream.

scripts/create-env-production.js:
- Added ORCHESTRATOR_SERVICE_TOKEN to the env allowlist alongside
  CRON_TRIGGER_TOKEN. Same generation pattern (openssl rand -hex 32).

Operator action when ready:
1. Add ORCHESTRATOR_SERVICE_TOKEN to Amplify env vars (any 32+ char
   random hex)
2. Trigger a redeploy so the new var lands in the Lambda
3. (Optional but recommended) Run POST /api/admin/registry/backfill
   with source=code:chainTemplate to seed the registry plane with the
   marketa.ask-partner-proposal template synthetic id_map row
```

## Body

POST /api/marketa/propose — the missing intake the audit surfaced.
Pre-this commit, Marketa only had partner-pack/propose (KNYT-scoped) +
connectors/execute (email only). This is the generalized brief intake
the intent-chain advancer dispatches to.

Auth — dual path:
- X-Chain-Orchestrator-Token (server-to-server from advanceRpcStep
  via the new ORCHESTRATOR_SERVICE_TOKEN env var) — the canonical
  chain-driven flow
- OR signed-in admin/partner via getActivePersona — for manual ops
  + future direct-call clients

Body: { brief_artifact_id (required), chain_id, step_id,
        initiated_by_alias_commitment, ...context }

Behaviour (v1):
- Generates proposal_artifact_id (uuid-prefixed)
- Attempts persist to a marketa_proposals table (skipped silently if
  the table doesn't exist in dev — orchestration_events row is the
  durable record)
- Emits proposal_drafted orchestration_event with metadata.chain_id +
  proposal_artifact_id + brief_artifact_id — this is what advances
  the chain to the next step via the inline advancer hook
- Returns { proposal_artifact_id, stub: true } until the canonical
  LLM-driven generation lands

The stub flag is intentional — it makes the v1 limitation explicit
and easy to grep when wiring the production LLM path.

services/registry/backfill/runBackfill.ts:
- New loadChainTemplateRows loader. Each template in
  services/intentChains/templates/*.json registers as a synthetic
  ToolQube primitive with iqube_id = syntheticIQubeId('code:chainTemplate', t.id),
  legacy_primitive_type='WorkflowQube', notes recording version + cost_qc.
- Registered 'code:chainTemplate' in SOURCE_LOADERS map.
- Templates now show up in /registry Browse + Score Coverage counts
  per §6.6 Factory Ingestion stub. Full canonization (meta+blak+token
  + governance) is the deferred follow-on workstream.

scripts/create-env-production.js:
- Added ORCHESTRATOR_SERVICE_TOKEN to the env allowlist alongside
  CRON_TRIGGER_TOKEN. Same generation pattern (openssl rand -hex 32).

Operator action when ready:
1. Add ORCHESTRATOR_SERVICE_TOKEN to Amplify env vars (any 32+ char
   random hex)
2. Trigger a redeploy so the new var lands in the Lambda
3. (Optional but recommended) Run POST /api/admin/registry/backfill
   with source=code:chainTemplate to seed the registry plane with the
   marketa.ask-partner-proposal template synthetic id_map row

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/marketa/propose/route.ts` |
| Modified | `scripts/create-env-production.js` |
| Modified | `services/registry/backfill/runBackfill.ts` |

## Stats

 3 files changed, 176 insertions(+)
