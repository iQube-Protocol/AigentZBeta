# Commit Brief: `0929def` — Qripto-aware Codex Upload modal — Series + Content Types live

| Field | Value |
|-------|-------|
| SHA | [`0929def`](https://github.com/iQube-Protocol/AigentZBeta/commit/0929defe329a50b4aafb64ab20133def0b25edc1) |
| Author | Claude |
| Date | 2026-05-26T23:14:25Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
Qripto-aware Codex Upload modal — Series + Content Types live

Implements the Qriptopian half of the Codex Upload modal per the v3.3
brief. The Qriptopian tab now has the same UX shape as the KNYT tab:
Series picker on the left (Papers + Magazines), Content Type picker on
the right, drag-drop zone, upload queue, footer Upload All.

app/(shell)/admin/codex/components/CodexUploadModal.tsx
  - QRIPTO_SERIES constant: Papers sub-series (Protocols / The Polity /
    COYN Thesis / Experience Sovereignty / The Polity and the
    Plutocracy) + Magazines issues (#0 / #1 / #2 / #3). Surfaces as
    grouped <optgroup>s in the Series dropdown.
  - QRIPTO_CATEGORIES constant: 6 content types — White-papers,
    Articles, Video, Audio, Images, Infographics — each with their
    own accept patterns.
  - State split: selectedQriptoSeries + selectedQriptoCategory live
    alongside the existing KNYT selectedEpisode + selectedCategory.
    Switching tabs preserves both sides' selections.
  - seriesForUpload derives 'metaKnyts' / 'qriptopian' from activeTab
    and replaces the three hardcoded 'metaKnyts' strings in the
    upload-item dispatch (Supabase sign + register + Auto-Drive POST).
  - handleQriptoFileSelect — slimmer than the KNYT counterpart;
    queues files with category='lore' (catchall) + the right
    assetKind mapped from the qripto content type so the Supabase
    storage path picks them up.
  - "Qriptopian Codex Coming Soon" placeholder REPLACED with the real
    upload UI (Series + Content Type pickers, drag-drop, queue).
  - Title input on each queue row already existed (line 259) and
    handles both KNYT and Qripto items uniformly.
  - Footer "Upload All" no longer gated to KNYT-only — works on either
    tab when uploadQueue is non-empty.

app/api/admin/codex/storage/sign/route.ts
  - buildPath() now accepts optional seriesScope param. When present
    (Qripto uploads) it replaces the epXX path segment with a
    filesystem-safe slug of the series scope. So qripto uploads land
    at e.g. codex/assets/qriptopian/background_lore_doc/papers-
    protocols_<ts>.pdf instead of codex/assets/qriptopian/background_
    lore_doc/epXX_<ts>.pdf.
  - Request body parsing extended to read seriesScope.

What's still TODO (separate PR — flagged in commit message, not
shipped here so the diff stays focused):
  - QriptopianAdminTab's Qriptopian-tab body is still "Coming Soon".
    The Codex Manager surface (stat cards + asset category grid +
    Store SKUs) needs Qripto-flavoured equivalents:
        Stat cards: Total Papers / Total Magazines / White-papers /
                    Articles / Videos / Audio / Images / Infographics
        Asset Categories grid: same 6 content types with counts
        Store SKUs: future (no Qripto store skus yet)
    Mirrors KNYT structure; needs a new /api/admin/codex/status?series=
    qriptopian return shape. Will land in the next slice.
  - DB registration for Qripto-typed rows uses the 'lore' catchall +
    'background_lore_doc' assetKind today. If we want first-class
    qripto types in codex_media_assets, that's an enum/schema change
    + new registration route. Files still land in the right storage
    path; the catchall row type is the only friction.
  - Auto-Drive path uses formData seriesScope but the
    /api/admin/codex/upload-master + /upload-asset routes don't yet
    read it. Supabase path is the canonical upload route today; the
    Auto-Drive path is unchanged for KNYT. Qripto Auto-Drive lands in
    the same follow-up slice.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n
```

## Body

Implements the Qriptopian half of the Codex Upload modal per the v3.3
brief. The Qriptopian tab now has the same UX shape as the KNYT tab:
Series picker on the left (Papers + Magazines), Content Type picker on
the right, drag-drop zone, upload queue, footer Upload All.

app/(shell)/admin/codex/components/CodexUploadModal.tsx
  - QRIPTO_SERIES constant: Papers sub-series (Protocols / The Polity /
    COYN Thesis / Experience Sovereignty / The Polity and the
    Plutocracy) + Magazines issues (#0 / #1 / #2 / #3). Surfaces as
    grouped <optgroup>s in the Series dropdown.
  - QRIPTO_CATEGORIES constant: 6 content types — White-papers,
    Articles, Video, Audio, Images, Infographics — each with their
    own accept patterns.
  - State split: selectedQriptoSeries + selectedQriptoCategory live
    alongside the existing KNYT selectedEpisode + selectedCategory.
    Switching tabs preserves both sides' selections.
  - seriesForUpload derives 'metaKnyts' / 'qriptopian' from activeTab
    and replaces the three hardcoded 'metaKnyts' strings in the
    upload-item dispatch (Supabase sign + register + Auto-Drive POST).
  - handleQriptoFileSelect — slimmer than the KNYT counterpart;
    queues files with category='lore' (catchall) + the right
    assetKind mapped from the qripto content type so the Supabase
    storage path picks them up.
  - "Qriptopian Codex Coming Soon" placeholder REPLACED with the real
    upload UI (Series + Content Type pickers, drag-drop, queue).
  - Title input on each queue row already existed (line 259) and
    handles both KNYT and Qripto items uniformly.
  - Footer "Upload All" no longer gated to KNYT-only — works on either
    tab when uploadQueue is non-empty.

app/api/admin/codex/storage/sign/route.ts
  - buildPath() now accepts optional seriesScope param. When present
    (Qripto uploads) it replaces the epXX path segment with a
    filesystem-safe slug of the series scope. So qripto uploads land
    at e.g. codex/assets/qriptopian/background_lore_doc/papers-
    protocols_<ts>.pdf instead of codex/assets/qriptopian/background_
    lore_doc/epXX_<ts>.pdf.
  - Request body parsing extended to read seriesScope.

What's still TODO (separate PR — flagged in commit message, not
shipped here so the diff stays focused):
  - QriptopianAdminTab's Qriptopian-tab body is still "Coming Soon".
    The Codex Manager surface (stat cards + asset category grid +
    Store SKUs) needs Qripto-flavoured equivalents:
        Stat cards: Total Papers / Total Magazines / White-papers /
                    Articles / Videos / Audio / Images / Infographics
        Asset Categories grid: same 6 content types with counts
        Store SKUs: future (no Qripto store skus yet)
    Mirrors KNYT structure; needs a new /api/admin/codex/status?series=
    qriptopian return shape. Will land in the next slice.
  - DB registration for Qripto-typed rows uses the 'lore' catchall +
    'background_lore_doc' assetKind today. If we want first-class
    qripto types in codex_media_assets, that's an enum/schema change
    + new registration route. Files still land in the right storage
    path; the catchall row type is the only friction.
  - Auto-Drive path uses formData seriesScope but the
    /api/admin/codex/upload-master + /upload-asset routes don't yet
    read it. Supabase path is the canonical upload route today; the
    Auto-Drive path is unchanged for KNYT. Qripto Auto-Drive lands in
    the same follow-up slice.

https://claude.ai/code/session_01Ths4F8mcdYjDcKnjxnMy9n

## Files Changed

| Change | File |
|--------|------|
| Modified | `.amplify-deploy` |
| Modified | `app/(shell)/admin/codex/components/CodexUploadModal.tsx` |
| Modified | `app/api/admin/codex/storage/sign/route.ts` |

## Stats

 3 files changed, 206 insertions(+), 21 deletions(-)
