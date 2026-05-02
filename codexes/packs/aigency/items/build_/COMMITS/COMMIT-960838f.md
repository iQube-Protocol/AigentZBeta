# Commit Brief: `960838f` — fix persona identity persistence and library thumbnails

| Field | Value |
|-------|-------|
| SHA | [`960838f`](https://github.com/iQube-Protocol/AigentZBeta/commit/960838f3f7538b7dabeaceb8d8f24d6ba01ae209) |
| Author | Claude |
| Date | 2026-05-02T14:59:59Z |
| Branch | dev (direct push) |
| Type | `fix` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
fix persona identity persistence and library thumbnails

- SmartWalletDrawer: write to PersonaContext on every persona switch (dropdown + quick-add)
- SmartWalletDrawer: sync PersonaContext changes to localPersonaId (cross-surface reactivity)
- SmartWalletDrawer: remove duplicate localStorage writes (PersonaContext handles this)
- SmartWalletDrawer: prefer Supabase Storage coverUrl over encrypted CID for thumbnails
- SmartWalletDrawer: fix icon fallback when cover img fails to load (was showing blank space)
- entitlements/list: resolve FIO handle personas to UUID before querying user_entitlements
- entitlements/list: include cover_thumb_url in asset queries; return coverUrl in assetMeta
- useOwnedEntitlements: add coverUrl field to OwnedEntitlement.assetMeta interface
```

## Body

- SmartWalletDrawer: write to PersonaContext on every persona switch (dropdown + quick-add)
- SmartWalletDrawer: sync PersonaContext changes to localPersonaId (cross-surface reactivity)
- SmartWalletDrawer: remove duplicate localStorage writes (PersonaContext handles this)
- SmartWalletDrawer: prefer Supabase Storage coverUrl over encrypted CID for thumbnails
- SmartWalletDrawer: fix icon fallback when cover img fails to load (was showing blank space)
- entitlements/list: resolve FIO handle personas to UUID before querying user_entitlements
- entitlements/list: include cover_thumb_url in asset queries; return coverUrl in assetMeta
- useOwnedEntitlements: add coverUrl field to OwnedEntitlement.assetMeta interface

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/entitlements/list/route.ts` |
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `app/hooks/useOwnedEntitlements.ts` |

## Stats

 3 files changed, 60 insertions(+), 34 deletions(-)
