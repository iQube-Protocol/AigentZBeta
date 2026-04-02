# Commit Brief: `3404b2c` — fix: Replace pdfjs-dist with pdf-lib for production-safe PDF parsing

| Field | Value |
|-------|-------|
| SHA | [`3404b2c`](https://github.com/iQube-Protocol/AigentZBeta/commit/3404b2ce89cdb5fc7f12a52231623a4bbd5c2feb) |
| Author | Kn0w-1 |
| Date | 2025-12-27T01:14:20Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Replace pdfjs-dist with pdf-lib for production-safe PDF parsing

pdfjs-dist requires worker files that don't get bundled in Next.js standalone
builds, causing 'Cannot find module pdf.worker.mjs' errors in Amplify/Lambda.

Solution:
- Use pdf-lib (pure JS, no workers) for page count via PDFDocument.load()
- Add page_count column to codex_media_assets and master_content_qubes
- Cache page counts in DB to avoid re-downloading/decrypting PDFs
- Remove Promise.withResolvers polyfill (no longer needed)
- Simplified error handling with CORS headers always returned

Benefits:
- Works in AWS Lambda/Amplify standalone environment
- Fast path for cached page counts (instant response)
- No worker bundling issues
- Production-safe and reliable
```

## Files Changed

_File details not available in backfill — see commit link above._
