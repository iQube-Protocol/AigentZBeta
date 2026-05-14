'use client';

/**
 * useContentQubeSeriesRights — persona-rights-aware ContentQube series hook.
 *
 * Calls GET /api/registry/content-qube/series-rights, which returns the union
 * of:
 *   1. Real content_qubes rows for the series (with manifest.persona_owns
 *      resolved server-side via evaluateAccess), and
 *   2. Rights-grant placeholders for slots the persona has SKU rights to but
 *      where no underlying content row exists yet (manifest.is_placeholder=true,
 *      manifest.lifecycle_state='draft', persona_owns=true).
 *
 * This is the canonical inventory + ownership hook for shelf/tab surfaces
 * (Phase B canonicalization). Replaces the parallel paths that used to feed
 * those surfaces (`useOwnedEntitlements`, `/api/codex/owned`, `useKnytCards`).
 *
 * Pattern mirrors `useContentQubeSeries` (commit `a4c4e541`); the personaId
 * MUST be forwarded explicitly because the codex iframe doesn't reliably
 * carry the session cookie to the API.
 */

import { useEffect, useState } from 'react';
import type { ContentQubeDisplayManifest, ContentQubeEditionSummary } from '@/types/contentQube';

export interface ContentQubeSeriesRightsItem {
  manifest: ContentQubeDisplayManifest;
  editionSummary: ContentQubeEditionSummary;
  codexSlugs: string[];
}

interface CacheEntry {
  data: ContentQubeSeriesRightsItem[];
  fetchedAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 3 * 60 * 1000; // 3 min

function cacheKey(
  series: string,
  contentKind?: string,
  personaId?: string,
): string {
  return `${series}:${contentKind ?? ''}:${personaId ?? ''}`;
}

interface UseContentQubeSeriesRightsOpts {
  contentKind?: string;
  /** Must be forwarded explicitly — see hook docstring. */
  personaId?: string;
  skip?: boolean;
}

interface UseContentQubeSeriesRightsResult {
  qubes: ContentQubeSeriesRightsItem[];
  loading: boolean;
  error: string | null;
}

export function useContentQubeSeriesRights(
  series: string,
  opts: UseContentQubeSeriesRightsOpts = {},
): UseContentQubeSeriesRightsResult {
  const { contentKind, personaId, skip = false } = opts;
  const key = cacheKey(series, contentKind, personaId);

  const [qubes, setQubes]     = useState<ContentQubeSeriesRightsItem[]>([]);
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
    if (contentKind) params.set('contentKind', contentKind);
    if (personaId)   params.set('personaId', personaId);

    fetch(`/api/registry/content-qube/series-rights?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{
          ok: boolean;
          data?: { qubes: ContentQubeSeriesRightsItem[] };
          error?: string;
        }>;
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
