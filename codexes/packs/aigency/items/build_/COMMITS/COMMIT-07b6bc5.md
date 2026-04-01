# Commit Brief: `07b6bc5` — feat: Add iframe PDF viewing with pdf_lite_url support

| Field | Value |
|-------|-------|
| SHA | [`07b6bc5`](https://github.com/iQube-Protocol/AigentZBeta/commit/07b6bc59b60775d3b3879714bb72624377f8b100) |
| Author | Kn0w-1 |
| Date | 2025-12-27T03:11:39Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
feat: Add iframe PDF viewing with pdf_lite_url support

- Modified PDFPageViewer to accept pdfLiteUrl prop
- Added iframe rendering when pdf_lite_url is available
- Falls back to page-by-page rendering if no pdf_lite_url
- Updated PDF meta endpoint to return pdf_lite_url in response
- Viewer now fetches pdf_lite_url from meta endpoint automatically

This enables direct PDF viewing via browser's native PDF renderer
instead of server-side page rendering, avoiding PDF.js worker issues.
```

## Files Changed

_File details not available in backfill — see commit link above._
