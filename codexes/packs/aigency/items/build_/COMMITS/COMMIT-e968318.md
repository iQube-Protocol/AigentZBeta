# Commit Brief: `e968318` — capability gateway phase 2b — widen pre-flight gather to all specialists

| Field | Value |
|-------|-------|
| SHA | [`e968318`](https://github.com/iQube-Protocol/AigentZBeta/commit/e96831813d6f7d81eb29d4eb961911f33fdc0ab0) |
| Author | Claude |
| Date | 2026-05-24T09:13:42Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
capability gateway phase 2b — widen pre-flight gather to all specialists

Replaces the boolean 'true → kn0w1 only' guard with a proper allowlist
parsed from CAPABILITY_GATEWAY_PREFLIGHT:

  - unset / 'off' / 'false' / ''  → disabled (default — production safe)
  - 'all' / 'true'                 → enabled for all eight specialists
                                      (marketa, quill, kn0w1, aigent-z,
                                      aigent-c, aigent-nakamoto,
                                      moneypenny, metaye)
  - 'kn0w1,marketa,quill'          → enabled for the listed ids only

aigent-z and aigent-c are the system-orchestrator and customer-guide
layers of aigentMe itself, so setting the env to 'all' covers
aigentMe-as-orchestrator through the same path as every other
specialist.

The aigentMe-direct API routes (brief, move-forward, venture-progress)
are not yet wired — they live outside ask-agent and will get the same
treatment in a follow-up. Today's pattern A scope is intentionally
ask-agent only so the regression surface stays bounded.

Everything else from phase 2a holds: gather failure falls through
silently, T0 stops at the gateway, one receipt per execution, and the
work order's policyHash + cohortAliasCommitment are the only
identifiers that cross into the adapter.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Replaces the boolean 'true → kn0w1 only' guard with a proper allowlist
parsed from CAPABILITY_GATEWAY_PREFLIGHT:

  - unset / 'off' / 'false' / ''  → disabled (default — production safe)
  - 'all' / 'true'                 → enabled for all eight specialists
                                      (marketa, quill, kn0w1, aigent-z,
                                      aigent-c, aigent-nakamoto,
                                      moneypenny, metaye)
  - 'kn0w1,marketa,quill'          → enabled for the listed ids only

aigent-z and aigent-c are the system-orchestrator and customer-guide
layers of aigentMe itself, so setting the env to 'all' covers
aigentMe-as-orchestrator through the same path as every other
specialist.

The aigentMe-direct API routes (brief, move-forward, venture-progress)
are not yet wired — they live outside ask-agent and will get the same
treatment in a follow-up. Today's pattern A scope is intentionally
ask-agent only so the regression surface stays bounded.

Everything else from phase 2a holds: gather failure falls through
silently, T0 stops at the gateway, one receipt per execution, and the
work order's policyHash + cohortAliasCommitment are the only
identifiers that cross into the adapter.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/assistant/ask-agent/route.ts` |

## Stats

 2 files changed, 31 insertions(+), 12 deletions(-)
