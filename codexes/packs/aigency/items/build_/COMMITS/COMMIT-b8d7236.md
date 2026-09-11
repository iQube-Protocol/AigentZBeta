# Commit Brief: `b8d7236` — Add narrowly-versioned legacy freeze verification (byte-exact | scientific-content-verified | unverified)

| Field | Value |
|-------|-------|
| SHA | [`b8d7236`](https://github.com/iQube-Protocol/AigentZBeta/commit/b8d7236ac720d7b04354de9d7822538eeb10662d) |
| Author | Claude |
| Date | 2026-08-30T01:59:30Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add narrowly-versioned legacy freeze verification (byte-exact | scientific-content-verified | unverified)

verifiedAgainstFreeze stays strict and unchanged: it answers only whether
the live domain corpus reproduces the frozen contentHash byte-for-byte.
For vP1 it does not, because status (one of the seven hash-covered
fields) is known to have changed for members later merged as
duplicates, and no historical status snapshot exists.

Adds a separate, derived classification alongside it:

- services/research/crystalContentProjection.ts: extracts the
  hash-covered per-invariant projection that crystalStatistics.ts and
  crystalFrozenManifest.ts each independently duplicated. Field names
  are never hand-maintained as a second list.

- services/research/crystalLegacyContentVerification.ts: derives
  'byte-exact' | 'scientific-content-verified' | 'unverified' at read
  time (never a stored assertion). scientific-content-verified requires,
  for every recovered member: no evidence the seed-ingest script ever
  touched it, and no provenanceReclassifications event at or after
  frozenAt. Any drift outside status, or unparseable/incomplete
  evidence, or incomplete membership recovery, fails closed to
  unverified.

- crystalFrozenManifest.ts / crystalStatistics.ts: refactored onto the
  shared projection (no hash-value change); crystalFrozenManifest.ts
  now also computes legacyContentVerification alongside
  verifiedAgainstFreeze in every branch.

- instrument-falsification/route.ts: discloses
  frozenArtifact.legacyContentVerification. Disclosure only —
  composeCrystalRetrospectiveFalsification, reproducedReviewerObjections,
  and remediation-profile binding are untouched.

21 new tests cover the full acceptance list: pristine byte-exact; the
EXP-P1 legacy pattern → scientific-content-verified while
verifiedAgainstFreeze stays false; seed-ingest evidence; post-freeze
provenance reclassification; incomplete membership; unparseable
evidence; an unattributed hash mismatch never defaulting to
status-only; byteExact always mirroring verifiedAgainstFreeze.
```

## Body

verifiedAgainstFreeze stays strict and unchanged: it answers only whether
the live domain corpus reproduces the frozen contentHash byte-for-byte.
For vP1 it does not, because status (one of the seven hash-covered
fields) is known to have changed for members later merged as
duplicates, and no historical status snapshot exists.

Adds a separate, derived classification alongside it:

- services/research/crystalContentProjection.ts: extracts the
  hash-covered per-invariant projection that crystalStatistics.ts and
  crystalFrozenManifest.ts each independently duplicated. Field names
  are never hand-maintained as a second list.

- services/research/crystalLegacyContentVerification.ts: derives
  'byte-exact' | 'scientific-content-verified' | 'unverified' at read
  time (never a stored assertion). scientific-content-verified requires,
  for every recovered member: no evidence the seed-ingest script ever
  touched it, and no provenanceReclassifications event at or after
  frozenAt. Any drift outside status, or unparseable/incomplete
  evidence, or incomplete membership recovery, fails closed to
  unverified.

- crystalFrozenManifest.ts / crystalStatistics.ts: refactored onto the
  shared projection (no hash-value change); crystalFrozenManifest.ts
  now also computes legacyContentVerification alongside
  verifiedAgainstFreeze in every branch.

- instrument-falsification/route.ts: discloses
  frozenArtifact.legacyContentVerification. Disclosure only —
  composeCrystalRetrospectiveFalsification, reproducedReviewerObjections,
  and remediation-profile binding are untouched.

21 new tests cover the full acceptance list: pristine byte-exact; the
EXP-P1 legacy pattern → scientific-content-verified while
verifiedAgainstFreeze stays false; seed-ingest evidence; post-freeze
provenance reclassification; incomplete membership; unparseable
evidence; an unattributed hash mismatch never defaulting to
status-only; byteExact always mirroring verifiedAgainstFreeze.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/api/research/crystal/[experimentId]/instrument-falsification/route.ts` |
| Added | `services/research/crystalContentProjection.ts` |
| Modified | `services/research/crystalFrozenManifest.ts` |
| Added | `services/research/crystalLegacyContentVerification.ts` |
| Modified | `services/research/crystalStatistics.ts` |
| Modified | `tests/crystal-frozen-manifest.test.ts` |
| Added | `tests/crystal-legacy-content-verification.test.ts` |

## Stats

 8 files changed, 849 insertions(+), 35 deletions(-)
