/**
 * useKnytPurchases Hook
 * 
 * Fetches and manages KNYT purchases for a persona
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseKnytPurchasesReturn {
  ownedCharacters: Set<string>;
  purchases: any[];
  loading: boolean;
  error: string | null;
  refreshPurchases: () => Promise<void>;
}

export function useKnytPurchases(personaId?: string): UseKnytPurchasesReturn {
  const [ownedCharacters, setOwnedCharacters] = useState<Set<string>>(new Set());
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!personaId) {
        throw new Error('Persona ID is required');
      }

      const response = await fetch(`/api/codex/knyt-purchases?personaId=${encodeURIComponent(personaId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOwnedCharacters(new Set(data.ownedCharacters));
      setPurchases(data.purchases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch purchases');
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    refreshPurchases();
  }, [refreshPurchases]);

  return {
    ownedCharacters,
    purchases,
    loading,
    error,
    refreshPurchases,
  };
}
