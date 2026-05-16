# Commit Brief: `af22afd` — codex GN: restore masterId-proxy page-by-page rendering (from 0feeb548)

| Field | Value |
|-------|-------|
| SHA | [`af22afd`](https://github.com/iQube-Protocol/AigentZBeta/commit/af22afd4f904707339fbbe04f7ba04cc11ba5158) |
| Author | Claude |
| Date | 2026-05-16T22:06:10Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
codex GN: restore masterId-proxy page-by-page rendering (from 0feeb548)

The 430MB GN cannot render in <object>/<iframe> within any reasonable
timeout — browsers attempt to buffer the entire PDF before showing the
first page. Native browser rendering only works for files under ~50MB
on typical links. The fix restored here is the masterId proxy pattern
that briefly shipped in commit 0feeb548 and was reverted as collateral
damage in 3556c3d5 — its revert message says "remove masterId proxy
route" as part of a broader mobile-fix rollback, not because the
pattern itself was broken.

Three coordinated changes:

1) NEW /api/content/pdf-page-by-master/[masterId]/route.ts — server-side
   per-page WebP renderer. Validates persona entitlement via
   userOwnsAsset() before touching the PDF. Fetches the Supabase URL
   server-side (raw URL never reaches client), renders the requested
   page with pdfjs + @napi-rs/canvas + sharp, returns a small WebP
   under Lambda's 6MB body cap. Supports ?meta=1 for page-count
   discovery without rendering.

2) PDFPageViewer — props extended to accept masterId + personaId in
   addition to cid. When masterId is set, manifest + per-page images
   route through the gated master proxy. cid mode unchanged.

3) KnytTab — AGN/GN card click now sets currentPdfMasterId =
   mk_ep00_print_common and clears lite_url/cid. Viewer block routes
   to PDFPageViewer with masterId regardless of device (430MB requires
   page-by-page rendering on every viewport). Episodes 0..12 retain
   the existing routing: PDFLiteReaderModal on desktop, PDFPageViewer
   with cid on mobile.

Result: GN first page paints in ~5-10 seconds via the proxy. Subsequent
pages cache-hit through the page-image cache and serve from memory.
Episodes 0..12 unaffected — they don't need the masterId path because
their pdf_lite_url files are small enough for <object> to handle.
```

## Body

The 430MB GN cannot render in <object>/<iframe> within any reasonable
timeout — browsers attempt to buffer the entire PDF before showing the
first page. Native browser rendering only works for files under ~50MB
on typical links. The fix restored here is the masterId proxy pattern
that briefly shipped in commit 0feeb548 and was reverted as collateral
damage in 3556c3d5 — its revert message says "remove masterId proxy
route" as part of a broader mobile-fix rollback, not because the
pattern itself was broken.

Three coordinated changes:

1) NEW /api/content/pdf-page-by-master/[masterId]/route.ts — server-side
   per-page WebP renderer. Validates persona entitlement via
   userOwnsAsset() before touching the PDF. Fetches the Supabase URL
   server-side (raw URL never reaches client), renders the requested
   page with pdfjs + @napi-rs/canvas + sharp, returns a small WebP
   under Lambda's 6MB body cap. Supports ?meta=1 for page-count
   discovery without rendering.

2) PDFPageViewer — props extended to accept masterId + personaId in
   addition to cid. When masterId is set, manifest + per-page images
   route through the gated master proxy. cid mode unchanged.

3) KnytTab — AGN/GN card click now sets currentPdfMasterId =
   mk_ep00_print_common and clears lite_url/cid. Viewer block routes
   to PDFPageViewer with masterId regardless of device (430MB requires
   page-by-page rendering on every viewport). Episodes 0..12 retain
   the existing routing: PDFLiteReaderModal on desktop, PDFPageViewer
   with cid on mobile.

Result: GN first page paints in ~5-10 seconds via the proxy. Subsequent
pages cache-hit through the page-image cache and serve from memory.
Episodes 0..12 unaffected — they don't need the masterId path because
their pdf_lite_url files are small enough for <object> to handle.

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Added | `app/api/content/pdf-page-by-master/[masterId]/route.ts` |
| Modified | `app/triad/components/codex/tabs/KnytTab.tsx` |
| Modified | `app/triad/components/content/PDFPageViewer.tsx` |

## Stats

 4 files changed, 391 insertions(+), 27 deletions(-)
