'use client';

import { useEffect, useState } from 'react';

export type BundleTier = 'bronze' | 'silver' | 'gold';

export interface BundleImages {
  bronze: string | null;
  silver: string | null;
  gold: string | null;
}

const cache: { data: BundleImages | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000;

const EMPTY: BundleImages = { bronze: null, silver: null, gold: null };

/**
 * Maps a bundle SKU id (from BUNDLE_PRICING) to its tier hero image. Bundles
 * not listed here use no tier image (fall through to the existing thumbnail
 * resolver in the calling component).
 */
export const BUNDLE_ID_TO_TIER: Record<string, BundleTier> = {
  // Bronze — single-shelf bundles (Qripto + Digital editions of Codex / Top Shelf)
  'knyt-codex-investor':   'bronze',
  'top-knyt-investor':     'bronze',
  'digital-knyt-cartridge':'bronze',
  'digital-knyt-shelf':    'bronze',
  // Silver — collector tiers (First / Zero / Digital First)
  'first-knyt-investor':   'silver',
  'zero-knyt-investor':    'silver',
  'digital-first-knyt':    'silver',
  // Gold — Satoshi-tier flagship
  'satoshi-knyt-investor': 'gold',
};

export function getBundleTier(bundleId: string): BundleTier | null {
  return BUNDLE_ID_TO_TIER[bundleId] ?? null;
}

export function useBundleImages() {
  const [data, setData] = useState<BundleImages>(cache.data ?? EMPTY);
  const [loading, setLoading] = useState(!cache.data);

  useEffect(() => {
    if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
      setData(cache.data);
      setLoading(false);
      return;
    }
    fetch('/api/knyt/bundle-images?series=metaKnyts')
      .then((r) => r.json())
      .then((d: BundleImages) => {
        cache.data = d;
        cache.fetchedAt = Date.now();
        setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function getBundleImage(bundleId: string): string | null {
    const tier = getBundleTier(bundleId);
    if (!tier) return null;
    return data[tier] ?? null;
  }

  return { data, loading, getBundleImage };
}
