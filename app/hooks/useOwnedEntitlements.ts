import { useState, useEffect, useCallback, useMemo } from 'react';
import { getOwnedGnVariants, type GnVariant } from '@/types/knyt-store';

export interface OwnedEntitlement {
  id: string;
  assetId: string;
  tier: string;
  startsAt: string;
  assetMeta: {
    title?: string;
    episodeNumber?: number;
    coverUrl?: string;  // Supabase Storage public URL (preferred — fast, no decryption)
    coverCid?: string;  // Autonomys CID (fallback — requires decryption route)
    coverType?: string;
    characterName?: string;
    isMotion?: boolean;
  };
}

/**
 * Phase B fix — Bug 4: atomized constituent items for shelf/library views.
 *
 * `entitlements` returns raw user_entitlements rows (1 row per purchase →
 * 1 row for a bundle SKU). For the KNYT Shelf grid + wallet library
 * surfaces we want the SKU-expanded contents (40 items for Top KNYT
 * Shelf, not just the 1 bundle entitlement). `expandedItems` is built
 * from /api/codex/owned's detail block so callers don't have to
 * reconcile entitlements + expansion themselves.
 */
export interface ExpandedItem {
  /** Per-item canonical id. For episodes/GN: 'ep:<N>'. For characters:
   *  the codex_media_assets.id when uploaded, or 'character:ep<N>' when
   *  a coming-soon placeholder. */
  itemId: string;
  category: 'gn' | 'episode' | 'character';
  /** -1 for GN; 0..12 for episodes/characters; undefined for ungated. */
  episodeNumber?: number;
  /** True for uploaded + available now; false for granted-but-not-yet
   *  Coming Soon placeholders. */
  available: boolean;
  /** Episode rows include the formats they're available in (still/motion/print). */
  formats?: string[];
}

/**
 * Single ownership source for codex/store/order/wallet surfaces.
 *
 * Combines two backend sources so callers don't have to reconcile them:
 *   - /api/entitlements/list  → enriched user_entitlements rows (assetMeta
 *     for thumbnail/title rendering)
 *   - /api/codex/owned        → SKU-expanded episode pricing-numbers + char
 *     UUIDs (so bundle owners get every grant their SKU resolves to,
 *     including direct knyt_purchases)
 *
 * Use isEpisodeOwned(pricingEpNum) and isCharacterOwned(idOrName) to keep
 * surfaces aligned — never construct magic strings like
 * `episode-N-qripto-still` for ownership checks again.
 */
export function useOwnedEntitlements(personaId?: string) {
  const [entitlements, setEntitlements] = useState<OwnedEntitlement[]>([]);
  const [ownedAssetIds, setOwnedAssetIds] = useState<Set<string>>(new Set());
  const [ownedEpisodeNumbers, setOwnedEpisodeNumbers] = useState<Set<number>>(new Set());
  const [ownedCharacterIds, setOwnedCharacterIds] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<ExpandedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!personaId) {
      setEntitlements([]);
      setOwnedAssetIds(new Set());
      setOwnedEpisodeNumbers(new Set());
      setOwnedCharacterIds(new Set());
      setExpandedItems([]);
      return;
    }
    setLoading(true);
    try {
      const [listRes, ownedRes] = await Promise.all([
        fetch(`/api/entitlements/list?personaId=${encodeURIComponent(personaId)}`).catch(() => null),
        fetch(`/api/codex/owned?personaId=${encodeURIComponent(personaId)}`).catch(() => null),
      ]);

      if (listRes?.ok) {
        const data = await listRes.json();
        const items: OwnedEntitlement[] = data.entitlements ?? [];
        setEntitlements(items);
        setOwnedAssetIds(new Set(items.map((e) => e.assetId)));
      }

      if (ownedRes?.ok) {
        const data = await ownedRes.json() as {
          issues?: Array<{ episodeNumber: number; owned: boolean }>;
          characters?: Array<{ characterId: string; owned: boolean }>;
          detail?: {
            gn?: { available: boolean; comingSoon: boolean };
            episodes?: {
              available?: Array<{ episodeNumber: number; formats: string[] }>;
              comingSoon?: Array<{ episodeNumber: number; formats: string[] }>;
            };
            characters?: {
              available?: Array<{ characterId: string; episodeNumber?: number }>;
              comingSoon?: Array<{ characterId: string; episodeNumber?: number }>;
            };
          };
        };
        setOwnedEpisodeNumbers(new Set((data.issues ?? []).map((i) => i.episodeNumber)));
        setOwnedCharacterIds(new Set((data.characters ?? []).map((c) => c.characterId)));

        const detail = data.detail;
        if (detail) {
          const items: ExpandedItem[] = [];
          if (detail.gn?.available) {
            items.push({ itemId: 'ep:-1', category: 'gn', episodeNumber: -1, available: true });
          } else if (detail.gn?.comingSoon) {
            items.push({ itemId: 'ep:-1', category: 'gn', episodeNumber: -1, available: false });
          }
          for (const e of detail.episodes?.available ?? []) {
            items.push({ itemId: `ep:${e.episodeNumber}`, category: 'episode', episodeNumber: e.episodeNumber, available: true, formats: e.formats });
          }
          for (const e of detail.episodes?.comingSoon ?? []) {
            items.push({ itemId: `ep:${e.episodeNumber}`, category: 'episode', episodeNumber: e.episodeNumber, available: false, formats: e.formats });
          }
          for (const c of detail.characters?.available ?? []) {
            items.push({ itemId: c.characterId, category: 'character', episodeNumber: c.episodeNumber, available: true });
          }
          for (const c of detail.characters?.comingSoon ?? []) {
            items.push({ itemId: c.characterId, category: 'character', episodeNumber: c.episodeNumber, available: false });
          }
          setExpandedItems(items);
        } else {
          setExpandedItems([]);
        }
      }
    } catch {
      // degrade gracefully — badges simply won't show
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pricing-episode convention: pass pricingEp (e.g. 0 for E$0, -1 for AGN).
  const isEpisodeOwned = useCallback(
    (pricingEp: number) => ownedEpisodeNumbers.has(pricingEp),
    [ownedEpisodeNumbers]
  );

  // Accepts character UUID (codex_media_assets.id). Direct purchases via
  // knyt_purchases also surface their character UUID through /api/codex/owned.
  const isCharacterOwned = useCallback(
    (characterId: string) => ownedCharacterIds.has(characterId),
    [ownedCharacterIds]
  );

  // Character ownership by pricing-convention episode number (0..12), honoring
  // SKU-expanded bundles. The store's KNYT Cards tab uses this so bundle
  // holders (Top KNYT Shelf etc.) see Owned badges on each of the 13 cards
  // without needing the per-card UUID.
  const isCharacterOwnedByEp = useCallback(
    (pricingEp: number) =>
      expandedItems.some(
        (it) => it.category === 'character' && it.episodeNumber === pricingEp && it.available,
      ),
    [expandedItems],
  );

  // Which GN variants (qripto / digital / paperback / hardcover / leatherbound)
  // the persona owns, derived from their bundle SKUs. Top KNYT Shelf →
  // qripto + paperback, so the GN store badges only those two — not Digital.
  const ownedGnVariants = useMemo<Set<GnVariant>>(
    () => getOwnedGnVariants(ownedAssetIds),
    [ownedAssetIds],
  );

  const isGnVariantOwned = useCallback(
    (variant: GnVariant) => ownedGnVariants.has(variant),
    [ownedGnVariants],
  );

  return {
    entitlements,
    ownedAssetIds,
    ownedEpisodeNumbers,
    ownedCharacterIds,
    expandedItems,
    ownedGnVariants,
    isEpisodeOwned,
    isCharacterOwned,
    isCharacterOwnedByEp,
    isGnVariantOwned,
    loading,
    refresh,
  };
}
