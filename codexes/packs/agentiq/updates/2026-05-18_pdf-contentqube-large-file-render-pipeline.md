# PDF ContentQube — Large-File Render Pipeline (GN landing path)

**Date:** 2026-05-18
**Workstream:** AgentiQ Cartridges → Knyt Codex → AGN/GN PDF render
**Status:** Shipped to `dev` (commit `f0c3a422` + `0851411f`). GN renders end-to-end via the codex scrolls grid. Documents the pattern for every future PDF ContentQube that ships at scale (>50 MB).

---

## The problem

The AGN/GN (`master_content_qubes.id = mk_ep00_print_common`, content_type = `gn_still`, `episode_number = -1`) lives in Supabase Storage as a 395 MB unencrypted PDF served via a public URL. The codex AGN card is gated through `PDFLiteReaderModal` on desktop — a thin wrapper around `<object type="application/pdf" data={url}>`. For files this size, that path is fragile across browsers and connections: load times exceed 60s, the modal's wall-clock timer either fires falsely or never, and on Firefox the `<object>` would intermittently treat the response as a download.

Episodes 0..12 share the same render path but their `pdf_lite_url` files sit between 15 and 50 MB — well inside what native browser PDF embeds handle reliably. Only the GN ran into the size wall.

Before this work, the GN had been failing or appearing-to-fail intermittently for weeks. Multiple parallel "fixes" had compounded confusion: timeout bumps, viewer-element swaps (`<iframe>` ↔ `<object>`), server-side proxy attempts, cache-key rotations. None of them addressed the root cause.

## What didn't work (and why)

Worth recording so we don't relitigate these.

### 1. Wall-clock timeout bumps on `PDFLiteReaderModal`

`<object>.onLoad` for cross-origin PDFs in Brave / Chromium / Firefox fires inconsistently or never. The viewer originally used a wall-clock fallback timer (24s, then 120s, then 10 min) to dismiss its loading spinner. The "Preview timed out — please retry" overlay this drew was **painted over** PDFs that had actually rendered underneath — making working renders look broken. Replaced with a short fixed delay (5s first load, 1.5s repeat) that just hides the spinner; never claims a timeout. **Lesson: `onLoad` is not a reliable success signal for cross-origin `<object>` PDFs. Don't gate UI on it.**

### 2. Stripping `<object>` for `<iframe>` everywhere

Firefox downloads cross-origin PDFs from `<iframe>` rather than rendering inline. `<object type="application/pdf">` renders correctly. CLAUDE.md previously said the opposite (blamed `<object>` for `NS_ERROR_WONT_HANDLE_CONTENT`); that error is actually `<object>`'s response when the URL returns 0 bytes / a missing file, not a property of `<object>` itself. Restored `<object>` on desktop, `<iframe>` on mobile (per `dbaab0bc` working pattern). **Lesson: the rendering element is a tradeoff between Chromium/Safari (either works) and Firefox (only `<object>` works inline). Use both, viewport-scoped.**

### 3. masterId server-side proxy with on-the-fly page rendering

Restored the historical `/api/content/pdf-page-by-master/[masterId]` route from commit `0feeb548`. Validates persona entitlement via `userOwnsAsset`, server-fetches the Supabase PDF, renders one page to a WebP via `pdfjs-dist` + `@napi-rs/canvas` + `sharp`, returns the image. Sounded ideal — only small images cross to the browser.

It returned 502 in ~500 ms. Lambda OOMs trying to buffer 430 MB of PDF into memory before pdfjs can even start parsing. The default Lambda memory ceiling (1 GB) is below `pdf_bytes + decoded_object_graph (2-3×)`. Bumping `maxDuration = 60` was necessary but not sufficient. **Lesson: server-side per-page rendering of a large source PDF in Lambda is not viable. The source has to be reachable in either page-image manifests (pre-rendered) OR a small enough native PDF that the browser handles it.**

### 4. PDFPageViewer with the pdf-pages manifest

The `pdf_page_manifests` table + `scripts/render-pdf-pages.mjs` pipeline pre-renders PDFs to per-page WebP images stored in Supabase Storage. `PDFPageViewer` fetches the manifest via `/api/content/pdf-pages/[cid]` and streams pages individually — every page is a few hundred KB, regardless of source size.

This is the architecturally correct answer for large PDFs. But: the script targets `codex_media_assets`, not `master_content_qubes`. The GN lives in `master_content_qubes` and was never picked up by any pre-render run. The `pages_ready=false` flag on the GN row confirmed the pipeline had been planned in DB schema but never executed for it. **Lesson: this is the right pattern for large PDFs going forward — but it needs to target `master_content_qubes` too, AND scripts need to run before files are made available.**

### 5. Apple's "Reduce File Size" Quartz filter

GUI-easy but inconsistent — for image-heavy graphic novels with JBIG2/JPEG2000 source images, Preview's filter is a no-op. Output same size as input. Reliable for typed-text PDFs, useless for image-heavy ones. **Lesson: don't trust Preview's filter for compression-critical workflows. Use it for previewing only.**

### 6. Homebrew ghostscript on macOS 12

Tier 3 (unsupported) configuration. Brew refused to install. Even with the official `.pkg` installer (which exists for macOS 12), gatekeeper blocked it; the user couldn't get past `xattr -dr com.apple.quarantine` plus the System Preferences "Open Anyway" sequence reliably.

The system-level install dependency made ghostscript impractical for this operator. **Lesson: any tool we recommend operators run for content prep needs to be installable on the operator's actual machine, not the theoretical baseline.**

## The pattern that worked

A pure-Node compression pipeline using libraries **already in `node_modules`**, no system installs:

| Step | Tool | Purpose |
|---|---|---|
| 1. Open source PDF | `pdfjs-dist` (already a project dep) | Page count, per-page render targets |
| 2. Render each page to canvas | `@napi-rs/canvas` (already a project dep) | Native-binary canvas; ships prebuilt — no Cairo/Pango required |
| 3. Re-encode page bitmap as JPEG | `sharp` (already a project dep) | Quality 75 → ~80% smaller per page than the source raster |
| 4. Reassemble into a new PDF | `pdf-lib` (already a project dep) | Image-only output PDF; one JPEG per page |
| 5. Replace source via curl PUT | `curl` (built-in) | `x-upsert: true`, `Content-Type: application/pdf` to Supabase Storage |

Two Node-environment workarounds required:

1. **`Promise.withResolvers` polyfill** — `pdfjs-dist` v4 uses this ES2024 API; Node 18 doesn't have it. Polyfill at the top of the script.
2. **Stub `node_modules/canvas/`** — `pdfjs-dist` internally calls `require("canvas")` (the GitHub `canvas` package that needs Cairo). Created a fake `node_modules/canvas/index.js` that re-exports `@napi-rs/canvas`. Pure file-write, no install.

```js
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}
```

```bash
mkdir -p node_modules/canvas
cat > node_modules/canvas/index.js <<'EOF'
const napi = require('@napi-rs/canvas');
module.exports = napi;
module.exports.Canvas = napi.Canvas;
module.exports.createCanvas = napi.createCanvas;
module.exports.Image = napi.Image;
module.exports.loadImage = napi.loadImage;
EOF
cat > node_modules/canvas/package.json <<'EOF'
{"name":"canvas","version":"0.0.0-stub","main":"index.js"}
EOF
```

Result on the GN:

- 378 MB → 123 MB (3× reduction)
- 462 pages compressed in ~9 minutes on an Intel MacBook Pro
- JPEG quality 75, target width 1200 px
- Renders end-to-end in `PDFLiteReaderModal` `<object>` within 20-40s first load, near-instant from browser cache

The script lives at `scripts/compress-pdf.mjs` (local-only, not committed to the repo — re-applicable from this report's pattern).

## Forward-looking implications for PDF ContentQubes

### 1. ContentQube size policy

Every PDF that lands as a ContentQube should be **inspected for size before publishing**. The break-points we now have empirical evidence for:

- **< 50 MB** — renders reliably in `<object>` on any reasonable connection. No pipeline work needed.
- **50–150 MB** — usable but slow. Tolerable for "long-form library" assets. Should have at least a "Loading large file…" affordance in the viewer.
- **> 150 MB** — **must** be compressed (option A) or pre-rendered to page images (option B) before publishing. Native browser embeds become unreliable above this.

Add this as a column on the publishing checklist.

### 2. Pre-render pipeline needs to target master_content_qubes

`scripts/render-pdf-pages.mjs` currently queries `codex_media_assets`. Master PDFs (the GN, episode print masters, future serial works) live in `master_content_qubes`. Either:

- **Extend the script** to also query master rows with `mime_type = 'application/pdf'` and `pages_ready IS NOT TRUE`.
- **OR** invert: write a one-shot `scripts/render-pdf-master.mjs` that takes `--master-id` and renders. Simpler, more deterministic.

Per-row coverage: ep 0..12, the GN, and any future motion comic that ships a PDF. Once a manifest exists in `pdf_page_manifests` and the row is `pages_ready=true`, `PDFPageViewer` serves pages — `<object>` rendering becomes a fallback rather than the only path.

### 3. Viewer routing: device + size, not just device

Today the routing is viewport-based: desktop → `PDFLiteReaderModal`, mobile → `PDFPageViewer`. This works for files in the 15-50 MB range. For larger files (the GN sits at 123 MB even after compression), `PDFPageViewer` should win on desktop too **when a manifest is available**. Routing should consult `master.pages_ready` and prefer the page-image path when it exists.

Suggested precedence (assuming manifest exists):

```
mobile         → PDFPageViewer
desktop ≥ 80MB → PDFPageViewer (if manifest exists)
desktop  < 80MB → PDFLiteReaderModal (native <object>)
no manifest    → PDFLiteReaderModal regardless of size
```

The 80 MB threshold is empirical from the GN render and ep 0..12 behavior. Codify it as a constant in `KnytTab` rather than scattering the literal.

### 4. Compress-pdf as ops tooling

`scripts/compress-pdf.mjs` (the Node pipeline above) should ship in the repo as a committed ops script. Operator invocation:

```
node scripts/compress-pdf.mjs --in=<path> --out=<path> --quality=75 --width=1200
```

Plus a sister script `scripts/replace-storage-object.mjs` that takes a local path + a Supabase storage path and runs the curl-PUT replacement. Together those make "publish a large PDF" a 2-command operation, no admin/install requirements.

### 5. The `canvas` stub is not durable

The Cairo dependency issue is real; even on machines where Homebrew works, `canvas` builds from source and frequently fails. Filing a backlog item: switch any server-side code that uses `pdfjs-dist`'s default `NodeCanvasFactory` (currently `app/api/content/pdf-page/[cid]/route.ts` and `app/api/content/pdf-meta/[cid]/route.ts`) to pass a custom factory that uses `@napi-rs/canvas` explicitly. Avoids depending on a hidden `require("canvas")` resolution.

### 6. CLAUDE.md PDF viewer rule needs updating

The current rule says "Never use `<object>` for the PDF embed (Firefox throws `NS_ERROR_WONT_HANDLE_CONTENT`); use `<iframe>`." This is wrong. Correct guidance:

> **Desktop**: `<object type="application/pdf">` — renders cross-origin PDFs inline in Firefox / Chromium / Safari when the file exists. `NS_ERROR_WONT_HANDLE_CONTENT` means the URL returned 0 bytes / a missing file, not that `<object>` is broken.
> **Mobile**: `<iframe>` — iOS Safari + Android Chrome render PDFs inline from iframes; `<object>` doesn't work reliably on iOS.
> **Either**: don't trust `onLoad` to fire on cross-origin PDFs; use a short fixed-delay spinner-hider, never a wall-clock timeout error overlay.

Operator decision needed before this lands in CLAUDE.md.

## Files committed for this work

- `app/triad/components/content/PDFLiteReaderModal.tsx` — spinner-only behaviour (`af87e7b3`), `<object>`/`<iframe>` viewport split
- `app/triad/components/codex/tabs/KnytTab.tsx` — viewport-based routing, AGN back on PDFLiteReader after masterId-proxy revert (`f0c3a422`)
- `app/api/content/pdf-page-by-master/[masterId]/route.ts` — restored but currently unused; left in place as the scaffolding for future small-file gated streaming. Sweep candidate.
- `scripts/fix-gn-content-type.mjs` — Content-Type repair tool for previously-uploaded octet-stream PDFs

## Things left open from this work

1. **`PDFPageViewer` reliability** for mobile / large-file desktop fallback. Pre-render pipeline target = `master_content_qubes` (see #2 above).
2. **Asset-ID synthesis for non-canonical episodes**. `KnytTab` constructs IDs as `\`mk_ep${ep}_print_common\`` — for `ep = -1` this produces `mk_ep-1_print_common` which doesn't match any DB row. Causes 404s on `/api/access/evaluate`. Cosmetic-but-noisy in network captures.
3. **`master_content_qubes.page_count` cache** for the GN is `null`. The route falls back to fetching + parsing the PDF, which we can't trigger reliably for 123 MB. Manual SET via SQL once we know the page count (or trust the compression script's output: 462 pages).
4. **Sweep `app/api/content/pdf-page-by-master/[masterId]/route.ts`** — currently in the codebase but unused after the AGN routing revert. Remove or repurpose.
5. **`scripts/render-pdf-pages.mjs` schema extension** — make it target master rows. Tracked as forward-looking item #2.
6. **CLAUDE.md PDF rule update** — pending operator approval; see #6 above.

## Cross-references

- The render pipeline restored from commit `0feeb548` (now reverted live; route file still exists in case we want to re-wire for small gated PDFs)
- Related earlier work: `updates/2026-05-05_pdf-rendering-reference.md`, `updates/2026-05-04_gated-pdf-proxy-masterId-refactor.md`
- Convention shift that exposed this issue: `updates/2026-05-14_contentqube-registry-as-sot-shelf-tab-canonicalization.md`
