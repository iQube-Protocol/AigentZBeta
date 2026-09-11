# Commit Brief: `5eb4d29` — Fix correction route's tombstone catch-up gap for pre-fix corrections

| Field | Value |
|-------|-------|
| SHA | [`5eb4d29`](https://github.com/iQube-Protocol/AigentZBeta/commit/5eb4d293a4ff8c785d994085050f2f98b5137382) |
| Author | Claude |
| Date | 2026-08-10T04:24:39Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix correction route's tombstone catch-up gap for pre-fix corrections

A correction that ran before the stage-invalidation tombstone existed
(evidence-layer steps applied, tombstone step never written because it
didn't exist yet) made every subsequent call report NOT_PREMATURE
forever: resolveStandingEvidence moves an already-discrepancy-named
receipt into supersededReceiptIds, so sequencingViolationReceiptIds is
empty on the second call, even though canonicalStages still
self-resurrects the stage via ratchet-synthesis. Live MoneyPenny hit
this exactly: its 2026-08-09 correction predated the tombstone fix.

Add a catch-up branch: when there's no live violation but the settled
fact is already invalidated and a stale, untombstoned stage entry is
still sitting in canonicalStages, proceed to write the missing
tombstone without duplicating the discrepancy receipt (reuse the
existing one's id for provenance instead of writing a new one).
```

## Body

A correction that ran before the stage-invalidation tombstone existed
(evidence-layer steps applied, tombstone step never written because it
didn't exist yet) made every subsequent call report NOT_PREMATURE
forever: resolveStandingEvidence moves an already-discrepancy-named
receipt into supersededReceiptIds, so sequencingViolationReceiptIds is
empty on the second call, even though canonicalStages still
self-resurrects the stage via ratchet-synthesis. Live MoneyPenny hit
this exactly: its 2026-08-09 correction predated the tombstone fix.

Add a catch-up branch: when there's no live violation but the settled
fact is already invalidated and a stale, untombstoned stage entry is
still sitting in canonicalStages, proceed to write the missing
tombstone without duplicating the discrepancy receipt (reuse the
existing one's id for provenance instead of writing a new one).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/ops/journey/correct-premature-standing-seed/route.ts` |
| Added | `tests/correct-premature-standing-seed-route.test.ts` |

## Stats

 2 files changed, 282 insertions(+), 27 deletions(-)
