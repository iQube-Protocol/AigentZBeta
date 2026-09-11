# Commit Brief: `76a1012` — feat(intent chain): emit specialist_invoked + clickable workbench pills

| Field | Value |
|-------|-------|
| SHA | [`76a1012`](https://github.com/iQube-Protocol/AigentZBeta/commit/76a1012c84a134a471fe84f877deb83af6f2e7e5) |
| Author | Claude |
| Date | 2026-06-03T05:47:06Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat(intent chain): emit specialist_invoked + clickable workbench pills

Two surgical fixes for the chain-of-intent gap on myWorkbench:

1. /api/assistant/intent now emits one specialist_invoked
   orchestration_events row per non-aigent-me target agent at intent
   creation. Fire-and-forget so latency unchanged. metadata carries
   intent_id + specialist + nbe_id (T0 fields excluded). Makes the
   "Aigent Z will liaise with Marketa" pill copy backed by a real
   receipt-eligible event the timeline can render.

2. New GET /api/assistant/intent-chain?intentId=<uuid> returns the
   orchestration_events timeline for a single intent + the attached
   intent_chains row (when present). Owner-gated via spine: caller
   must match the intent's persona_id.

3. WorkbenchLedger pills now expand on click. Lazy fetches the chain
   timeline on first expand; renders an inline panel with the chain
   header (template id + step progress + cost + status) and an event
   timeline (from-role -> specialist label, reason, receipt indicator,
   relative timestamp). Orphan compose-strip entries unchanged.
```

## Body

Two surgical fixes for the chain-of-intent gap on myWorkbench:

1. /api/assistant/intent now emits one specialist_invoked
   orchestration_events row per non-aigent-me target agent at intent
   creation. Fire-and-forget so latency unchanged. metadata carries
   intent_id + specialist + nbe_id (T0 fields excluded). Makes the
   "Aigent Z will liaise with Marketa" pill copy backed by a real
   receipt-eligible event the timeline can render.

2. New GET /api/assistant/intent-chain?intentId=<uuid> returns the
   orchestration_events timeline for a single intent + the attached
   intent_chains row (when present). Owner-gated via spine: caller
   must match the intent's persona_id.

3. WorkbenchLedger pills now expand on click. Lazy fetches the chain
   timeline on first expand; renders an inline panel with the chain
   header (template id + step progress + cost + status) and an event
   timeline (from-role -> specialist label, reason, receipt indicator,
   relative timestamp). Orphan compose-strip entries unchanged.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/assistant/intent-chain/route.ts` |
| Modified | `app/api/assistant/intent/route.ts` |
| Modified | `components/metame/workbench/WorkbenchLedger.tsx` |

## Stats

 3 files changed, 520 insertions(+), 28 deletions(-)
