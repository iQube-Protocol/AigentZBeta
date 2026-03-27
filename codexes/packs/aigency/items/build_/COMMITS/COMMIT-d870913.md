# Commit Brief: `d870913` — fix crm uuid crash and video generation hang

| Field | Value |
|-------|-------|
| SHA | [`d870913`](https://github.com/iQube-Protocol/AigentZBeta/commit/d87091313f9bcb9857ca7bb165fde530f5dfbb02) |
| Author | Claude |
| Date | 2026-03-21T21:52:26Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix crm uuid crash and video generation hang

- skip CRM lifecycle contribution when personaId is not a UUID (wallet
  DIDs like aigentz@aigent:u_demo_001 are not valid for persona_id UUID
  column, causing 500 on every experience_launch/preview event)
- remove Venice video quote pre-flight from createVeniceJob — the queue
  call itself returns a clear error for insufficient balance, eliminating
  an unnecessary 10 s round-trip that was causing the invoke to block
- add 35 s AbortController timeout to requestVideoBundleArtifacts fetch
  so a slow Venice API no longer freezes the session completion UI

https://claude.ai/code/session_01VcE6pnjSeAtYvhau1Q6GVM
```

## Files Changed

_File details not available in backfill — see commit link above._
