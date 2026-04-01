# Commit Brief: `3ad1e43` — add ChannelQube — migration, store, channel API, wire invoke to QubeTalk

| Field | Value |
|-------|-------|
| SHA | [`3ad1e43`](https://github.com/iQube-Protocol/AigentZBeta/commit/3ad1e4318d564e9b46cef6919735872c290a674d) |
| Author | Claude |
| Date | 2026-03-26T01:10:32Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add ChannelQube — migration, store, channel API, wire invoke to QubeTalk

- migration: workflow_channel_qubes table (unique per workflow, channel_name,
  thread, participating_agents, policy_ref, active flag)
- channelQubeTypes.ts: ChannelQube type
- channelQubeStore.ts: getChannelQube, upsertChannelQube,
  postWorkflowInvocationEvent (writes system message to qubetalkPersistence)
- GET/PUT /api/workflows/:id/channel
- invoke route: after adapter invoke, fire-and-forget QubeTalk event to bound
  channel if active (status: started | failed, includes executionId)

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
