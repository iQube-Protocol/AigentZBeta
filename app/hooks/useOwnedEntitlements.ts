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

export function useOwnedEntitlements(personaId?: string) {
  const [entitlements, setEntitlements] = useState<OwnedEntitlement[]>([]);
  const [ownedAssetIds, setOwnedAssetIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!personaId) {
      setEntitlements([]);
      setOwnedAssetIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/entitlements/list?personaId=${encodeURIComponent(personaId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const items: OwnedEntitlement[] = data.entitlements ?? [];
      setEntitlements(items);
      setOwnedAssetIds(new Set(items.map((e) => e.assetId)));
    } catch {
      // degrade gracefully — badges simply won't show
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entitlements, ownedAssetIds, loading, refresh };
}
