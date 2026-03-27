# Commit Brief: `17395be` — feat: Add pdf_lite_url generation for encrypted PDFs

| Field | Value |
|-------|-------|
| SHA | [`17395be`](https://github.com/iQube-Protocol/AigentZBeta/commit/17395bee2173abf30446be27f6566fb3efe20f4c) |
| Author | Kn0w-1 |
| Date | 2025-12-27T02:12:00Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: Add pdf_lite_url generation for encrypted PDFs

Created API endpoint and script to generate unencrypted PDF files for direct viewing:
- POST /api/admin/generate-pdf-lite - API endpoint to process PDFs
- scripts/generate-pdf-lite-urls.ts - Standalone script (has env loading issues)
- scripts/migrations/add_page_count_to_assets.sql - DB migration for page_count caching

Process:
1. Downloads encrypted PDF from Autonomys
2. Decrypts using CODEX_MASTER_KEY
3. Uploads to Supabase Storage (content-media/pdf-lite/)
4. Updates database with public pdf_lite_url

This enables PDF viewing via iframe instead of server-side page rendering,
avoiding PDF.js worker file issues in Amplify standalone builds.
```

## Files Changed

_File details not available in backfill — see commit link above._
