# Commit Brief: `c45d510` — Distinguish unreadable matrix reads from genuine defaults in experienceMatrixDeriver

| Field | Value |
|-------|-------|
| SHA | [`c45d510`](https://github.com/iQube-Protocol/AigentZBeta/commit/c45d510ac07e88c182c98b6be07600700f20ddef) |
| Author | Claude |
| Date | 2026-09-01T13:02:03Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Distinguish unreadable matrix reads from genuine defaults in experienceMatrixDeriver

deriveMatrixCalibration swallowed a thrown/error-shaped read on experience_qubes
or venture_qubes identically to "no row found", collapsing both into
source: 'default' — a real outage looked exactly like a persona who never
configured an experience model. Applies the Track 2 invariant here too
(unknown is not empty; read failure must never become state): a genuine
missing-table error (PGRST205/42P01) is still treated as not-configured
(unchanged), but any other failure now sets uncertain: true and
unreadableSources, so an authoritative consumer can tell the two states
apart instead of confidently reading a failed read as a confirmed beginner
position.
```

## Body

deriveMatrixCalibration swallowed a thrown/error-shaped read on experience_qubes
or venture_qubes identically to "no row found", collapsing both into
source: 'default' — a real outage looked exactly like a persona who never
configured an experience model. Applies the Track 2 invariant here too
(unknown is not empty; read failure must never become state): a genuine
missing-table error (PGRST205/42P01) is still treated as not-configured
(unchanged), but any other failure now sets uncertain: true and
unreadableSources, so an authoritative consumer can tell the two states
apart instead of confidently reading a failed read as a confirmed beginner
position.

## Files Changed

| Change | File |
|--------|------|
| Modified | `services/strategy/experienceMatrixDeriver.ts` |
| Added | `tests/experience-matrix-uncertainty.test.ts` |

## Stats

 2 files changed, 196 insertions(+), 6 deletions(-)
