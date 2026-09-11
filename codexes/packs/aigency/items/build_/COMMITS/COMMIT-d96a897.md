# Commit Brief: `d96a897` — Fix EXP-P1 frozen crystal membership recovery: drop status filter

| Field | Value |
|-------|-------|
| SHA | [`d96a897`](https://github.com/iQube-Protocol/AigentZBeta/commit/d96a897ebf5d886e9c66a05b2a87cc41bd9a9682) |
| Author | Claude |
| Date | 2026-08-30T00:11:24Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Fix EXP-P1 frozen crystal membership recovery: drop status filter

buildFrozenCrystalManifest queried domain membership with
status: ['validated','canonical'], which silently excludes any member
whose status has since changed (e.g. merged as a duplicate via
mergeInvariants). This is why the live endpoint reconstructed vP1's
frozen 15-member crystal as an 11-member corpus: 4 members were
reviewed and frozen while validated, then later merged as duplicates,
and a status-filtered re-query dropped exactly the members most
relevant to Austin's duplication objection.

Domain membership (invariant_contexts) is durable and independent of a
member's current, mutable status — mergeInvariants() flips status to
'superseded' but never removes the domain-context row. Dropping the
status filter recovers the true frozen membership.

Hash equality against the frozen commitment can still legitimately
fail for members whose current status differs from any freeze-eligible
value, since no historical status ledger is persisted anywhere to
recover their status at the freeze instant. The mismatch branch now
names this precisely (which members, which statuses) as a diagnostic,
rather than reporting an opaque "corpus has moved" message that
conflates a real membership gap with unrecoverable historical status
drift.

No change to the scientific gate, remediation criteria, Austin
mappings, instrument thresholds, or hash-covered field set.
```

## Body

buildFrozenCrystalManifest queried domain membership with
status: ['validated','canonical'], which silently excludes any member
whose status has since changed (e.g. merged as a duplicate via
mergeInvariants). This is why the live endpoint reconstructed vP1's
frozen 15-member crystal as an 11-member corpus: 4 members were
reviewed and frozen while validated, then later merged as duplicates,
and a status-filtered re-query dropped exactly the members most
relevant to Austin's duplication objection.

Domain membership (invariant_contexts) is durable and independent of a
member's current, mutable status — mergeInvariants() flips status to
'superseded' but never removes the domain-context row. Dropping the
status filter recovers the true frozen membership.

Hash equality against the frozen commitment can still legitimately
fail for members whose current status differs from any freeze-eligible
value, since no historical status ledger is persisted anywhere to
recover their status at the freeze instant. The mismatch branch now
names this precisely (which members, which statuses) as a diagnostic,
rather than reporting an opaque "corpus has moved" message that
conflates a real membership gap with unrecoverable historical status
drift.

No change to the scientific gate, remediation criteria, Austin
mappings, instrument thresholds, or hash-covered field set.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `services/research/crystalFrozenManifest.ts` |
| Modified | `tests/crystal-frozen-manifest.test.ts` |

## Stats

 3 files changed, 125 insertions(+), 3 deletions(-)
