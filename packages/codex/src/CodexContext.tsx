/**
 * CodexContext - React Context for CodexQube data
 * Provides iQube protocol compliant content management
 */

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { CodexQube, QubeFilter, QubeSource } from './types';

export interface CodexContextValue {
  /** Currently loaded Codex */
  currentCodex: CodexQube | null;
  /** All available Codices */
  codices: CodexQube[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Load a specific Codex by ID */
  loadCodex: (codexId: string) => Promise<void>;
  /** Load all Codices matching filter */
  loadCodexList: (filter?: QubeFilter) => Promise<void>;
  /** Refresh current Codex */
  refresh: () => Promise<void>;
}

export const CodexContext = createContext<CodexContextValue | null>(null);

interface CodexProviderProps {
  children: ReactNode;
  /** Data source configuration */
  source: QubeSource;
  /** Auto-load codex ID on mount */
  autoLoadCodexId?: string;
  /** Optional initial data */
  initialCodex?: CodexQube;
}

export function CodexProvider({
  children,
  source,
  autoLoadCodexId,
  initialCodex,
}: CodexProviderProps) {
  const [currentCodex, setCurrentCodex] = useState<CodexQube | null>(initialCodex || null);
  const [codices, setCodexList] = useState<CodexQube[]>(initialCodex ? [initialCodex] : []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a specific Codex by ID
  const loadCodex = useCallback(async (codexId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let codex: CodexQube;

      if (source.type === 'local') {
        // Load from local source (imported data)
        throw new Error('Local source not yet implemented. Use initialCodex prop.');
      } else if (source.type === 'api') {
        // Load from API
        const response = await fetch(`${source.endpoint}/codex/${codexId}`, {
          headers: source.headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to load Codex: ${response.statusText}`);
        }

        codex = await response.json();
      } else if (source.type === 'qubebase') {
        // Load from QubeBase
        const response = await fetch(`${source.endpoint}/qubes/${codexId}`, {
          headers: source.headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to load from QubeBase: ${response.statusText}`);
        }

        codex = await response.json();
      } else {
        throw new Error(`Unsupported source type: ${source.type}`);
      }

      setCurrentCodex(codex);
      
      // Update list if not already present
      setCodexList((prev) => {
        const exists = prev.find((c) => c.codexId === codex.codexId);
        if (exists) {
          return prev.map((c) => (c.codexId === codex.codexId ? codex : c));
        }
        return [...prev, codex];
      });
    } catch (err: any) {
      console.error('[CodexProvider] Load error:', err);
      setError(err.message || 'Failed to load Codex');
    } finally {
      setIsLoading(false);
    }
  }, [source]);

  // Load multiple Codices with filter
  const loadCodexList = useCallback(async (filter?: QubeFilter) => {
    setIsLoading(true);
    setError(null);

    try {
      if (source.type === 'local') {
        throw new Error('Local source list not yet implemented');
      } else if (source.type === 'api' || source.type === 'qubebase') {
        const queryParams = new URLSearchParams();
        if (filter?.franchiseId) queryParams.set('franchiseId', filter.franchiseId);
        if (filter?.tenantId) queryParams.set('tenantId', filter.tenantId);
        if (filter?.status) queryParams.set('status', filter.status);
        if (filter?.limit) queryParams.set('limit', filter.limit.toString());
        if (filter?.offset) queryParams.set('offset', filter.offset.toString());

        const endpoint = source.type === 'api' 
          ? `${source.endpoint}/codex?${queryParams}`
          : `${source.endpoint}/qubes?type=codexQube&${queryParams}`;

        const response = await fetch(endpoint, {
          headers: source.headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to load Codex list: ${response.statusText}`);
        }

        const list = await response.json();
        setCodexList(Array.isArray(list) ? list : list.data || []);
      }
    } catch (err: any) {
      console.error('[CodexProvider] List load error:', err);
      setError(err.message || 'Failed to load Codex list');
    } finally {
      setIsLoading(false);
    }
  }, [source]);

  // Refresh current Codex
  const refresh = useCallback(async () => {
    if (currentCodex) {
      await loadCodex(currentCodex.codexId);
    }
  }, [currentCodex, loadCodex]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoadCodexId && !currentCodex) {
      loadCodex(autoLoadCodexId);
    }
  }, [autoLoadCodexId, loadCodex, currentCodex]);

  const value: CodexContextValue = {
    currentCodex,
    codices,
    isLoading,
    error,
    loadCodex,
    loadCodexList,
    refresh,
  };

  return (
    <CodexContext.Provider value={value}>
      {children}
    </CodexContext.Provider>
  );
}
