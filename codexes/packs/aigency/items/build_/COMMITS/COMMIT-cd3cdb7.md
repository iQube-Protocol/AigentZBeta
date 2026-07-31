# Commit Brief: `cd3cdb7` — deploy consequence operating model as intent chain template (chrysalis phase 3b)

| Field | Value |
|-------|-------|
| SHA | [`cd3cdb7`](https://github.com/iQube-Protocol/AigentZBeta/commit/cd3cdb71c921afe767931c7045cf25cc1b077124) |
| Author | Claude |
| Date | 2026-07-03T23:26:44Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
deploy consequence operating model as intent chain template (chrysalis phase 3b)

CFS-006a §4: consequence-operating-model.v1 chain template (preflight rpc → disposition branches: deny/ask terminate, act skips to flywheel, escalate routes through human approve step → flywheel rpc). New chain-facing step adapter /api/consequence/steps authenticated by X-Chain-Orchestrator-Token, executing pipeline phases and emitting the new consequence_preflight_completed / consequence_flywheel_completed orchestration events (additive union) with metadata.chain_id per the advancer rpc contract. Runner receipts made actor-optional for chain mode (chain layer emits its own step receipts; T2 alias only). Template pinned by the chain registry's own validator in tests (30 passing).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

CFS-006a §4: consequence-operating-model.v1 chain template (preflight rpc → disposition branches: deny/ask terminate, act skips to flywheel, escalate routes through human approve step → flywheel rpc). New chain-facing step adapter /api/consequence/steps authenticated by X-Chain-Orchestrator-Token, executing pipeline phases and emitting the new consequence_preflight_completed / consequence_flywheel_completed orchestration events (additive union) with metadata.chain_id per the advancer rpc contract. Runner receipts made actor-optional for chain mode (chain layer emits its own step receipts; T2 alias only). Template pinned by the chain registry's own validator in tests (30 passing).

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/consequence/steps/route.ts` |
| Modified | `services/consequence/operatingModel.ts` |
| Added | `services/intentChains/templates/consequence-operating-model.v1.json` |
| Modified | `tests/consequence-pipeline.test.ts` |
| Modified | `types/orchestration.ts` |

## Stats

 5 files changed, 294 insertions(+), 18 deletions(-)
