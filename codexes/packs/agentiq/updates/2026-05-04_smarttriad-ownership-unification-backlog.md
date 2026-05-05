# Phase 2 Backlog — Unify Persona-Content Ownership at the SmartTriad Layer

**Date:** 2026-05-04
**Phase:** Phase 2 (post-stabilization)
**Status:** Backlog — not blocking current ship

---

## Why this is in the backlog

A deep architectural trace identified that persona-to-content ownership is currently resolved by **multiple independent paths** that can disagree with each other. The immediate split-source bug between the OWNED badge and the click-time gate has been patched (see `2026-05-04_persona-hydration-pdf-video-admin-fixes.md` and the cache-hit + `metadata.owned` primary-check fixes in `KnytTab.tsx`), but the underlying architecture still violates the iQube principle the operator articulated:

> If the persona and content are bound at the SmartTriad level, it shouldn't matter what surface or cartridge the persona is in — it should be matched with content it owns and given access wherever it is.

Phase 2 should make ownership a single store at the SmartTriad layer that every surface (Codex tabs, runtime remixer, payment modals, PDF/video viewers) reads from.

---

## Current state — separate ownership paths

| Path | Location | Reads from | Used by |
|------|----------|------------|---------|
| `getOwnedAssetIds()` | `services/rewards/assetOwnership.ts:203` | `user_entitlements` + SKU expansion | `/api/codex/owned`, `/api/entitlements/owned-assets` |
| `useOwnedAssets()` | `app/hooks/useOwnedAssets.ts` | `/api/entitlements/owned-assets` | `useCardAccess` |
| `KnytTab.fetchOwnedEpisodes` | `app/triad/components/codex/tabs/KnytTab.tsx:1485` | `/api/codex/owned` | `ownedEpisodeNumbers` (badge) + `ownedIssues` (lock check) |
| `SmartTriadProvider.refreshLibrary` | `app/components/content/SmartTriadProvider.tsx:506` | `/api/content/entitlements` (different endpoint) | `state.ownedContentIds` — **never wired to Codex tabs** |
| `RemixDialog` entitlement | `components/metame/runtime/RemixDialog.tsx:152` | persona presence only | Remix flow — **no ownership check at all** |
| `SmartContentActionProvider` | `app/contexts/SmartContentActionContext.tsx` | none | Action button rendering — **no ownership awareness** |

Symptoms this caused:
- OWNED badge correct on cards but click handler routed to payment (now patched at `KnytTab` level only)
- SmartTriad library could disagree with Codex ownership state
- Remixer requires only a persona — owners and non-owners get the same gate
- Payment handler has no guard against accidentally charging an owner

---

## Phase 2 design — single source at SmartTriad

### Target state

```
                  ┌─────────────────────────────────┐
                  │  SmartTriad ownership store     │
                  │  Set<assetId> + Set<episodeNum> │
                  │  refreshed on persona change    │
                  │  + invalidated on purchase event│
                  └─────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     KnytTab.contentWith    RuntimeCapsule    PDFPageViewer/
     Ownership +            RemixEditor       VideoPlayer
     isEpisodeLocked        entitlement gate  entitlement gate
```

### Concrete changes

1. **Hoist ownership into `SmartTriadProvider`**
   - `state.ownedAssetIds: Set<string>` (already exists as `ownedContentIds`)
   - `state.ownedEpisodeNumbers: Set<number>` (new — derived from owned assets)
   - `state.ownershipResolvedFor: string | null` (which persona this set was computed for)
   - Single API call: `/api/entitlements/owned-assets?personaId=...`
   - Re-fetch on `personaId` change and on `purchase-completed` event

2. **Expose via hook**
   - `useSmartTriadOwnership()` returns `{ ownedAssetIds, ownedEpisodeNumbers, isOwned(assetId), isEpisodeOwned(num), loading, refresh() }`

3. **Refactor consumers**
   - `KnytTab.fetchOwnedEpisodes` → delete; consume from `useSmartTriadOwnership()`
   - `KnytTab.isEpisodeLocked` → `useSmartTriadOwnership().isEpisodeOwned(num)` is the only check (plus credential gate for restricted items)
   - `KnytTab.contentWithOwnership` → stamp `metadata.owned` from the same hook
   - `useOwnedAssets` → thin wrapper around the SmartTriad store, kept for compatibility

4. **Add ownership awareness to `SmartContentActionProvider`**
   - `executeAction('buy', item)` must check `isOwned(item.id)` first; if true, surface a `'already-owned'` toast and route to read/watch instead

5. **Add ownership gate to `RemixDialog`**
   - Phase 2 spec: remixing an owned source is free; remixing a non-owned source either pays the source price first or is denied (operator decision)
   - For now, surface ownership state in the dialog so the operator can decide policy

6. **Purchase event broadcasting**
   - On successful purchase, dispatch `aa-purchase-complete-v1` so SmartTriad ownership cache invalidates immediately (rather than waiting for the 5-minute TTL)

### Invariants to enforce

- **One read, many subscribers**: ownership is fetched once per persona change, not per surface mount.
- **Optimistic update on purchase**: SmartTriad updates ownership locally before the next fetch confirms it.
- **Persona switch invalidates everything**: switching personas clears `ownedAssetIds` synchronously; loading state is exposed.

---

## Out of scope for Phase 2 (Phase 3 territory)

- iQube cryptographic enforcement (TokenQube + DataQube + BlackQube). Phase 2 still uses Supabase entitlements as the source; Phase 3 swaps to on-chain TokenQube ownership proofs.
- Cross-cartridge ownership reconciliation (e.g. KNYT entitlements granting access in Qripto cartridge). Defer until cartridge-level scoping is formalized.

---

## Migration order (suggested)

1. Add `useSmartTriadOwnership()` reading from existing `/api/entitlements/owned-assets` — same data, new shape
2. Migrate `KnytTab` first; verify badge + lock + payment all use the same source
3. Migrate `SmartContentActionProvider` to consult ownership before `executeAction('buy')`
4. Add purchase event broadcast + cache invalidation
5. Add `RemixDialog` ownership-aware UI (informational first, gating later)
6. Delete the duplicate fetchers (`fetchOwnedEpisodes`, raw `useOwnedAssets`, `SmartTriadProvider.refreshLibrary` if it's no longer needed)

---

## Acceptance criteria

- [ ] Single `useSmartTriadOwnership()` hook is the only place ownership is fetched in client code
- [ ] OWNED badge and `isEpisodeLocked()` provably read from the same value (cannot diverge by construction)
- [ ] Payment handler refuses to charge for an already-owned item
- [ ] Persona switch synchronously clears ownership UI state across all open surfaces
- [ ] Purchase completes → ownership cache invalidates without page reload
- [ ] RemixDialog displays ownership state (gating policy TBD)

---

## Files touched (estimate)

| File | Change |
|------|--------|
| `app/components/content/SmartTriadProvider.tsx` | Add ownership store + refresh effect |
| `app/hooks/useSmartTriadOwnership.ts` | NEW — public hook |
| `app/triad/components/codex/tabs/KnytTab.tsx` | Replace `fetchOwnedEpisodes` + `isEpisodeLocked` |
| `app/contexts/SmartContentActionContext.tsx` | Consult ownership before `'buy'` |
| `components/metame/runtime/RemixDialog.tsx` | Ownership-aware UI |
| `app/hooks/useOwnedAssets.ts` | Thin wrapper or removed |

---

## Known server-side conflict to resolve in Phase 2

### Entitlement format divergence: `/api/codex/owned` vs `userOwnsAsset`

**Status:** Temporarily patched (2026-05-05, commit `733ecf96`). Root cause still present architecturally.

`/api/codex/owned` (the badge source) handles multiple legacy entitlement `assetId` formats:
- `episode-N` (pricing convention, e.g. `episode-0` = first purchasable episode)
- `epN` (shorthand format)
- `mk_epNN_*` master IDs (via `getOwnedAssetIds` expansion)
- Direct UUIDs

`userOwnsAsset` (the PDF/video proxy gate) only handled exact-match and SKU expansion — no legacy format awareness. Personas whose entitlements use `episode-N` format saw badge=OWNED but PDF gate returned 403.

**Temporary fix:** Added a legacy format check (step 2) to `userOwnsAsset` that parses `mk_epNN_*` master IDs, converts to pricing convention (`pricingEp = dbEp - 1`), and matches against `episode-N`/`epN` entitlements. Structural mismatch remains.

**Phase 2 resolution — part of the unified ownership store:**

1. **Canonical entitlement normalisation** — a single function `normaliseEntitlementAssetId(rawId): NormalisedAssetRef` that maps all known formats (`episode-N`, `epN`, `mk_ep*`, UUID, bundle SKU) to a common `{ type, episodeNumber, masterId, skuId }` shape. All ownership resolvers call this; no format-specific logic scattered across routes.

2. **Single ownership API** — one endpoint (`/api/entitlements/owned-assets`) that enumerates what a persona owns in normalised form. Both the badge and the gate read from this. The current split between `/api/codex/owned` and the `userOwnsAsset` service call is eliminated.

3. **`isEpisodeLocked()` redesign** — the current client-side function has accumulated four overlapping checks: `episodeNumber === null`, `item.metadata?.owned`, `ownedIssues`, `hasAccessRestriction`. These are ordered by recency of patch, not by logical precedence. Phase 2 replaces this with a single `useSmartTriadOwnership().isEpisodeOwned(num)` call whose source of truth is the unified store — no local state forks possible.

4. **Entitlement write path** — purchases must record entitlements in the canonical format from day one, not in `episode-N` legacy format. Purchase handler updated to write `mk_ep{NN}_{type}_{tier}` master IDs directly, or SKU grants via `store_skus`, so legacy format check becomes unreachable.

---

## Reference — symptoms patched in stabilization (NOT this phase)

- Cache-hit early return in `fetchOwnedEpisodes` left `ownedIssues` empty — fixed by reconstructing it from cached episode numbers
- `isEpisodeLocked` now checks `item.metadata?.owned` first as a primary gate, eliminating the local divergence window
- Mobile-invisible action buttons (`opacity-0 group-hover:opacity-100`) — fixed in `KnytTemplateRenderer`
- `userOwnsAsset` legacy format patch (`episode-N` → masterId mapping) — temporary fix for badge/gate 403 divergence
- Embed bridge persona race — fixed via lazy localStorage initializer in `useCodexEmbedAuthBridge`
- Diagnostic logs added to `KnytTab.handleViewerOpen`, `MetaMeRuntime` persona resolver, admin-check, and editor dispatch

These stabilizations should be merged before Phase 2 work begins.
