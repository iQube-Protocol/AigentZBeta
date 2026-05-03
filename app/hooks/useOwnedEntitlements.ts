import { useState, useEffect, useCallback } from 'react';

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
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!personaId) {
      setEntitlements([]);
      setOwnedAssetIds(new Set());
      setOwnedEpisodeNumbers(new Set());
      setOwnedCharacterIds(new Set());
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
        };
        setOwnedEpisodeNumbers(new Set((data.issues ?? []).map((i) => i.episodeNumber)));
        setOwnedCharacterIds(new Set((data.characters ?? []).map((c) => c.characterId)));
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

  return {
    entitlements,
    ownedAssetIds,
    ownedEpisodeNumbers,
    ownedCharacterIds,
    isEpisodeOwned,
    isCharacterOwned,
    loading,
    refresh,
  };
}
