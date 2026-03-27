# Commit Brief: `db7e252` — fix: Add missing partitionId prop to admin reputation page

| Field | Value |
|-------|-------|
| SHA | [`db7e252`](https://github.com/iQube-Protocol/AigentZBeta/commit/db7e25202e17d55c6d17951dbf1b54b23689d227) |
| Author | Know1 |
| Date | 2025-10-21T21:18:19Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add missing partitionId prop to admin reputation page

BUILD FIX: TypeScript compilation error in production

ERROR:
Property 'partitionId' is missing in type '{ bucketId: any; onSuccess: () => Promise<void>; }'
but required in type 'EvidenceSubmissionFormProps'.

SOLUTION:
Added partitionId={selectedPersona.id} to EvidenceSubmissionForm component

This fixes the Amplify build failure.
```

## Files Changed

_File details not available in backfill — see commit link above._
