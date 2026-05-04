# Gated PDF Proxy — masterId Refactor

**Date:** 2026-05-04  
**Branch:** `claude/confirm-aigentz-access-VnNTK`  
**Status:** Shipped to branch, auto-merge to dev pending

---

## What Changed

### Problem

PDF files for gated/owned episodes were being sent to the browser as raw Supabase Storage URLs (`printCommonLiteUrl`, `printRareLiteUrl`, etc.). Any authenticated user could extract the URL and download the PDF directly — bypassing the entitlement system.

### Solution

Complete custody-safe proxy implementation. Raw PDF URLs are now resolved entirely server-side and never sent to the browser.

---

## Files Changed

### New
- `app/api/content/pdf-page-by-master/[masterId]/route.ts`  
  New entitlement-gated proxy route. Accepts a `masterId` (TEXT pk like `mk_ep01_print_common`) and a `personaId`. Validates entitlement via `userOwnsAsset()` before fetching the PDF URL from the DB. Renders one page as a WebP image. Also supports `?meta=1` for page-count discovery without rendering. The raw Supabase Storage URL never leaves the server.

### Modified

**`app/api/admin/codex/status/route.ts`**  
- `EpisodeStatus` interface: replaced `printXLiteUrl` fields with `printXMasterId` fields (TEXT pk from `master_content_qubes`)
- Master processing loop: populates `masterId` fields instead of `LiteUrl` fields
- `printXLiteUrl` fields removed from API response — URL never sent to client

**`app/triad/components/content/PDFPageViewer.tsx`**  
- New `masterId` and `personaId` props (alternative to `cid`)
- `masterId` mode: fetches page count from `?meta=1` endpoint, renders pages via `/api/content/pdf-page-by-master/[masterId]`
- `cid` mode: unchanged (existing Autonomys path)
- Resolved merge conflict with dev version that had added a mobile `target="_blank"` hand-off (which would have exposed raw URLs)

**`app/triad/components/codex/tabs/KnytTab.tsx`**  
- `EpisodeFromAPI` type: replaced `printXLiteUrl` fields with `printXMasterId` fields
- State: `currentPdfLiteUrl` → `currentPdfMasterId`
- Removed `isMobileViewport` state + effect (no longer needed for PDF routing)
- Removed `PDFLiteReaderModal` import (no longer used for gated content)
- All three PDF-open sites updated to use `masterId`
- PDF viewer dispatch: always uses `PDFPageViewer` — `PDFLiteReaderModal` completely removed from gated content path
- Content transform: `pdf_lite_url` → `pdf_master_id` in media objects

**Type definitions updated across the board:**
- `packages/smarttriad/src/types.ts` — `SmartContentItem`: `pdf_lite_url` → `pdf_master_id`
- `packages/smarttriad/src/SmartContentActions.tsx` — `ContentContext`: same
- `app/types/knytLiquidUI.ts` — `KnytContentItem.media`: same
- `app/wallet/contracts.ts` — SmartWallet content type: same
- `app/contexts/SmartContentActionContext.tsx` — payment payload: same
- `app/triad/components/codex/templates/KnytTemplateRenderer.tsx` — text-only PDF check: same

---

## Security Model

| Layer | Before | After |
|-------|--------|-------|
| Client receives | Raw Supabase Storage URL | masterId (opaque TEXT pk) |
| PDF fetch | Browser → Supabase Storage directly | Server → Supabase Storage (never client) |
| Entitlement check | None | `userOwnsAsset(personaId, masterId)` before any fetch |
| Mobile | Raw URL exposed (was broken) | Same server-rendered page images as desktop |

**Phase 2** (future): replace Supabase Storage with Autonomys + iQube encryption. This route will then switch to the Autonomys decryption path.

---

## Open Items

- `PDFLiteReaderModal` is still used for **non-gated** (free/unlocked) content and can stay as-is
- Admin routes (`/api/admin/codex/assets-by-category`, `/api/admin/render-pdf-pages`) still read `pdf_lite_url` from DB — these are server-side only, correct behavior
- The `page_count` column on `master_content_qubes` may not exist in all environments — the meta endpoint falls back to fetching + counting pages if needed
