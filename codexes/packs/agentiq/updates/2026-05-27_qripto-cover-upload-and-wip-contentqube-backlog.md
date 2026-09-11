# Qripto cover-upload type + WIP ContentQube backlog

**Date:** 2026-05-27
**Branch:** `claude/review-session-setup-V82mB` → dev
**Scope:** Codex Upload modal (Qriptopian tab) + register route

## What shipped

1. **New `Cover` content type** in the Qriptopian upload modal accepting
   `.jpg / .jpeg / .png / .webp / .pdf`. Uploads land in
   `codex/assets/qriptopian/cover_image/<scope>_<ts>.<ext>` (or
   `cover_pdf/` for PDFs) and the register route now writes
   `cover_thumb_url = storageUrl` on the row whenever
   `category === 'cover'`, so the asset is immediately available to be
   used as a card cover by the (forthcoming) Papers tab.

   Mime-aware kinding: images map to `asset_kind = 'cover_image'`,
   single-page PDFs map to `asset_kind = 'cover_pdf'`. Both populate
   `cover_thumb_url`.

2. **Preview-link fix** in the upload modal success row. Supabase-direct
   uploads return the full public URL in `result.cid`; routing that
   through `/api/content/cover/[cid]` 404s because Next's path-routing
   collapses `https://…` to `https:/…` and the image-cover proxy
   (`sharp().webp()`) is the wrong viewer for a PDF anyway. The modal
   now links straight to the storage URL when `result.cid` is an
   `http(s)://…` value, and reserves the cover proxy for Autonomys CIDs
   only.

## Files touched

| Path | Change |
|---|---|
| `app/(shell)/admin/codex/components/CodexUploadModal.tsx` | Added `cover` to `QRIPTO_CATEGORIES`; mime-aware `coverKind` in `handleQriptoFileSelect`; preview-link branches on `isHttpUrl` |
| `app/api/admin/codex/storage/register/route.ts` | `category === 'cover'` now writes `cover_thumb_url` (covers PDF + image both) |

## Pending — Qripto Papers tab wiring

Already on the backlog (see
`2026-05-26_qriptopian-pulse-wiring-and-moderation-backlog.md`):

- New endpoint to list `codex_media_assets` rows filtered by
  `series='qriptopian'` and a `series_scope` filter
  (`papers/protocols`, `magazines/2`, …).
- A real `QriptoPapersTab` component (or a liquid template) that renders
  the paper list as PDF cards, using `cover_thumb_url` for the card art
  and falling back to PDF page 1 when no cover has been uploaded.
- Add `series_scope` column to `codex_media_assets` so the query above
  doesn't have to parse storage filenames. Until then, the storage path
  is a workable (brittle) grouping key.

## Pending — WIP ContentQube canonicalisation (PARAMOUNT)

Per operator directive (2026-05-27):

> Content uploaded via the codex manager is intended to be canonical
> though still WIP — it must meet all the ContentQube standards. If it
> is not currently a ContentQube we can proceed as-is, but the path to
> becoming a WIP ContentQube belongs on the backlog.

**Current state of Qripto upload pipeline:**

- Uploads land in `codex_media_assets` rows with `mint_status='wip'` and
  `content_state='C'`.
- **No `content_qubes` row is created.** The `content_qubes` registry
  (Phase 2 ContentQube spine, see
  `supabase/migrations/20260513010000_content_qubes_schema.sql`) is
  currently populated only via the KNYT pilot SQL seed migration
  (`20260513030000_content_qubes_knyt_pilot.sql`). There is no
  application code that creates `content_qubes` rows on upload — only
  `purchaseHandler.ts` and `baseTokenMint.ts` read from it.

**What "WIP ContentQube" should mean for a Qripto paper upload:**

1. The upload register route should create a `content_qubes` row with
   `lifecycle_state = 'draft'` and bridge it to the new
   `codex_media_assets` row via `media_asset_id`. (`content_kind`
   = `'lore_scroll'` for Papers, `'other'` for magazines until the
   schema is extended.)
2. A matching `content_qube_storage` row with `is_primary = true` and
   `storage_provider = 'supabase'` so the registry resolver can hand
   the URL to consumers without re-querying `codex_media_assets`.
3. A `content_qube_access_policies` row with `gating_kind = 'token'`
   or `'free'` per the editor's selection (currently neither is
   captured — covers are implicitly free, papers should default to
   `'token'` pending a Qripto SKU model).
4. A `content_qube_cartridge_bindings` row pinning the qube to the
   `qripto-codex` cartridge + the appropriate tab slug (`papers` or
   `magazines`).
5. A `content_qube_dvn_receipts` row with `receipt_kind='create'`
   anchored to the qube id and editor's persona (T2 alias only, never
   T0 personaId).

**Path of least resistance:**

- Add a `createWipContentQubeFromMediaAsset()` helper in
  `services/content/` that the register route calls right after the
  `codex_media_assets` insert succeeds. The helper should be
  best-effort (failure does not roll back the upload) and idempotent
  by `media_asset_id`.
- Extend the `content_qube_storage` schema to accept
  `storage_provider IN ('supabase','autodrive')` if it doesn't already.
- Mirror the same helper for KNYT episode uploads
  (`master_qube_id`-bridged) — currently KNYT episodes are seeded into
  `content_qubes` only via the one-time pilot migration; new episodes
  uploaded after that migration are also outside the registry. This
  is the same gap, surfaced by a different cartridge.

**Why this matters:** the ContentQube spine is the canonical resolver
(see `services/content/resolveContentQube.ts`). Surfaces that read
from it (purchase pipeline, base-token mint, future MetaQube panels)
will not see WIP uploads until a `content_qubes` row exists, even
though the file is fully usable from the bare `codex_media_assets`
row. Long term, every canonical-intent upload must produce a
ContentQube on the way in.

**Suggested sequencing:**

1. (Q3) Land the helper + register-route call for Qripto papers,
   covers, articles. Single cartridge, low blast radius.
2. (Q3) Backfill `content_qubes` rows for existing
   `series='qriptopian'` rows.
3. (Q4) Extend the helper to KNYT (`master_content_qubes`) uploads.
4. (Q4) Add a `Lifecycle` admin sub-tab that surfaces every WIP
   ContentQube and walks the operator through
   `draft → semi_minted → review_ready → canon_pending → canonized`.
