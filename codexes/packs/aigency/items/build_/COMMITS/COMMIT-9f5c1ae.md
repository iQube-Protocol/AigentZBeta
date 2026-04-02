# Commit Brief: `9f5c1ae` — fix: Add PDF viewer support to SmartContentActionContext

| Field | Value |
|-------|-------|
| SHA | [`9f5c1ae`](https://github.com/iQube-Protocol/AigentZBeta/commit/9f5c1aec664cca2be522d93a6e143571867c91d4) |
| Author | Kn0w-1 |
| Date | 2025-12-27T09:37:36Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix: Add PDF viewer support to SmartContentActionContext

- Import PDFPageViewer into context
- Add pdf_cid/pdf_lite_url to SmartContentItem interface
- Handle PDFs in 'read' action (check for cid/available before text)
- Render PDFPageViewer when PDF content is opened

This fixes blank pages in Scrolls tab which was only handling
text articles via ArticleReader, not PDFs.
```

## Files Changed

_File details not available in backfill — see commit link above._
