'use client';

/**
 * useEntitlementsList — minimal wallet-list hook.
 *
 * Stage 4 C18. Fetches /api/entitlements/list directly and returns the
 * enriched user_entitlements rows. Replaces the wallet-side consumer of
 * the legacy useOwnedEntitlements hook (which combined entitlements +
 * SKU-expansion logic from the deprecated /api/codex/owned route).
 *
 * Wallet surfaces don't need SKU expansion — they render a library list.
 * This hook intentionally has no dependency on the registry resolver or
 * on /api/codex/owned. Pure wallet view.
 *
 * Authority: hook never decides ownership. The /api/entitlements/list
 * route is the canonical wallet-list source — it goes through the spine
 * just like the legacy hook did.
 */

import { useCallback, useEffect, useState } from 'react';

export interface WalletEntitlement {
  id: string;
  assetId: string;
  tier: string;
  startsAt: string;
  assetMeta: {
    title?: string;
    episodeNumber?: number;
    coverUrl?: string;
    coverCid?: string;
    coverType?: string;
    characterName?: string;
    isMotion?: boolean;
  };
}

interface Result {
  entitlements: WalletEntitlement[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEntitlementsList(personaId?: string): Result {
  const [entitlements, setEntitlements] = useState<WalletEntitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!personaId) {
      setEntitlements([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/entitlements/list?personaId=${encodeURIComponent(personaId)}`);
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setEntitlements([]);
        return;
      }
      const body = await res.json();
      const rows = Array.isArray(body?.entitlements)
        ? (body.entitlements as WalletEntitlement[])
        : Array.isArray(body?.data)
          ? (body.data as WalletEntitlement[])
          : [];
      setEntitlements(rows);
    } catch (e) {
      setError((e as Error).message || 'Network error');
      setEntitlements([]);
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entitlements, loading, error, refresh };
}
