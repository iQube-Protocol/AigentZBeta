'use client';

/**
 * KNYT-specific wrapper around the generic SmartTriad cart primitive.
 *
 * The generic cart hook + types live at `services/cart/` (designed for
 * promotion to `packages/smarttriad/src/cart/` later). This module just
 * binds it to the KNYT cartridge's localStorage key and adds the
 * KNYT-specific KNYT-discount total.
 *
 * Other cartridges (Qriptopian, codex Read tab, future) use the same
 * pattern: import `useCart` from `@/services/cart`, pass their own
 * `storageKey`, layer cartridge-specific helpers on top.
 */

import { useCart } from '@/services/cart';
import { cartTotalWithKnyt } from '@/types/knyt-store';

const STORAGE_KEY = 'knyt_cart_v1';

export function useKnytCart() {
  const cart = useCart({ storageKey: STORAGE_KEY });
  // KNYT-specific: layer the "with KNYT 20% discount" running total on top of
  // the generic total. Other cartridges may layer their own native-token
  // discount totals on top of useCart in the same way.
  const totalWithKnyt = cartTotalWithKnyt(cart.items);
  return { ...cart, totalWithKnyt };
}

// Re-export the cart-line shape used by consumers that want a typed
// "construct a line" helper. Generic shape lives in services/cart.
export type { CartItem } from '@/services/cart';
