'use client';

import { useState, useCallback, useEffect } from 'react';
import { type CartItem, cartTotal, cartTotalWithKnyt } from '@/types/knyt-store';
import type { ContentType } from '../../content/ContentPurchaseModal';

const STORAGE_KEY = 'knyt_cart_v1';

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
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

  const addToCart = useCallback((item: CartItem) => {
    setItems((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      const next = exists ? prev : [...prev, item];
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

  return { items, addToCart, removeFromCart, clearCart, total, totalWithKnyt };
}
