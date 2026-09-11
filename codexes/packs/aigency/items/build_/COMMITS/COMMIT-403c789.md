# Commit Brief: `403c789` — fix chain timeline ordering: doc before analysis, original queue before specialist

| Field | Value |
|-------|-------|
| SHA | [`403c789`](https://github.com/iQube-Protocol/AigentZBeta/commit/403c7899e552a5bb943795e709a13e82f6dcbdb4) |
| Author | Claude |
| Date | 2026-06-05T22:04:04Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix chain timeline ordering: doc before analysis, original queue before specialist

Replace flat TYPE_ORDER map with per-row rowTypeOrder() function that
distinguishes original intent_queued receipts from recommendation-spawn
intent_queueds by their summary prefix.

Desired reading order:
  1. specialist_invoked event (by timestamp, earliest)
  2. Doc created (artifact_created → order 1)
  3. Original CTA queued 'Queued: …' (intent_queued, no 'next action' → order 2)
  4. Specialist analysis complete (specialist_consulted → order 3)
  5. Recommendation-spawn queued 'Queued next action: …' (→ order 10)
```

## Body

Replace flat TYPE_ORDER map with per-row rowTypeOrder() function that
distinguishes original intent_queued receipts from recommendation-spawn
intent_queueds by their summary prefix.

Desired reading order:
  1. specialist_invoked event (by timestamp, earliest)
  2. Doc created (artifact_created → order 1)
  3. Original CTA queued 'Queued: …' (intent_queued, no 'next action' → order 2)
  4. Specialist analysis complete (specialist_consulted → order 3)
  5. Recommendation-spawn queued 'Queued next action: …' (→ order 10)

## Files Changed

| Change | File |
|--------|------|
| Modified | `components/metame/workbench/IntentChainPanel.tsx` |

## Stats

 1 file changed, 30 insertions(+), 18 deletions(-)
