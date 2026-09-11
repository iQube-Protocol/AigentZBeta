# Commit Brief: `c401293` — Add scoped, admin-gated indexing repair (explicit doc-id scope, no global embedding fallback)

| Field | Value |
|-------|-------|
| SHA | [`c401293`](https://github.com/iQube-Protocol/AigentZBeta/commit/c401293d2c7588351995c1a6dd9f698dd7dc97d2) |
| Author | Claude |
| Date | 2026-09-03T06:10:35Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Add scoped, admin-gated indexing repair (explicit doc-id scope, no global embedding fallback)

The existing embedding drain (embeddingService.processUnembeddedChunks,
already reachable unscoped from the admin ingest-polity-commentary route)
has no domain or document filter at all — it processes chunks across
every domain, including the private homecoming KB, as a side effect of
indexing public content. This adds the safe alternative, additively,
without touching the existing hazardous function:

- embeddingService.processUnembeddedChunksForDocuments(documentIds, ...):
  requires a non-empty documentIds array (no unscoped mode), filters
  chunks by .in('document_id', documentIds).
- knowledgeBaseService.chunkExistingDocument(documentId, text): chunks an
  EXISTING row in place, never deletes/reinserts (unlike
  ingestTextDocument's delete-then-recreate idempotency, which would mint
  a new document id and lose provenance on an already hash-verified
  manuscript row) — refuses to re-chunk a document that already has
  chunks.
- POST/GET /api/admin/kb/index-scoped: admin-gated (same ADMIN_OPS_TOKEN/
  persona pattern as the existing ingest route), resolves every requested
  document id's ACTUAL domain from the database and rejects the WHOLE
  request if any id is missing or resolves to a domain outside its
  explicit ALLOWED_DOMAINS allowlist (currently just 'qriptopian') —
  never trusts a caller-supplied domain string. Bounded per batch,
  resumable (already-embedded chunks are skipped on a repeat call), and
  honestly reports embeddingsAvailable: false rather than fabricating
  readiness when no provider is configured.

Not yet run against the 21 pending Qriptopian documents in production —
this commit is the safe implementation; execution requires sourcing each
document's verified text per-call (this route deliberately has no opinion
on where that comes from) and confirmed embedding credentials, neither of
which this pass completes. See the accompanying closeout report for the
precise remaining blocker.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy
```

## Body

The existing embedding drain (embeddingService.processUnembeddedChunks,
already reachable unscoped from the admin ingest-polity-commentary route)
has no domain or document filter at all — it processes chunks across
every domain, including the private homecoming KB, as a side effect of
indexing public content. This adds the safe alternative, additively,
without touching the existing hazardous function:

- embeddingService.processUnembeddedChunksForDocuments(documentIds, ...):
  requires a non-empty documentIds array (no unscoped mode), filters
  chunks by .in('document_id', documentIds).
- knowledgeBaseService.chunkExistingDocument(documentId, text): chunks an
  EXISTING row in place, never deletes/reinserts (unlike
  ingestTextDocument's delete-then-recreate idempotency, which would mint
  a new document id and lose provenance on an already hash-verified
  manuscript row) — refuses to re-chunk a document that already has
  chunks.
- POST/GET /api/admin/kb/index-scoped: admin-gated (same ADMIN_OPS_TOKEN/
  persona pattern as the existing ingest route), resolves every requested
  document id's ACTUAL domain from the database and rejects the WHOLE
  request if any id is missing or resolves to a domain outside its
  explicit ALLOWED_DOMAINS allowlist (currently just 'qriptopian') —
  never trusts a caller-supplied domain string. Bounded per batch,
  resumable (already-embedded chunks are skipped on a repeat call), and
  honestly reports embeddingsAvailable: false rather than fabricating
  readiness when no provider is configured.

Not yet run against the 21 pending Qriptopian documents in production —
this commit is the safe implementation; execution requires sourcing each
document's verified text per-call (this route deliberately has no opinion
on where that comes from) and confirmed embedding credentials, neither of
which this pass completes. See the accompanying closeout report for the
precise remaining blocker.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S5Y1pnDdW3LyguwPdfJjXy

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/admin/kb/index-scoped/route.ts` |
| Modified | `services/content/embeddingService.ts` |
| Modified | `services/content/knowledgeBaseService.ts` |
| Added | `tests/kb-scoped-indexing-repair.test.ts` |

## Stats

 4 files changed, 432 insertions(+)
