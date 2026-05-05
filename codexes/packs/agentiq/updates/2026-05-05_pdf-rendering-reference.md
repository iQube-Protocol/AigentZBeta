# PDF Rendering Reference — How to Get PDFs Inline Across Browsers

**Status:** must-read · canonical reference
**Last updated:** 2026-05-05
**Component:** `app/triad/components/content/PDFLiteReaderModal.tsx`
**Working baseline commit:** `5b38dda1` (desktop `<object>` + mobile `<iframe>` split)

---

## TL;DR — the rule

> Inside `PDFLiteReaderModal`, **desktop renders with `<object type="application/pdf">`** and **mobile renders with `<iframe>`**. Anything else has been tried and breaks at least one browser.

```tsx
{isMobile ? (
  <iframe src={safePdfUrl} ... />
) : (
  <object data={safePdfUrl} type="application/pdf" ... >
    <div>...fallback...</div>
  </object>
)}
```

`isMobile` is viewport-based: `window.matchMedia('(max-width: 767px)').matches`. Do **not** use User-Agent sniffing.

If you find yourself wanting to "simplify" this to a single element that works everywhere, **stop and read this doc first.** Every variation has been attempted and has known failure modes.

---

## Why this is non-obvious

PDFs in browsers depend on five things, all of which behave differently per browser/OS:

1. **Element type** — `<object>` vs `<iframe>` vs `<embed>` route through different rendering pipelines in each browser
2. **`Content-Disposition` response header** — `inline` vs `attachment` controls whether the browser renders or downloads
3. **Cross-origin policy** — the PDF URL is a Supabase Storage URL on `<project>.supabase.co`, the app is on `aigentz.me`; some browsers (especially Firefox) treat cross-origin PDFs differently in iframes
4. **OS / mobile behavior** — iOS Safari's iframe PDF viewer renders only the first page and cannot scroll/paginate within an iframe; this is a fundamental Safari limitation, not a bug we can fix in our code
5. **CDN / browser cache** — cached responses with stale `Content-Disposition: attachment` persist across normal hard refreshes; only private/incognito windows fully bypass it

The working pattern threads the needle on (1)–(5) for the surfaces we ship: desktop Brave, desktop Firefox, desktop Chrome, mobile Safari, mobile Chrome.

---

## What we tried that did NOT work

In chronological order, with failure mode for each:

### Attempt 1 — single `<iframe>` for all surfaces
- **Outcome:** Brave ✓, Firefox **downloads** instead of rendering, mobile ✓
- **Root cause:** Firefox treats cross-origin PDFs in `<iframe>` as downloads regardless of `Content-Disposition: inline`. This is Firefox's stricter cross-origin iframe-PDF policy. Hash params (`#toolbar=0`) had no effect on this behavior.
- **Why it tempts you:** It's one element, it works in Chromium, and it works on mobile — looks like the simplest solution. It is not.

### Attempt 2 — Update Supabase Storage object metadata to `Content-Disposition: inline`
- **SQL:** `UPDATE storage.objects SET metadata = metadata || '{"contentDisposition":"inline"}'::jsonb WHERE bucket_id = 'content-media' AND name LIKE 'pdf-lite/%';`
- **Outcome:** Fixed Brave/Chrome rendering (where they had been downloading too), but Firefox **still downloaded** even with the inline header.
- **Lesson:** Content-Disposition: inline is necessary but not sufficient for Firefox iframe PDFs. Keep the SQL fix in place — it's still required for Chromium browsers — but understand it does not solve Firefox.

### Attempt 3 — Fetch PDF into a local Blob URL, point iframe at `blob:`
- **Code change:** `fetch(pdfUrl).then(r => r.blob()).then(b => setBlobUrl(URL.createObjectURL(b)))` and `<iframe src={blobUrl}>`
- **Outcome:** Brave gained a regression (showed full native PDF viewer with thumbnail sidebar; hash params don't apply to `blob:` URLs), Firefox **still downloaded**, large files (GN, 25 pages) hit the 20s timeout.
- **Lesson:** Even a same-origin `blob:` URL routes through Firefox's iframe-PDF download policy. The PDF download trigger isn't about origin or Content-Disposition — it's about Firefox's iframe-PDF rendering pipeline itself.

### Attempt 4 — Same-origin streaming proxy
- **Idea:** `/api/content/pdf-view` route that fetches from Supabase server-side and streams back with `Content-Disposition: inline`.
- **Outcome:** Rejected before implementation — most KNYT episode PDFs are >6MB, which exceeds AWS Lambda's response payload limit on Amplify. Would 504 for the largest files.
- **Note:** A 302-redirect-only proxy (no body buffering) would avoid the 6MB limit but doesn't change Firefox's underlying iframe-PDF policy, so doesn't solve the actual problem.

### Attempt 5 — Detect Firefox and route to PDFPageViewer
- **Idea:** Hand Firefox off to the existing page-image renderer (which already works in Firefox).
- **Outcome:** Rejected — PDFPageViewer in this surface produced overlapping blank pages on Firefox; not a viable fallback for the lite reader flow.

### Attempt 6 (THE FIX) — Restore `<object>` for desktop, keep `<iframe>` for mobile
- **Pattern:** Historical `dbaab0bc`/`12fa5c22`/`69f57188` desktop split.
- **Outcome:** Brave ✓ (renders inline), Firefox ✓ (renders inline), mobile ✓ (renders inline first page).
- **Why it works:** `<object type="application/pdf">` routes through Firefox's plugin/pdf.js path, NOT its iframe-PDF download path. Firefox renders. Chromium browsers also render `<object>` PDFs inline — same path Brave's been using all along; just the element type changed.

---

## What broke this in the first place

Commit `a8f1f69a` (pre-this-debug-cycle session) changed the desktop element from `<object>` to `<iframe>` to fix a **mobile** download issue. The change worked on mobile but silently broke desktop Firefox. The session that made the change reported a Firefox `NS_ERROR_WONT_HANDLE_CONTENT` error on `<object>` — which may have been transient or surface-specific (it does not reproduce on the canonical KNYT codex flow today).

**Lesson:** never replace a long-standing `<object>` PDF element without testing every surface, especially Firefox. The element type is load-bearing.

---

## Browser behavior matrix (current working baseline)

| Surface | Element | Renders inline? | Notes |
|---|---|---|---|
| Brave desktop | `<object>` | ✓ | Renders via Chromium native PDF viewer |
| Chrome desktop | `<object>` | ✓ | Renders via Chromium native PDF viewer |
| Firefox desktop | `<object>` | ✓ | Renders via pdf.js plugin path |
| Safari desktop | `<object>` | ✓ (assumed) | WebKit renders `<object>` PDFs natively; verify if shipping to Mac Safari |
| Mobile Safari (iOS) | `<iframe>` | First page only | iOS WebKit limitation — no scroll within iframe-loaded PDFs |
| Mobile Chrome (Android) | `<iframe>` | First page (often) | Same iframe-PDF limitation as iOS |

---

## Open issues (NOT in current baseline)

### 1. Firefox 24s timeout flash on large PDFs
- The GN PDF (≈25 pages) takes 20+ seconds for Firefox's pdf.js to call `onLoad`. Bumped timeout from 20s → 24s in commit `3f07f3af`. The error message no longer flashes for GN.
- If a future PDF is even larger and re-introduces the flash, bump further (60s would be safe — the timeout is a UX safety net, not a security boundary).

### 2. Mobile renders too large (default zoom)
- iOS Safari renders PDF in iframe at native page width. On mobile viewports the PDF appears zoomed in.
- **Status:** parked. Mobile lite-reader is acceptable as-is for now (renders inline, no download). Video will be the more relevant mobile read mode once more motion comics are uploaded.
- **If revisited:** add `style={{ transform: 'scale(...)', transformOrigin: 'top left' }}` calculated from viewport width. Untested.

### 3. Mobile cannot paginate past page 1
- iOS Safari's iframe-PDF renderer shows only the first page and does not allow scrolling within the iframe. This is a WebKit limitation, not a bug in our code.
- **Status:** parked. Routing mobile to `PDFPageViewer` was considered and explicitly rejected — opens a different can of worms (overlapping blank pages on Firefox in our environment). Win banked on desktop + no-download mobile.
- **Future direction:** mobile read mode is being de-prioritized in favour of video (motion comics) once more videos are uploaded. PDF mobile is acceptable at first-page-only for now.

### 4. PDF URL exposure (security)
- The `pdf_lite_url` is currently a direct Supabase Storage public URL. A network-tab-savvy user can extract this URL and access the PDF outside the app's gate.
- **Status:** known and accepted for Phase 1. Documented in CLAUDE.md § "Phase 2 Backlog — Secure PDF URL handling" and in `2026-05-05_phase-2-backlog-tasks-rewards-pdf-persona.md`.
- **Phase 2 fix:** replace direct URL with `GET /api/content/pdf-signed/[masterId]` route that validates ownership and 302-redirects to a 5-min Supabase signed URL.

---

## Diagnostic playbook for future PDF render bugs

If a user reports "PDF downloads instead of renders" or "PDF won't open":

### Step 1 — confirm scope
1. Is it one browser or all? Brave/Chrome/Firefox/Safari/mobile?
2. Is it one surface (KNYT codex / metaMe runtime / thin-client / staging vs dev)?
3. Did it just start? What was the last deploy?

### Step 2 — rule out cache
1. Test in a private/incognito window in the affected browser. Hard refresh (Cmd+Shift+R) does NOT always clear cached `Content-Disposition` headers — only private windows do.
2. If private window works, it's cache. Tell user to clear cached web content. No code change needed.

### Step 3 — confirm Content-Disposition
1. Devtools → Network → click the PDF request → Response Headers
2. Should see `Content-Disposition: inline`. If you see `attachment`, run the SQL metadata patch (Attempt 2 above).
3. If headers look fine but Firefox still downloads, this is the iframe-policy issue — verify the desktop is rendering with `<object>`, not `<iframe>`.

### Step 4 — confirm element type
1. Open the PDFLiteReaderModal in DevTools while it's open. Inspect the rendered element.
2. Desktop should be `<object type="application/pdf">`. If it's `<iframe>`, someone "simplified" the code. Re-read this doc and revert.
3. Mobile should be `<iframe>`. If it's `<object>`, mobile may not render at all on iOS.

### Step 5 — last-resort options
- If `<object>` no longer renders on a major browser (browser version regression), the next option to try is `<embed src={url} type="application/pdf">`. It uses the same plugin path as `<object>` but with subtly different fallback behavior. Test in isolation first.
- If both `<object>` and `<embed>` fail, vendor `pdfjs-dist` and bundle our own viewer. This is a multi-day change and should be its own sprint.

---

## Code locations

- `app/triad/components/content/PDFLiteReaderModal.tsx` — desktop `<object>` / mobile `<iframe>` split (canonical baseline `5b38dda1`)
- `app/triad/components/content/PDFPageViewer.tsx` — fallback page-image renderer (used for Autonomys-only CIDs and for Firefox when lite reader can't be used)
- `app/contexts/SmartContentActionContext.tsx` — global PDF action handler that decides which viewer to open
- `app/api/admin/generate-pdf-lite/route.ts` — uploads PDFs to `content-media` bucket; should set `metadata: { contentDisposition: 'inline' }` on upload
- `app/api/content/pdf/[cid]/route.ts` — Autonomys CID proxy (for non-`pdf_lite_url` content)
- CLAUDE.md § "Gated Content — Confidential Exposure Rules" — viewer-split contract (`pdf_lite_url` → PDFLiteReaderModal, `pdf_cid` → PDFPageViewer, no `target="_blank"`)

---

## Maintenance rules

1. **Never replace `<object>` on desktop with anything else without first reading this entire doc.** The element type is load-bearing for Firefox.
2. **Never combine PDF render-path changes with other "while I'm here" changes.** The blast radius is invisible until production.
3. **Test all 5 surfaces before declaring a PDF change done:** Brave desktop, Firefox desktop, Chrome desktop, mobile Safari, mobile Chrome.
4. **For any new PDF render path** (proxy, blob, signed URL), build the route in isolation, hit it from a browser tab directly, confirm it renders inline before wiring into the modal.
5. **Cache lies.** When a user reports a PDF behavior bug, ALWAYS ask them to test in a private/incognito window before debugging code.
