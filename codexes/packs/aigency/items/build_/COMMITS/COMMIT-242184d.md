# Commit Brief: `242184d` — DVN-anchor the shadow->authoritative flip (CFS-035 §11)

| Field | Value |
|-------|-------|
| SHA | [`242184d`](https://github.com/iQube-Protocol/AigentZBeta/commit/242184dc6530f48019c06211d97df2b13089e647) |
| Author | Claude |
| Date | 2026-07-16T19:54:06Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
DVN-anchor the shadow->authoritative flip (CFS-035 §11)

The operator-gated flip now lands in tamper-evident memory — provenance for the
ratification act.

- new action type invariant_node_flipped added to the ActivityActionType union
  and to ANCHORABLE_ACTION_TYPES (the only permitted unilateral DVN-pipeline
  change; no state machine / payload / hashing / finalizer touched). Operator-
  approved.
- /api/invariants/flip POST emits an activity receipt on a successful flip via
  the unified createActivityReceipt, which auto-enqueues the DVN anchor. Best-
  effort — the flip is already persisted, so a receipt failure never fails it.
- T2-safe: summary carries the public node id + new state + a sha256 commitment
  of the flip act; no raw personaId in the payload (pipeline hashes via
  hashPersonaRef, unmodified).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB
```

## Body

The operator-gated flip now lands in tamper-evident memory — provenance for the
ratification act.

- new action type invariant_node_flipped added to the ActivityActionType union
  and to ANCHORABLE_ACTION_TYPES (the only permitted unilateral DVN-pipeline
  change; no state machine / payload / hashing / finalizer touched). Operator-
  approved.
- /api/invariants/flip POST emits an activity receipt on a successful flip via
  the unified createActivityReceipt, which auto-enqueues the DVN anchor. Best-
  effort — the flip is already persisted, so a receipt failure never fails it.
- T2-safe: summary carries the public node id + new state + a sha256 commitment
  of the flip act; no raw personaId in the payload (pipeline hashes via
  hashPersonaRef, unmodified).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Y98FMjkM8zUDsYqJikzsMB

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/invariants/flip/route.ts` |
| Modified | `codexes/packs/agentiq/collections.json` |
| Added | `codexes/packs/agentiq/updates/2026-07-18_flip-dvn-anchor.md` |
| Modified | `services/dvn/activityReceiptDvnPipeline.ts` |
| Modified | `services/receipts/activityReceiptService.ts` |

## Stats

 5 files changed, 73 insertions(+), 1 deletion(-)
