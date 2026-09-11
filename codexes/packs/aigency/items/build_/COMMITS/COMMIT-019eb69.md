# Commit Brief: `019eb69` — data model fix: remove invalid asset kinds, add series_scope, extend series picker for canonical content

| Field | Value |
|-------|-------|
| SHA | [`019eb69`](https://github.com/iQube-Protocol/AigentZBeta/commit/019eb6904b156a1ca5516f7e7bf8fa53bea67155) |
| Author | Claude |
| Date | 2026-08-11T22:31:37Z |
| Branch | dev (direct push) |
| Type | `feat` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
data model fix: remove invalid asset kinds, add series_scope, extend series picker for canonical content

- Add series_scope column migration to codex_media_assets
- Remove stack_canonical_plate/video from CodexAssetKind enum (invalid in DB)
- Add seriesScope to UploadItem interface for tracking canonical series context
- Extend QRIPTO_SERIES to include 'Canonical · Constitutional Internet' option with series_scope
- Remove CanonicalCategoryId type and CANONICAL_QRIPTO_CATEGORIES constant
- Canonical assets now route through series picker instead of separate class toggle

Next step: Remove artifact class selector UI and simplify component state logic.
```

## Body

- Add series_scope column migration to codex_media_assets
- Remove stack_canonical_plate/video from CodexAssetKind enum (invalid in DB)
- Add seriesScope to UploadItem interface for tracking canonical series context
- Extend QRIPTO_SERIES to include 'Canonical · Constitutional Internet' option with series_scope
- Remove CanonicalCategoryId type and CANONICAL_QRIPTO_CATEGORIES constant
- Canonical assets now route through series picker instead of separate class toggle

Next step: Remove artifact class selector UI and simplify component state logic.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/(shell)/admin/codex/components/CodexUploadModal.tsx` |
| Added | `supabase/migrations/20260811223027_add_series_scope_to_codex_media_assets.sql` |

## Stats

 2 files changed, 26 insertions(+), 42 deletions(-)
