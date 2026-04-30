'use client';

import { useState, useCallback, useEffect } from 'react';
import { type CartItem, cartTotal, cartTotalWithKnyt, cartItemCount } from '@/types/knyt-store';
import type { ContentType } from '../../content/ContentPurchaseModal';

const STORAGE_KEY = 'knyt_cart_v1';

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    // Back-compat: any persisted line missing qty defaults to 1.
    return parsed.map((line) => ({
      ...line,
      qty: line.qty && line.qty > 0 ? line.qty : 1,
    }));
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* storage full — ignore */ }
}

export interface CartLineItem {
  id: string;
  label: string;
  contentType: ContentType;
  contentId: string;
  priceUsd: number;
  thumbUrl?: string;
  modality: CartItem['modality'];
  layer: CartItem['layer'];
  excludeKnytDiscount?: boolean;
}

export function useKnytCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart());
  }, []);

  const syncItems = useCallback((next: CartItem[]) => {
    setItems(next);
    writeCart(next);
  }, []);

  /**
   * Adds an item to the cart. If a line with the same id already exists,
   * its qty is incremented instead of appending a duplicate row. Multi-
   * purchase by repeated clicks is the default UX — same SKU, qty++.
   */
  const addToCart = useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      let next: CartItem[];
      if (idx >= 0) {
        const existing = prev[idx];
        const existingQty = existing.qty && existing.qty > 0 ? existing.qty : 1;
        next = [
          ...prev.slice(0, idx),
          { ...existing, qty: existingQty + (item.qty && item.qty > 0 ? item.qty : 1) },
          ...prev.slice(idx + 1),
        ];
      } else {
        next = [...prev, { ...item, qty: item.qty && item.qty > 0 ? item.qty : 1 }];
      }
      writeCart(next);
      return next;
    });
  }, []);

  /**
   * Sets the qty of a line. qty <= 0 removes the line entirely.
   * Used by the drawer's +/- stepper.
   */
  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      const next = qty <= 0
        ? prev.filter((p) => p.id !== id)
        : prev.map((p) => (p.id === id ? { ...p, qty } : p));
      writeCart(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => syncItems([]), [syncItems]);

  const total = cartTotal(items);
  const totalWithKnyt = cartTotalWithKnyt(items);
  const count = cartItemCount(items);

  return { items, addToCart, removeFromCart, setQty, clearCart, total, totalWithKnyt, count };
}
