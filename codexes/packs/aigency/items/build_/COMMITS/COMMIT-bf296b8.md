# Commit Brief: `bf296b8` — add listAutoGrantActivationIds export to unblock amplify build

| Field | Value |
|-------|-------|
| SHA | [`bf296b8`](https://github.com/iQube-Protocol/AigentZBeta/commit/bf296b866fa56fa07ca7c627cba1084c374138f9) |
| Author | Claude |
| Date | 2026-06-14T01:35:13Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
add listAutoGrantActivationIds export to unblock amplify build

three files import listAutoGrantActivationIds from
@/data/activation-catalog but the function was never exported:
  app/api/admin/activations/diag/route.ts:15
  app/api/assistant/activations/diag/route.ts:13
  services/activations/personaActivations.ts:18

amplify build error:
  Attempted import error: 'listAutoGrantActivationIds' is not exported
  from '@/data/activation-catalog'

add the function — returns every activation id with gate='open'
(the auto-grant-on-first-read surfaces). matches the inferred
contract from the three call sites which expect string[].
```

## Body

three files import listAutoGrantActivationIds from
@/data/activation-catalog but the function was never exported:
  app/api/admin/activations/diag/route.ts:15
  app/api/assistant/activations/diag/route.ts:13
  services/activations/personaActivations.ts:18

amplify build error:
  Attempted import error: 'listAutoGrantActivationIds' is not exported
  from '@/data/activation-catalog'

add the function — returns every activation id with gate='open'
(the auto-grant-on-first-read surfaces). matches the inferred
contract from the three call sites which expect string[].

## Files Changed

| Change | File |
|--------|------|
| Modified | `data/activation-catalog.ts` |

## Stats

 1 file changed, 10 insertions(+)
