# Commit Brief: `2c25762` — CFS-035: standing-score shadow node + standalone-standing-canister stub/backlog

| Field | Value |
|-------|-------|
| SHA | [`2c25762`](https://github.com/iQube-Protocol/AigentZBeta/commit/2c257625fac35d7fbdc87886fc8e643be38fa4c9) |
| Author | Claude |
| Date | 2026-07-16T16:55:25Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
CFS-035: standing-score shadow node + standalone-standing-canister stub/backlog

Operator direction #3: instrument standing; stub + backlog a standalone standing
canister; flip live after shadow testing.

- engine: add the scalar VALUE-projection path (ValueProjection/runValueShadow)
  for nodes whose decision is a value (weight/threshold/score), not a ranking —
  covering the magic-number/threshold forms.
- nodes/standingScore.ts: re-expresses the Standing composite (veracity*0.7 +
  contribution*0.3) as a transparent value projection over veracity/contribution
  with explicit weights. Faithful by construction (same blend + clamp).
- standingScore.ts: shadow-wired (server-only) — emits the delta, serves the
  incumbent score unchanged.
- services/standing/standingCanister.ts (stub): the intended standalone Standing
  canister surface — manage standing independently of reputation, correlate on
  demand; T2-safe standingRef commitments, no raw personaId. No canister
  deployed; falls through to local computation.
- backlog doc for the canister build (deploy + IC actor + migration +
  correlation surface + T-tier canary), registered in agentiq updates.

Verified faithful re-expression 6/6 via harness + parse gates. Observe-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

Operator direction #3: instrument standing; stub + backlog a standalone standing
canister; flip live after shadow testing.

- engine: add the scalar VALUE-projection path (ValueProjection/runValueShadow)
  for nodes whose decision is a value (weight/threshold/score), not a ranking —
  covering the magic-number/threshold forms.
- nodes/standingScore.ts: re-expresses the Standing composite (veracity*0.7 +
  contribution*0.3) as a transparent value projection over veracity/contribution
  with explicit weights. Faithful by construction (same blend + clamp).
- standingScore.ts: shadow-wired (server-only) — emits the delta, serves the
  incumbent score unchanged.
- services/standing/standingCanister.ts (stub): the intended standalone Standing
  canister surface — manage standing independently of reputation, correlate on
  demand; T2-safe standingRef commitments, no raw personaId. No canister
  deployed; falls through to local computation.
- backlog doc for the canister build (deploy + IC actor + migration +
  correlation surface + T-tier canary), registered in agentiq updates.

Verified faithful re-expression 6/6 via harness + parse gates. Observe-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-18_standalone-standing-canister-backlog.md` |
| Modified | `services/invariants/engine.ts` |
| Added | `services/invariants/nodes/standingScore.ts` |
| Added | `services/standing/standingCanister.ts` |
| Modified | `services/standing/standingScore.ts` |

## Stats

 6 files changed, 267 insertions(+)
