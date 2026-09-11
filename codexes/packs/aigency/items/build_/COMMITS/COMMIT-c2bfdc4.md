# Commit Brief: `c2bfdc4` — capability gateway phase 2c — pre-flight gather on aigentMe progression surfaces

| Field | Value |
|-------|-------|
| SHA | [`c2bfdc4`](https://github.com/iQube-Protocol/AigentZBeta/commit/c2bfdc401a4434b9ac726651895a0a92454211d1) |
| Author | Claude |
| Date | 2026-05-24T09:21:28Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
capability gateway phase 2c — pre-flight gather on aigentMe progression surfaces

Wires the shared preflight helper into the three aigentMe-direct
experience-model progression endpoints — brief, move-forward, and
venture-progress. These are the surfaces that drive ExperienceQube
state and will be among the primary consumers of OpenClaw and future
capability adapters.

Refactor:
  services/capabilities/preflight.ts (new)
    - runPreflightGather(persona, surfaceId, query, cartridge, …)
    - isPreflightEnabledFor(surfaceId) reads CAPABILITY_GATEWAY_PREFLIGHT
      ('off' | 'all' | 'true' | comma-list)
    - Returns { workOrderId, summary, policyHash } | null
    - Centralises the persona-scope PolicyEnvelope build, the throw-
      catch, and the gateway → adapter → receipt dispatch

Surfaces wired:
  app/api/assistant/ask-agent/route.ts
    - Now uses runPreflightGather. surfaceId = the resolved specialist id
      so the env allowlist still targets specialists by name.
  app/api/assistant/brief/route.ts
    - surfaceId = 'brief'. Query reflects briefType + cartridge so a
      future search tool can return audience-appropriate context.
  app/api/assistant/move-forward/route.ts
    - surfaceId = 'move-forward'. Query reflects scoped cartridge.
  app/api/assistant/venture-progress/route.ts
    - surfaceId = 'venture-progress'. Query reflects scoped cartridge.

Response shape: when the gather succeeds, the route adds an optional
preflightContext: { workOrderId, summary, policyHash } field next to
the existing builder response. Callers that don't know about the field
ignore it; future UI can surface 'aigentMe gathered: <summary>' inline
on the brief / NBE / venture cards.

Env knob:
  CAPABILITY_GATEWAY_PREFLIGHT='all'
    → enables for every specialist AND all three aigentMe-direct
      progression surfaces.
  CAPABILITY_GATEWAY_PREFLIGHT='brief,move-forward,venture-progress'
    → enables only on the aigentMe progression surfaces (leaves the
      eight specialists untouched).
  CAPABILITY_GATEWAY_PREFLIGHT='aigent-z,aigent-c,brief'
    → mixes specialists and aigentMe-direct surfaces.

Failure semantics unchanged: any deny / adapter failure / throw causes
the gather to return null and the route proceeds with the original
builder response.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Wires the shared preflight helper into the three aigentMe-direct
experience-model progression endpoints — brief, move-forward, and
venture-progress. These are the surfaces that drive ExperienceQube
state and will be among the primary consumers of OpenClaw and future
capability adapters.

Refactor:
  services/capabilities/preflight.ts (new)
    - runPreflightGather(persona, surfaceId, query, cartridge, …)
    - isPreflightEnabledFor(surfaceId) reads CAPABILITY_GATEWAY_PREFLIGHT
      ('off' | 'all' | 'true' | comma-list)
    - Returns { workOrderId, summary, policyHash } | null
    - Centralises the persona-scope PolicyEnvelope build, the throw-
      catch, and the gateway → adapter → receipt dispatch

Surfaces wired:
  app/api/assistant/ask-agent/route.ts
    - Now uses runPreflightGather. surfaceId = the resolved specialist id
      so the env allowlist still targets specialists by name.
  app/api/assistant/brief/route.ts
    - surfaceId = 'brief'. Query reflects briefType + cartridge so a
      future search tool can return audience-appropriate context.
  app/api/assistant/move-forward/route.ts
    - surfaceId = 'move-forward'. Query reflects scoped cartridge.
  app/api/assistant/venture-progress/route.ts
    - surfaceId = 'venture-progress'. Query reflects scoped cartridge.

Response shape: when the gather succeeds, the route adds an optional
preflightContext: { workOrderId, summary, policyHash } field next to
the existing builder response. Callers that don't know about the field
ignore it; future UI can surface 'aigentMe gathered: <summary>' inline
on the brief / NBE / venture cards.

Env knob:
  CAPABILITY_GATEWAY_PREFLIGHT='all'
    → enables for every specialist AND all three aigentMe-direct
      progression surfaces.
  CAPABILITY_GATEWAY_PREFLIGHT='brief,move-forward,venture-progress'
    → enables only on the aigentMe progression surfaces (leaves the
      eight specialists untouched).
  CAPABILITY_GATEWAY_PREFLIGHT='aigent-z,aigent-c,brief'
    → mixes specialists and aigentMe-direct surfaces.

Failure semantics unchanged: any deny / adapter failure / throw causes
the gather to return null and the route proceeds with the original
builder response.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/assistant/ask-agent/route.ts` |
| Modified | `app/api/assistant/brief/route.ts` |
| Modified | `app/api/assistant/move-forward/route.ts` |
| Modified | `app/api/assistant/venture-progress/route.ts` |
| Added | `services/capabilities/preflight.ts` |

## Stats

 6 files changed, 172 insertions(+), 72 deletions(-)
