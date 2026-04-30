'use client';

/**
 * useCart — generic localStorage-backed cart hook.
 *
 * SmartTriad-grade primitive. Parameterized by storage key so each
 * cartridge can have its own cart without conflict (e.g. 'knyt_cart_v1',
 * 'qriptopian_cart_v1', 'codex_read_cart_v1').
 *
 * Designed for promotion to `packages/smarttriad/src/cart/` once the
 * package build pipeline is ready. For now it lives in the app layer
 * with the same architectural shape as a SmartTriad primitive.
 *
 * Features:
 * - Add/remove/clear over CartItem[]
 * - Multi-purchase via repeated adds → qty increment (one row per SKU)
 * - Per-line qty stepper via setQty(id, qty); qty <= 0 removes
 * - Back-compat reads — entries persisted before the qty field was added
 *   are normalised to qty=1 on load.
 * - Total / count derivations included
 */

import { useState, useCallback, useEffect } from 'react';
import { type CartItem, cartTotal, cartItemCount, lineQty } from './types';

export interface UseCartOptions {
  /** localStorage key — should be unique per cartridge (e.g. 'knyt_cart_v1'). */
  storageKey: string;
}

function readCart(storageKey: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return parsed.map((line) => ({
      ...line,
      qty: line.qty && line.qty > 0 ? line.qty : 1,
    }));
  } catch {
    return [];
  }
}

function writeCart(storageKey: string, items: CartItem[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch { /* storage full — ignore */ }
}

export function useCart({ storageKey }: UseCartOptions) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart(storageKey));
  }, [storageKey]);

  const syncItems = useCallback((next: CartItem[]) => {
    setItems(next);
    writeCart(storageKey, next);
  }, [storageKey]);

  /**
   * Adds an item to the cart. If a line with the same id already exists,
   * qty is incremented instead of appending a duplicate row. Multi-
   * purchase by repeated clicks is the default UX.
   */
  const addToCart = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      let next: CartItem[];
      if (idx >= 0) {
        const existing = prev[idx];
        next = [
          ...prev.slice(0, idx),
          { ...existing, qty: lineQty(existing) + lineQty(item) },
          ...prev.slice(idx + 1),
        ];
      } else {
        next = [...prev, { ...item, qty: lineQty(item) }];
      }
      writeCart(storageKey, next);
      return next;
    });
  }, [storageKey]);

  /** qty <= 0 removes the line. Used by the drawer's +/- stepper. */
  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      const next = qty <= 0
        ? prev.filter((p) => p.id !== id)
        : prev.map((p) => (p.id === id ? { ...p, qty } : p));
      writeCart(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeCart(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const clearCart = useCallback(() => syncItems([]), [syncItems]);

  const total = cartTotal(items);
  const count = cartItemCount(items);

  return { items, addToCart, removeFromCart, setQty, clearCart, total, count };
}
