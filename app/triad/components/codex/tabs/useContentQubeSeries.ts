'use client';

/**
 * useContentQubeSeries — fetches ContentQube manifests for a given series
 * from GET /api/registry/content-qube/series.
 *
 * Replaces direct Supabase reads in KNYT tab components so persona_owns is
 * always resolved server-side via evaluateAccess, not inferred client-side.
 */

import { useEffect, useState } from 'react';
import type { ContentQubeDisplayManifest, ContentQubeEditionSummary } from '@/types/contentQube';

export interface ContentQubeSeriesItem {
  manifest: ContentQubeDisplayManifest;
  editionSummary: ContentQubeEditionSummary;
  codexSlugs: string[];
}

interface CacheEntry {
  data: ContentQubeSeriesItem[];
  fetchedAt: number;
}

// Module-level cache keyed by "series:contentKind:lifecycleState" so multiple
// tabs sharing the same filter don't re-fetch within the TTL window.
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 min

function cacheKey(series: string, contentKind?: string, lifecycleState?: string): string {
  return `${series}:${contentKind ?? ''}:${lifecycleState ?? ''}`;
}

interface UseContentQubeSeriesOpts {
  contentKind?: string;
  lifecycleState?: string;
  /** Skip the fetch entirely (e.g. when series is not yet known). */
  skip?: boolean;
}

interface UseContentQubeSeriesResult {
  qubes: ContentQubeSeriesItem[];
  loading: boolean;
  error: string | null;
}

export function useContentQubeSeries(
  series: string,
  opts: UseContentQubeSeriesOpts = {},
): UseContentQubeSeriesResult {
  const { contentKind, lifecycleState, skip = false } = opts;
  const key = cacheKey(series, contentKind, lifecycleState);

  const [qubes, setQubes]     = useState<ContentQubeSeriesItem[]>([]);
  const [loading, setLoading] = useState(!skip);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (skip || !series) {
      setLoading(false);
      return;
    }

    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setQubes(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ series });
    if (contentKind)    params.set('contentKind', contentKind);
    if (lifecycleState) params.set('lifecycleState', lifecycleState);

    fetch(`/api/registry/content-qube/series?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ ok: boolean; data?: { qubes: ContentQubeSeriesItem[] }; error?: string }>;
      })
      .then((json) => {
        if (cancelled) return;
        if (!json.ok || !json.data) throw new Error(json.error ?? 'bad response');
        const items = json.data.qubes;
        CACHE.set(key, { data: items, fetchedAt: Date.now() });
        setQubes(items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'fetch failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip]);

  return { qubes, loading, error };
}
