# Commit Brief: `9ac363d` — add Make scenario browser and Marketa tool calling

| Field | Value |
|-------|-------|
| SHA | [`9ac363d`](https://github.com/iQube-Protocol/AigentZBeta/commit/9ac363d09dd17ee71a5d78b1937fcaae822a11c0) |
| Author | Claude |
| Date | 2026-03-26T03:15:42Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add Make scenario browser and Marketa tool calling

- listMakeScenarios() in makeAdapter: fetches scenarios from Make API, auto-discovers team ID from /users/me if MAKE_TEAM_ID not set
- GET /api/make/scenarios: exposes scenario list to Studio
- Studio Workflows tab: "+ Connect from Make" button lists scenarios inline, creates WorkflowDefinition + binding on select
- codex/chat: Marketa (aigent-marketa) now uses tool calling for openai and anthropic providers — tools: list_workflows, invoke_workflow, deploy_campaign; multi-round loop resolves tool results before final response

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
