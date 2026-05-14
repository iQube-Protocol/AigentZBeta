# ContentQube Registry as Single Source of Truth — Shelf + Tab Canonicalization

**Date:** 2026-05-14
**Workstream:** Persona ↔ ContentQube ↔ Codex surface unification
**Status:** Landed (Phases A + B) on `claude/review-session-setup-V82mB`, auto-merging to `dev`
**Commits:** `576dfaa6` (Phase A) → `d9ab98b5` (Phase B)

---

## Why this exists

The operator reported on `dev-beta.aigentz.me`:

1. The `arkagent@knyt` persona (which owns every metaKnyts episode via SKU grants) saw episodes correctly badged "Owned" in the KNYT Shelf, **but clicking any of them routed to the payment modal** — on the platform AND through the thin-client embed. The previous fix (`a4c4e541`, forwarding `personaId` in `useContentQubeSeries`) addressed an iframe-cookie issue but did NOT touch this.
2. Episode 12 was "still not badged as owned" on the Scrolls tab.
3. The KNYT Shelf was missing motion-comic tiles for episodes 1 and 3 (operator-expected total 13 + 13 + 13 + 1 = 40).

Root cause was structural drift, not a single bug: **four parallel ownership-determination paths** had grown across the codebase and disagreed in places where they should have agreed. The operator's architectural premise — every surface that asks "does this persona own X?" or "what is the canonical inventory of Y?" must consult the **same** ContentQube registry / persona spine / DVN receipt pipeline — was correct, and this work makes that premise hold.

---

## The four parallel paths (now reconciled)

| Path | Surface | Decision input | Failure mode |
|---|---|---|---|
| **P1** `OwnedIssue` from `/api/codex/owned` (legacy) | `KnytShelfTab` badge, `KnytTab.isEpisodeLocked`, `openEpisodeVideo` | `{ episodeNumber, owned, comingSoon }` — **variant-blind** | "Owns ep12 print" treated identically to "owns ep12 motion" → payment modal fires on the motion click even when print is owned. |
| **P2** `KnytTab.isEpisodeLocked` | Click-to-open gate | filters P1 by episodeNumber only | Inherits P1 variant blindness — root cause of the operator's primary symptom. |
| **P3** `useContentQubeSeries` → `/api/registry/content-qube/series` → `evaluateAccess` (Phase 8) | `ScrollsTab`, `CharactersTab` | per-`content_qubes`-row `persona_owns` from `userOwnsAsset` | Episode 12 "not badged as owned": registry only knew about rows that exist in `master_content_qubes` (which Phase 6 bridged); SKU-granted-but-unproduced slots fell through. |
| **P4** `userOwnsAsset` (canonical) | Downstream delivery proxy / receipt emitter | `entitlements` direct match + SKU expansion via `getAssetMeta` | When `master_content_qubes` row absent, `getAssetMeta` returns null and SKU expansion silently fails → "owned" returns false even though the persona has rights. |

---

## Phase A — variant-aware predicates (commit `576dfaa6`)

Unblocks the immediate "Owned badge → payment modal" symptom with a surgical, non-architectural change.

### Changes

- **`app/api/codex/owned/route.ts`** — extended `OwnedIssue` with `contentTypes: string[]` populated from the per-slot accumulator (`uploadedSlotMap` keys at lines 130-156 already had the data; it was being collapsed on output). Now consumers see the full per-variant breakdown for each episode.
- **`app/triad/components/codex/tabs/KnytTab.tsx`**:
  - Added `resolveVariant(item)` helper mapping `KnytContentItem.type` → canonical variant string (`'episode_still' | 'episode_motion' | 'episode_print'`).
  - `isEpisodeLocked` now filters `ownedIssues` on BOTH `episodeNumber` AND `contentTypes.includes(variant)`. Backwards-compatible: if the server hasn't deployed the new field yet, falls back to the legacy episode-level check.
  - `openEpisodeVideo` requires `'episode_motion'` specifically in `contentTypes` before opening the player — defence-in-depth against unowned motion playback.
  - `OwnedIssueFromAPI` type extended with `contentTypes`, `comingSoon`, `owned`.

### Net effect

A persona who owns the print bundle but clicks the motion tile is now correctly gated: the click sees `episodeNumber=12` matches but `'episode_motion' ∉ contentTypes` → routes to the watch-variant purchase flow, NOT a generic payment-required state masquerading as something the buyer "already owns."

---

## Phase B — ContentQube registry as canonical SOT (commit `d9ab98b5`)

Migrates the shelf + tabs onto a single registry-backed surface. This is what the operator actually asked for: the spine is the spine; we don't run a parallel ledger.

### New endpoint: `GET /api/registry/content-qube/series-rights`

`app/api/registry/content-qube/series-rights/route.ts` returns the **UNION** of:

1. Every real `content_qubes` row for the series, persona-aware (`manifest.persona_owns` from `evaluateAccess → userOwnsAsset`, exactly as `useContentQubeSeries` already produces it).
2. **Synthesized rights-grant placeholders** for `(category, episode)` slots the persona has SKU rights to but where no `content_qubes` row exists yet. Placeholders carry `manifest.is_placeholder = true`, `manifest.lifecycle_state = 'draft'`, and `persona_owns = true`. The composition reads `getOwnedAssetIds(personaId, series).expectedSlots` and synthesizes shape-matching entries in memory.

Privacy: no T0 fields in the response, no `personaId` in receipts, no master-table pollution. The architectural decision (Option 1 in the plan) was deliberate — we do NOT seed phantom master rows for unproduced content; we synthesize at request time.

### New hook: `useContentQubeSeriesRights`

`app/triad/components/codex/tabs/useContentQubeSeriesRights.ts` — mirrors `useContentQubeSeries` (same module-level 3-min cache, same explicit personaId forwarding for the iframe-cookie issue fixed in `a4c4e541`). Calls the new endpoint and returns the unified array.

### Manifest type change

`types/contentQube.ts::ContentQubeDisplayManifest` got an optional `is_placeholder?: boolean` field. Additive — existing consumers ignore it.

### Surface migrations

- **`KnytShelfTab`** — dropped `useOwnedEntitlements`, now reads from `useContentQubeSeriesRights('metaKnyts', { personaId })`. The shelf builds tiles by grouping qubes per `(episodeNumber, motion-flag)` so the legacy semantic ("one still-tile + one motion-tile per episode" — what the operator counts as 40 = 13+13+13+1) is preserved. `episode_still` + `episode_print` collapse into one "still-comics" tile by design; the print PDF is the canonical read-surface and the still is the cover-only fallback. Coming-soon is `true` only when every underlying qube for the tile is a placeholder or `lifecycle_state in ('draft', 'semi_minted')`.
- **`KnytTab.isEpisodeLocked` + `openEpisodeVideo`** — registry is now the primary check via a `Map<${episode}:${variant}, persona_owns>` lookup. Falls back to Phase A's variant-aware legacy check only when the registry has no entry. The legacy `ownedIssues` state is preserved for badges/counts elsewhere in the file (not migrated this session — a follow-up).
- **`ScrollsTab` + `CharactersTab`** — swapped `useContentQubeSeries` → `useContentQubeSeriesRights`. This is what makes Episode 12 (and any other unproduced-but-SKU-granted slot) badge as Owned: the placeholder surfaces with `persona_owns = true`.

### Rarity caveat (still a backlog item)

`manifest.persona_owns` is a single boolean rolled across all rarities. ScrollsTab renders four rarity columns (Legendary / Epic / Rare / Black) but they share the lock state today. Per-rarity ownership requires per-edition persona lookup via `content_qube_editions`, and is a **Phase C** task — out of scope for this canonicalization.

### Deprecation, not removal

`@deprecated` headers added to `app/hooks/useOwnedEntitlements.ts` and `app/api/codex/owned/route.ts` pointing readers at the registry hook. **Not deleted.** `KnytStoreEpisodesTab`, `KnytStoreCardsTab`, the bundle wizard, and several admin tools still consume them. Removal is a dedicated follow-up sweep.

---

## How this maps to the Qripto Spine writeup

The previous Qripto Spine writeup (`2026-05-13_qripto-spine-contentqube-protocol-alignment.md`) named ContentQube as the first protocol exercising the spine end-to-end and described the canonical chain `getActivePersona → evaluateAccess → claimEditionForPurchase → DVN receipts → mint`. That chain was sound on the **server**, but the **UI tabs were still on legacy paths**. This work brings the UI tabs onto the spine. After this lands:

- One ownership decision per surface, resolved through one resolver (`userOwnsAsset` via `evaluateAccess`).
- One inventory source per series, served from one endpoint (`/series-rights`).
- One rights-expansion path for unproduced content (`expectedSlots` composed in memory; no master-row phantoms).
- T0/T1/T2 hygiene preserved (placeholders carry no T0 fields; `is_placeholder` is a T1 boolean).

---

## Verification (test plan for `arkagent@knyt` on dev-beta)

1. **KNYT Shelf** shows exactly 40 tiles: 13 still + 13 motion (ep1 and ep3 surface as "Owned · Coming Soon" via SKU-rights placeholder) + 13 cards + 1 GN.
2. **Click any Owned episode** (still and motion separately): viewer opens, **no payment modal**. (Previous failure mode: motion variant fired payment despite Owned badge.)
3. **Episode 12** badges as Owned on the Scrolls tab.
4. **Network inspection**:
   - `/api/codex/owned` response now includes `issues[i].contentTypes: string[]` — Phase A field.
   - `/api/registry/content-qube/series-rights` response includes placeholder qubes for unproduced slots (look for `manifest.is_placeholder: true` entries; `manifest.id` prefix `placeholder:`).
5. **Spine smoke test** (operator-runnable):
   ```bash
   node scripts/verify-spine.mjs --host=dev-beta.aigentz.me \
     --personaId=<arkagent-persona-uuid> \
     --owned=mk_ep12_motion --txGuard=mk_ep12_motion
   ```
   All gates pass; the canonical "owned" answer matches what KNYT Shelf displays.
6. **If motion still routes to payment** after this lands, the diagnosis is no longer code — it's the SKU seed. Run in dev Supabase:
   ```sql
   SELECT s.sku_id,
          s.grants_episodes_still, s.grants_episodes_motion, s.grants_episodes_print,
          s.episode_numbers
   FROM store_skus s
   WHERE s.sku_id IN (
     SELECT asset_id FROM user_entitlements
     WHERE persona_id = '<arkagent-persona-uuid>'
   );
   ```
   If `grants_episodes_motion` is `false` on every owned SKU, the persona truly doesn't have motion rights and the payment modal is correct — operator decides whether to update the SKU seed.

---

## Files changed

**Phase A (`576dfaa6`):**
- `app/api/codex/owned/route.ts` — `OwnedIssue.contentTypes[]`, populated from the per-slot accumulator
- `app/triad/components/codex/tabs/KnytTab.tsx` — `resolveVariant` helper; `isEpisodeLocked` and `openEpisodeVideo` variant-aware

**Phase B (`d9ab98b5`):**
- `app/api/registry/content-qube/series-rights/route.ts` — **new endpoint**
- `app/triad/components/codex/tabs/useContentQubeSeriesRights.ts` — **new hook**
- `types/contentQube.ts` — `ContentQubeDisplayManifest.is_placeholder?` added
- `app/triad/components/codex/tabs/KnytShelfTab.tsx` — migrated to registry hook; per-(episode, motion-flag) grouping
- `app/triad/components/codex/tabs/KnytTab.tsx` — registry-backed `registryOwnership` map; primary in `isEpisodeLocked` + `openEpisodeVideo`
- `app/triad/components/codex/tabs/ScrollsTab.tsx` — swapped to rights-aware hook
- `app/triad/components/codex/tabs/CharactersTab.tsx` — swapped to rights-aware hook
- `app/hooks/useOwnedEntitlements.ts` — `@deprecated` header
- `app/api/codex/owned/route.ts` — `@deprecated` header

## Files NOT modified (canonical contracts, operator-locked)

- `services/identity/getActivePersona.ts`
- `services/access/evaluateAccess.ts`
- `services/access/policyResolvers.ts`
- `services/content/getContentDescriptor.ts`
- `services/rewards/assetOwnership.ts` (already correct; the bug was downstream of it)
- `types/access.ts`
- `master_content_qubes` schema and seed (operator decision: no phantom rows for unproduced content)

---

## Next steps (Phase C backlog)

1. **Per-rarity persona ownership** in ScrollsTab — needs a per-edition persona lookup against `content_qube_editions`. Probably extend `ContentQubeDisplayManifest` with `persona_owned_rarities: ContentQubeRarity[]` (a T1-safe rollup, no edition row IDs exposed) and have the registry resolver populate it.
2. **Legacy path removal sweep** — migrate `KnytStoreEpisodesTab`, `KnytStoreCardsTab`, bundle wizard, and admin tools to the registry hooks; then delete `/api/codex/owned` + `useOwnedEntitlements`.
3. **Qriptopian pilot bridge** — re-run the Phase 6 pattern on the Qriptopian series so the same registry serves both cartridges.
4. **Phase 9.3 chain-mint activation** — deploy the Base ERC-1155 / ERC-721 contracts and wire `mintCanonicalEdition` to fire post-claim. See `2026-05-13_base-tokenqube-activation-backlog.md`.
