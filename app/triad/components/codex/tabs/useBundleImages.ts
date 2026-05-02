'use client';

import { useEffect, useState } from 'react';

export type BundleTier = 'bronze' | 'silver' | 'gold';

export interface BundleImages {
  bronze: string | null;
  silver: string | null;
  gold: string | null;
  perSku: Record<string, string>;
}

const cache: { data: BundleImages | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000;

const EMPTY: BundleImages = { bronze: null, silver: null, gold: null, perSku: {} };

/**
 * Default Qripto-flavored hero image used by every bundle without an explicit
 * bronze/silver/gold mapping. Operator-specified: "1 Cover 1a" cover (the
 * Graphic Novel α cover) used for the remaining Qripto bundle variants.
 */
const DEFAULT_QRIPTO_CID = 'bafkr6ifnltnq2xidhizv7lkvrevsipvl4l7qx6weca42q5iacffmybuxzm';
const DEFAULT_QRIPTO_URL = `/api/content/cover/${encodeURIComponent(DEFAULT_QRIPTO_CID)}?variant=thumb`;

/**
 * Maps a bundle SKU id (from BUNDLE_PRICING) to its tier hero image. Bundles
 * not listed here fall through to the Qripto default cover (DEFAULT_QRIPTO_URL).
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

  /**
   * Returns the hero image for a bundle SKU.
   * Resolution order:
   *   1. Operator override (store_skus.bundle_image_asset_id) — perSku map
   *   2. Tier mapping (bronze/silver/gold) — legacy seed
   *   3. Qripto default cover ("1 Cover 1a")
   */
  function getBundleImage(bundleId: string): string {
    const override = data.perSku?.[bundleId];
    if (override) return override;
    const tier = getBundleTier(bundleId);
    if (tier) {
      const tierUrl = data[tier];
      if (tierUrl) return tierUrl;
    }
    return DEFAULT_QRIPTO_URL;
  }

  return { data, loading, getBundleImage };
}

