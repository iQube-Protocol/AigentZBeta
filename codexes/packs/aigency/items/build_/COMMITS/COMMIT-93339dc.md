# Commit Brief: `93339dc` — feat: add bounded persona re-crossing

| Field | Value |
|-------|-------|
| SHA | [`93339dc`](https://github.com/iQube-Protocol/AigentZBeta/commit/93339dc239f8220ca9bcb24c03430efaa80b4db5) |
| Author | Kn0w1 |
| Date | 2026-09-10T09:12:08-04:00 |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: add bounded persona re-crossing

Implements Issue #112's T2-only persona state and discovery tools plus a human-authorized, PKCE-bound fresh crossing. Persona replacement revokes the source session before activating the target and carries no service agreements or source-only admin scope.
```

## Body

Implements Issue #112's T2-only persona state and discovery tools plus a human-authorized, PKCE-bound fresh crossing. Persona replacement revokes the source session before activating the target and carries no service agreements or source-only admin scope.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/threshold/mcp/route.ts` |
| Added | `app/api/threshold/persona-switch/complete/route.ts` |
| Modified | `app/api/wallet/personas/route.ts` |
| Added | `app/threshold/switch-persona/page.tsx` |
| Added | `docs/qubetalk-bridge/outbox/openai-codex-issue-112-persona-recross-2026-09-10T13-07-40Z.json` |
| Modified | `services/threshold/gateway.ts` |
| Modified | `services/threshold/gatewaySession.ts` |
| Added | `services/threshold/personaRecross.ts` |
| Added | `services/wallet/personaInventory.ts` |
| Added | `supabase/migrations/20260910000000_threshold_persona_recross.sql` |
| Added | `tests/threshold-persona-recross.test.ts` |

## Stats

 12 files changed, 857 insertions(+), 263 deletions(-)
