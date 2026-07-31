# Commit Brief: `e4fff69` — fix ENS tab spinner + add QubeTalk channels to Locker

| Field | Value |
|-------|-------|
| SHA | [`e4fff69`](https://github.com/iQube-Protocol/AigentZBeta/commit/e4fff6987191afe424fab349d65af4dc44546e15) |
| Author | Claude |
| Date | 2026-06-14T08:04:56Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix ENS tab spinner + add QubeTalk channels to Locker

ENS Identity tab:
- Remove adminOnly from ENS tab group so all users see it
- Fix infinite spinner: useActivePersona returns T1 surface with no
  personaId (T0), so loadAssignment always returned early without
  clearing loading state
- Create /api/identity/my-ens route that resolves caller server-side
  (no persona_id in URL needed)
- Switch all fetches from personaFetch to authedFetchHeaders for
  iframe embed auth compatibility

QubeTalk in Locker:
- Create /api/qubetalk/passport-channels endpoint listing active
  citizen↔agent channels from passport_qubetalk_channels
- Add Agent Channels section to LockerTab with expandable channel
  cards and message compose UI
- Channels auto-created when locker grants are issued (existing flow)

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt
```

## Body

ENS Identity tab:
- Remove adminOnly from ENS tab group so all users see it
- Fix infinite spinner: useActivePersona returns T1 surface with no
  personaId (T0), so loadAssignment always returned early without
  clearing loading state
- Create /api/identity/my-ens route that resolves caller server-side
  (no persona_id in URL needed)
- Switch all fetches from personaFetch to authedFetchHeaders for
  iframe embed auth compatibility

QubeTalk in Locker:
- Create /api/qubetalk/passport-channels endpoint listing active
  citizen↔agent channels from passport_qubetalk_channels
- Add Agent Channels section to LockerTab with expandable channel
  cards and message compose UI
- Channels auto-created when locker grants are issued (existing flow)

https://claude.ai/code/session_01LPt5L6vMfR6x9uqnNLmTzt

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/identity/my-ens/route.ts` |
| Added | `app/api/qubetalk/passport-channels/route.ts` |
| Modified | `app/triad/components/codex/tabs/LockerTab.tsx` |
| Modified | `app/triad/components/codex/tabs/PassportEnsTab.tsx` |
| Modified | `data/codex-configs.ts` |

## Stats

 5 files changed, 381 insertions(+), 20 deletions(-)
