/**
 * @services/cart — generic SmartTriad-grade cart primitives.
 *
 * Designed for promotion to `packages/smarttriad/src/cart/` once the
 * workspace package build is ready. For now lives in the app layer
 * with the architectural shape of a SmartTriad primitive.
 *
 * Consumers:
 * - KNYT cartridge: `app/triad/components/codex/tabs/useKnytCart.ts`
 *   wraps useCart with storageKey='knyt_cart_v1'.
 * - Future Qriptopian / codex Read tab: same pattern, different keys.
 */

export type { CartItem, CartItemModality, CartItemLayer } from './types';
export { cartTotal, cartItemCount, lineQty } from './types';
export { useCart, type UseCartOptions } from './useCart';
