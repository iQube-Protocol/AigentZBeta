'use client';

/**
 * useRegistryOwnedItems — registry-backed ownership derivations.
 *
 * Stage 4 C19. Wraps useContentQubeSeriesRights and exposes the legacy
 * helper surface that store/grid tabs consume: ownedAssetIds /
 * ownedEpisodeNumbers / ownedCharacterIds / isEpisodeOwned /
 * isCharacterOwned / isCharacterOwnedByEp / isGnVariantOwned /
 * ownedGnVariants / expandedItems / loading / refresh.
 *
 * Replaces the SKU-expansion half of useOwnedEntitlements (the wallet-
 * list half migrated to useEntitlementsList in C18). After C19 the
 * legacy useOwnedEntitlements + /api/codex/owned are operator-cleanup
 * targets — no live consumer in app/.
 *
 * Single registry call (metaKnyts series) — content_kind + display_number
 * carry the per-class derivations.
 *
 * Authority compliance: hook never decides ownership. The persona_owns
 * boolean comes from the registry endpoint which evaluates via
 * evaluateAccess + userOwnsAsset. Hook just derives.
 */

import { useCallback, useMemo } from 'react';
import { useContentQubeSeriesRights } from '@/app/triad/components/codex/tabs/useContentQubeSeriesRights';
import { getOwnedGnVariants, type GnVariant } from '@/types/knyt-store';

export interface ExpandedItem {
  itemId: string;
  category: 'gn' | 'episode' | 'character';
  episodeNumber?: number;
  available: boolean;
  formats?: string[];
}

interface Result {
  ownedAssetIds: Set<string>;
  ownedEpisodeNumbers: Set<number>;
  ownedCharacterIds: Set<string>;
  ownedGnVariants: Set<GnVariant>;
  expandedItems: ExpandedItem[];
  loading: boolean;
  error: string | null;
  isEpisodeOwned: (pricingEp: number) => boolean;
  isCharacterOwned: (characterId: string) => boolean;
  isCharacterOwnedByEp: (pricingEp: number) => boolean;
  isGnVariantOwned: (variant: GnVariant) => boolean;
  refresh: () => void;
}

export function useRegistryOwnedItems(personaId?: string): Result {
  const { qubes, loading, error } = useContentQubeSeriesRights('metaKnyts', {
    personaId,
  });

  const derived = useMemo(() => {
    const ownedAssetIds = new Set<string>();
    const ownedEpisodeNumbers = new Set<number>();
    const ownedCharacterIds = new Set<string>();
    const expandedItems: ExpandedItem[] = [];

    for (const item of qubes) {
      const m = item.manifest as {
        id?: string;
        content_kind?: string;
        content_type?: string;
        display_number?: number;
        persona_owns?: boolean;
        is_placeholder?: boolean;
      };
      if (!m.persona_owns) continue;

      const id = m.id;
      const kind = m.content_kind ?? '';
      const epNum = typeof m.display_number === 'number' ? m.display_number : undefined;

      if (id) ownedAssetIds.add(id);

      if (kind === 'episode' || kind === 'gn') {
        // GN uses episode_number = -1 by Phase B convention; episodes use 0..12.
        if (typeof epNum === 'number') ownedEpisodeNumbers.add(epNum);
        expandedItems.push({
          itemId: id ?? `${kind}:${epNum ?? '?'}`,
          category: kind === 'gn' ? 'gn' : 'episode',
          episodeNumber: epNum,
          available: !m.is_placeholder,
          formats: m.content_type ? [m.content_type] : undefined,
        });
      } else if (kind === 'character') {
        if (id) ownedCharacterIds.add(id);
        expandedItems.push({
          itemId: id ?? `character:ep${epNum ?? '?'}`,
          category: 'character',
          episodeNumber: epNum,
          available: !m.is_placeholder,
        });
      }
    }

    return { ownedAssetIds, ownedEpisodeNumbers, ownedCharacterIds, expandedItems };
  }, [qubes]);

  const ownedGnVariants = useMemo<Set<GnVariant>>(
    () => getOwnedGnVariants(derived.ownedAssetIds),
    [derived.ownedAssetIds],
  );

  const isEpisodeOwned = useCallback(
    (pricingEp: number) => derived.ownedEpisodeNumbers.has(pricingEp),
    [derived.ownedEpisodeNumbers],
  );

  const isCharacterOwned = useCallback(
    (characterId: string) => derived.ownedCharacterIds.has(characterId),
    [derived.ownedCharacterIds],
  );

  const isCharacterOwnedByEp = useCallback(
    (pricingEp: number) =>
      derived.expandedItems.some(
        (it) =>
          it.category === 'character' && it.episodeNumber === pricingEp && it.available,
      ),
    [derived.expandedItems],
  );

  const isGnVariantOwned = useCallback(
    (variant: GnVariant) => ownedGnVariants.has(variant),
    [ownedGnVariants],
  );

  // refresh is a no-op stub — useContentQubeSeriesRights has its own 3-min
  // cache; manual refresh is rarely needed and not exposed today.
  // Future: extend useContentQubeSeriesRights with a refresh trigger.
  const refresh = useCallback(() => {
    /* no-op for now */
  }, []);

  return {
    ownedAssetIds: derived.ownedAssetIds,
    ownedEpisodeNumbers: derived.ownedEpisodeNumbers,
    ownedCharacterIds: derived.ownedCharacterIds,
    ownedGnVariants,
    expandedItems: derived.expandedItems,
    loading,
    error,
    isEpisodeOwned,
    isCharacterOwned,
    isCharacterOwnedByEp,
    isGnVariantOwned,
    refresh,
  };
}
