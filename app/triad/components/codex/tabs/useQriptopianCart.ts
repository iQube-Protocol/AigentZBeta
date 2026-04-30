'use client';

/**
 * Qriptopian-cartridge-specific wrapper around the generic SmartTriad cart
 * primitive. Mirrors `useKnytCart` but binds to the Qriptopian cartridge's
 * own localStorage key so the two cartridges keep independent carts.
 *
 * Feature-flagged via NEXT_PUBLIC_FEATURE_QRIPTOPIAN_CART. Tabs should call
 * `isQriptopianCartEnabled()` and skip mounting cart UI when it returns
 * false. The hook itself is a no-arg passthrough — it does not enforce the
 * flag, leaving rendering decisions to consumers.
 *
 * Cartridge-specific running totals (e.g. a Qripto-token discount) should
 * be layered on top here when the rail is finalised, the same way
 * `useKnytCart` layers `cartTotalWithKnyt`.
 */

import { useCart } from '@/services/cart';

const STORAGE_KEY = 'qriptopian_cart_v1';

export function isQriptopianCartEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env.NEXT_PUBLIC_FEATURE_QRIPTOPIAN_CART === '1' ||
    process.env.NEXT_PUBLIC_FEATURE_QRIPTOPIAN_CART === 'true';
}

export function useQriptopianCart() {
  return useCart({ storageKey: STORAGE_KEY });
}

export type { CartItem } from '@/services/cart';
