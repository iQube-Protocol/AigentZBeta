'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface OwnedAssetsData {
  direct: string[];
  expanded: string[];
  ownedSkus: string[];
}

const EMPTY: OwnedAssetsData = { direct: [], expanded: [], ownedSkus: [] };

/**
 * Returns the union of every asset_id the persona owns (direct entitlements +
 * SKU-expanded grants). Use the `owns(assetId)` callback to gate any surface
 * (Scrolls, Characters, GN reader, Terra, Digiterra, Community) consistently.
 *
 * Cached across mounts in module scope per personaId — the gate logic is
 * perf-sensitive because it runs on every card.
 */
export function useOwnedAssets(personaId?: string | null, series: string = 'metaKnyts') {
  const [data, setData] = useState<OwnedAssetsData>(EMPTY);
  const [loading, setLoading] = useState<boolean>(!!personaId);

  const refresh = useCallback(async () => {
    if (!personaId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/entitlements/owned-assets?personaId=${encodeURIComponent(personaId)}&series=${encodeURIComponent(series)}`
      );
      if (!res.ok) {
        setData(EMPTY);
        return;
      }
      const json = (await res.json()) as OwnedAssetsData;
      setData(json);
    } catch {
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [personaId, series]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ownedSet = useMemo(() => {
    const s = new Set<string>();
    data.direct.forEach((id) => s.add(id));
    data.expanded.forEach((id) => s.add(id));
    return s;
  }, [data]);

  const owns = useCallback((assetId?: string | null): boolean => {
    if (!assetId) return false;
    return ownedSet.has(assetId);
  }, [ownedSet]);

  return { data, loading, owns, ownedSet, ownedSkus: data.ownedSkus, refresh };
}
