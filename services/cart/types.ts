/**
 * Cart types — generic primitives for the SmartTriad cart layer.
 *
 * Designed for promotion to `packages/smarttriad/src/cart/` once the
 * package build pipeline is ready. Cartridge-specific extensions
 * (KNYT discount, productType mapping) live in their own modules
 * (e.g. `types/knyt-store.ts`) and reference these primitives.
 *
 * Storage key is provided per-cartridge so KNYT, Qriptopian, codex
 * Read-tab, etc. can each have their own cart without conflict.
 */

export type CartItemModality = 'still' | 'motion' | 'bundle';
export type CartItemLayer = 'digital' | 'qripto' | 'print';

/**
 * Generic cart line. Cartridge-specific fields (e.g. `excludeKnytDiscount`,
 * `contentType` for KNYT) live as optional fields here so the same shape
 * can flow through any cartridge's cart. This is the canonical definition.
 */
export interface CartItem {
  id: string;
  label: string;
  modality: CartItemModality;
  layer: CartItemLayer;
  priceUsd: number;
  thumbUrl?: string;
  /**
   * True for lines that should not receive a cartridge-level "pay with native
   * token" discount (e.g. KNYT print bundles that are not investor specials).
   * Generic field name — any cartridge that has a discount toggle uses it.
   */
  excludeKnytDiscount?: boolean;
  /** Quantity of this line. Defaults to 1 if absent. */
  qty?: number;
  /**
   * KNYT-specific content-type tag used by /api/cart/{quote,complete} to
   * resolve the productType. Generic field shape: any string. For KNYT,
   * see `cartContentTypeToProductType` in `types/knyt-store.ts`.
   */
  contentType?:
    | 'scroll_still'
    | 'scroll_motion'
    | 'character_card'
    | 'character_card_motion'
    | 'bundle_3_still'
    | 'bundle_5_still'
    | 'bundle_3_motion'
    | 'bundle_5_motion'
    | 'season_codex_still'
    | 'season_codex_motion';
}

export function lineQty(item: CartItem): number {
  return item.qty && item.qty > 0 ? item.qty : 1;
}

/** Sum of priceUsd × qty across all lines (no rail-specific discount). */
export function cartTotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.priceUsd * lineQty(i), 0);
}

/** Total count of items (sum of qty across all lines). */
export function cartItemCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + lineQty(i), 0);
}
