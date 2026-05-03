# KNYT Token Gating — Workstream Handover

**Date:** 2026-05-02  
**Branch:** `claude/confirm-aigentz-access-VnNTK`  
**Status:** Design confirmed — implementation not yet started  
**Priority:** High — this is required before KNYT content can be shared publicly

---

## What Was Agreed

Token gating for KNYT episode content (still comic, motion comic, graphic novel / print edition) must be enforced **at the content level, not the surface level**. The same access rules apply wherever the content is surfaced — in the Codex viewer, the Store, Terra, 21 Sats, Community, Order, or any future cartridge surface. Content and its access rights are independent of where they are displayed.

### Three surface types (operator's framing)
| Surface | Role |
|---------|------|
| **Codex** | Canonical library — source of truth for content items |
| **Store** | Commercial centre — packaging and purchasing |
| **Cartridge** | All other surfaces — Terra, 21 Sats, Community, Order, etc. |

---

## What Must Be Token-Gated

The primary gating targets are the **episodic content formats**, specifically:

| Asset Kind | Table | Format | Gate |
|------------|-------|--------|------|
| `episode_still` | `master_content_qubes` | Still comic (PDF / image) | Per-episode or KNYT Codex |
| `episode_motion` | `master_content_qubes` | Motion comic (video) | Per-episode or KNYT Codex |
| `episode_print` | `master_content_qubes` | Graphic Novel PDF (**highest priority**) | Per-episode or KNYT Codex |

Character cards are also purchasable but lower urgency for gating the viewer experience.

### Access Rules

1. **Per-episode ownership** — any of these `user_entitlements.asset_id` patterns grants access to the matching episode:
   - `episode-N`, `episode-N-qripto-still`, `episode-N-qripto-motion`, `episode-N-digital-still`, `episode-N-digital-motion`, `episode-N-print`
   - `mk_ep01`, `ep01`, etc. (legacy formats — already handled)
   - `bundle-0-2` → episodes 0, 1, 2
   - `bundle-3-7` → episodes 3, 4, 5, 6, 7
   - `bundle-8-12` → episodes 8, 9, 10, 11, 12
   - `bundle-full` → all episodes 0–12

2. **KNYT Codex blanket access** — owning any of the full-season products grants access to **all episode variants**. The operator needs to confirm which `asset_id` values correspond to the "KNYT Codex" product (likely includes `bundle-full` and all investor bundle SKUs that cover the full season: `knyt-codex-investor`, `top-knyt-investor`, `first-knyt-investor`, `zero-knyt-investor`, `satoshi-knyt-investor`, `digital-knyt-cartridge`, `digital-first-knyt`).

3. **Lore** — already `adminOnly: true` in `data/codex-configs.ts`. No gating work needed.

4. **Investor content** — already CRM-gated in `KnytStoreInvestorTab.tsx` via `/api/crm/campaign/investor-status`. No gating work needed.

---

## Current State of the Codebase

### What already exists (do not duplicate)

**`app/triad/components/codex/tabs/KnytTab.tsx`** — main KNYT codex viewer  
This is the most important file. It already has:
- `ownedEpisodeNumbers: Set<number>` state populated from `GET /api/codex/owned?personaId=`
- `contentWithOwnership` useMemo (line ~1544) that maps over all content items and overrides `owned` flag based on `ownedEpisodeNumbers`
- `isEpisodeLocked()` callback (line ~1799) that returns `true` when item has a price gate and `!item.metadata?.owned`
- `openPurchaseForItem()` that opens `ContentPurchaseModal`
- `SmartContentActions` component (from `app/components/content/SmartContentActions.tsx`) — already renders **Read / Watch / Listen** quick-action links when `owned: true`
- The infrastructure is largely in place — the main gap is data quality in `/api/codex/owned`

**`app/triad/components/codex/tabs/KnytStoreEpisodesTab.tsx`** — episodes store  
- Already uses `useOwnedEntitlements(personaId)` and `ownedAssetIds`
- Checks multiple asset_id variants per episode (lines ~614–621)
- Renders owned badge and suppresses price for owned items
- Already has `ContentPurchaseModal` wired in

**`app/triad/components/codex/tabs/KnytStoreCardsTab.tsx`** — character cards store  
- Already uses `useOwnedEntitlements(personaId)` and shows owned badge
- `ContentPurchaseModal` already wired

**`app/api/entitlements/list/route.ts`** — entitlements enrichment API  
- **Fixed in this session (2026-05-02)** to handle all asset_id formats:
  - `character-card-[UUID]-still/motion` (cart purchase format)
  - `episode-N`, `episode-N-qripto-still`, `episode-N-digital-motion`, etc.
  - `bundle-0-2`, `bundle-3-7`, `bundle-8-12`, `bundle-full`
  - Investor bundle SKUs
  - Legacy `mk_ep01`, `ep1` formats

### What is broken / incomplete

**`app/api/codex/owned/route.ts`** — THE CENTRAL SOURCE OF TRUTH  
This is the route `KnytTab.tsx` calls to determine which episodes are owned. It has three bugs:

1. **Episode regex too narrow**: only matches `ep(\d+)` — misses `episode-1`, `episode-1-qripto-still`, etc. Fix: change regex to `/(?:episode[_-]?|ep)(\d+)/i` (same fix applied to entitlements/list in this session).

2. **No bundle expansion**: owning `bundle-0-2` grants episodes 0, 1, 2 — but the route doesn't expand bundles to episode numbers. Fix: add static bundle-to-episode map and expand before returning.

3. **No KNYT Codex blanket access**: owning `bundle-full` or any full-season investor bundle should grant access to ALL episodes 0–12. Fix: detect these SKUs and add all episode numbers to the owned set.

**`KnytTab.tsx` `owned: false` TODOs**  
Lines ~956, 978, 1001, 1034, 1056 have `owned: false` hardcoded in the character card transform functions. The episode content is already covered by `contentWithOwnership` (which correctly overrides the episode owned flag). The character card items are NOT overridden because `contentWithOwnership` only acts on items with a numeric `episodeNumber`. Need to wire character ownership similarly.

**Other cartridge surfaces (Terra, Community, 21 Sats, etc.)**  
`TerraTab`, `KnytCommunityContentTab`, and other non-store tabs do not currently call `useOwnedEntitlements` or check episode ownership before rendering content. Each surface that exposes readable/watchable episode content needs to call `useOwnedEntitlements(personaId)` and gate individual items.

---

## Implementation Plan

### Phase 1 — Fix `/api/codex/owned` (highest leverage, unblocks everything)

File: `app/api/codex/owned/route.ts`

```typescript
// 1. Extended episode regex
const epMatch = assetId.match(/(?:episode[_-]?|ep)(\d+)/i);

// 2. Bundle-to-episode expansion
const BUNDLE_EPISODES: Record<string, number[]> = {
  'bundle-0-2':  [0, 1, 2],
  'bundle-3-7':  [3, 4, 5, 6, 7],
  'bundle-8-12': [8, 9, 10, 11, 12],
  'bundle-full': [0,1,2,3,4,5,6,7,8,9,10,11,12],
};

// 3. Full-season SKUs (blanket access) — confirm with operator which to include
const FULL_SEASON_SKUS = new Set([
  'bundle-full',
  'knyt-codex-investor', 'top-knyt-investor', 'first-knyt-investor',
  'zero-knyt-investor', 'satoshi-knyt-investor',
  'digital-knyt-cartridge', 'digital-knyt-shelf', 'digital-first-knyt',
]);
const ALL_EPISODES = [0,1,2,3,4,5,6,7,8,9,10,11,12];
```

Also: add FIO handle resolution (same pattern as `entitlements/list` — `personaId.includes('@')` → resolve via `personas.fio_handle`).

### Phase 2 — Wire character card ownership in KnytTab

File: `app/triad/components/codex/tabs/KnytTab.tsx`

The `contentWithOwnership` memo currently only overrides ownership for items with a numeric `episodeNumber`. Character card items have `metadata.characterName` instead. The `/api/codex/owned` route already returns a `characters` array. Wire it:

```typescript
// In the useEffect that fetches owned data:
setOwnedCharacterIds(new Set(ownedData.characters?.map((c: any) => c.characterId) ?? []));

// In contentWithOwnership:
if (item.type === 'character_portrait') {
  const charId = item.id.replace('char_', '');
  return { ...item, metadata: { ...item.metadata, owned: ownedCharacterIds.has(charId) } };
}
```

### Phase 3 — SmartTriad quick actions for owned assets

When `owned: true`, `SmartContentActions` in `KnytTab.tsx` already renders Read/Watch/Listen links. Once Phase 1+2 are done and `owned` flags are correctly set, the quick actions automatically unlock.

Verify in `app/components/content/SmartContentActions.tsx` that the `onClick` handlers for Read/Watch/Listen correctly invoke the content viewers (`PDFLiteReaderModal`, `VideoPlayer`). If the handlers exist but are gated by `owned`, they will work automatically. If any handlers are missing, add them to route to the appropriate viewer.

### Phase 4 — Other cartridge surfaces

For each non-store surface that renders episode or character card content:
- `TerraTab` — add `const { ownedAssetIds } = useOwnedEntitlements(personaId)` and gate individual content items
- `KnytCommunityContentTab` — same pattern
- 21 Sats, Order tabs — same pattern

The pattern is always: check `ownedAssetIds` before rendering the content body; if not owned, render a locked card with a CTA that opens `ContentPurchaseModal`.

---

## Key Files Reference

| File | Role |
|------|------|
| `app/api/codex/owned/route.ts` | Central owned-episodes/characters API — **fix first** |
| `app/api/entitlements/list/route.ts` | Entitlements with metadata enrichment — fixed 2026-05-02 |
| `app/triad/components/codex/tabs/KnytTab.tsx` | Main viewer — wire `owned` flags |
| `app/components/content/SmartContentActions.tsx` | Read/Watch/Listen quick actions |
| `app/triad/components/content/ContentPurchaseModal.tsx` | Purchase modal — already wired in store tabs |
| `app/triad/components/content/VideoPlayer.tsx` | Motion comic player |
| `app/triad/components/content/PDFLiteReaderModal.tsx` | Still/print reader |
| `app/hooks/useOwnedEntitlements.ts` | Client hook for `user_entitlements` |
| `data/codex-configs.ts` | Lore tab already `adminOnly: true` |
| `types/knyt-store.ts` | `BUNDLE_PRICING` with episode arrays — use for bundle expansion |

---

## Open Question for Operator

**Which `asset_id` values in `user_entitlements` represent a "KNYT Codex" purchase that grants blanket access to all episode variants?**

The working assumption is that `bundle-full` and all full-season investor SKUs (`knyt-codex-investor`, `top-knyt-investor`, etc.) qualify. Confirm before implementing Phase 1 so the `FULL_SEASON_SKUS` set is correct.

---

## What Was Done in This Session (2026-05-02)

- Fixed `app/api/entitlements/list/route.ts` to handle all asset_id formats (character-card-[UUID]-still/motion, episode-N variants, bundles, investor SKUs)
- Fixed `app/hooks/useOwnedEntitlements.ts` to expose `coverUrl` in `assetMeta`
- Fixed `app/components/content/SmartWalletDrawer.tsx` to write persona switches to PersonaContext
- Fixed `app/triad/components/content/ContentPurchaseModal.tsx` to check live Supabase session (not just persona prop)
- Fixed `app/api/metame/agent-llm-options/route.ts` build timeout via `force-dynamic`

All changes committed and pushed to `dev` on branch `claude/confirm-aigentz-access-VnNTK`.
