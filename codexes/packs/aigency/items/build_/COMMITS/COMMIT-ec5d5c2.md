# Commit Brief: `ec5d5c2` — Add stage invalidation tombstone so a correction's removal is durable

| Field | Value |
|-------|-------|
| SHA | [`ec5d5c2`](https://github.com/iQube-Protocol/AigentZBeta/commit/ec5d5c2671c64f8da4621c801714459e29d73f24) |
| Author | Claude |
| Date | 2026-08-10T03:43:53Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add stage invalidation tombstone so a correction's removal is durable

A governed correction (e.g. correct-premature-standing-seed) removed a
stage from canonicalStages, but recordJourneyResolution's union-only
merge let a later ordinary /state read re-derive and re-persist the
same stage via ratchet-synthesis (prior-resolution off a stale array
entry) — the correction self-reversed within hours. Add a persisted
invalidatedStages tombstone map (StageInvalidationRecord) that retires
only the prior-resolution ratchet shortcut for that stage id, never
the stage itself: live evidence can still legitimately re-establish it
via canonicalAuthority: 'evidence'. Wire the tombstone through
resolveMonotonicJourneyState's existing invalidatedStages input, the
state route's canonicalStages union + factoryIngested check, and the
correction route (which now also independently checks Ingest evidence
before deciding whether to tombstone 'deploy' alongside 'standing').

Add CANARY 7 covering the four required scenarios: regression
(tombstoned stage never resurrects across repeated reads), no
self-resurrection (stale array entry + tombstone yields no
prior-resolution synthesis), legitimate reacquisition (fresh evidence
re-establishes the stage post-tombstone via canonicalAuthority:
'evidence'), and state independence (correcting one stage leaves an
unrelated canonical stage untouched).
```

## Body

A governed correction (e.g. correct-premature-standing-seed) removed a
stage from canonicalStages, but recordJourneyResolution's union-only
merge let a later ordinary /state read re-derive and re-persist the
same stage via ratchet-synthesis (prior-resolution off a stale array
entry) — the correction self-reversed within hours. Add a persisted
invalidatedStages tombstone map (StageInvalidationRecord) that retires
only the prior-resolution ratchet shortcut for that stage id, never
the stage itself: live evidence can still legitimately re-establish it
via canonicalAuthority: 'evidence'. Wire the tombstone through
resolveMonotonicJourneyState's existing invalidatedStages input, the
state route's canonicalStages union + factoryIngested check, and the
correction route (which now also independently checks Ingest evidence
before deciding whether to tombstone 'deploy' alongside 'standing').

Add CANARY 7 covering the four required scenarios: regression
(tombstoned stage never resurrects across repeated reads), no
self-resurrection (stale array entry + tombstone yields no
prior-resolution synthesis), legitimate reacquisition (fresh evidence
re-establishes the stage post-tombstone via canonicalAuthority:
'evidence'), and state independence (correcting one stage leaves an
unrelated canonical stage untouched).

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/journey/moneypenny-horizen/state/route.ts` |
| Modified | `app/api/ops/journey/correct-premature-standing-seed/route.ts` |
| Modified | `services/journey/stageResolution.ts` |
| Modified | `tests/journey-monotonic-admission.test.ts` |

## Stats

 4 files changed, 313 insertions(+), 26 deletions(-)
