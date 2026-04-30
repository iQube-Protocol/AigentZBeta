'use client';

import React, { useState } from 'react';
import { X, ShoppingCart, Trash2, Zap, CreditCard, Plus, Minus } from 'lucide-react';
import { type CartItem, getKnytDiscountedPrice, KNYT_COYN_DISCOUNT, usdToKnyt, cartItemCount } from '@/types/knyt-store';
import { ContentPurchaseModal } from '../../content/ContentPurchaseModal';
import type { ContentType } from '../../content/ContentPurchaseModal';

interface Props {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (id: string) => void;
  onClearCart: () => void;
  /** Sets the qty of a line. qty <= 0 removes the line. */
  onSetQty?: (id: string, qty: number) => void;
  personaId?: string;
  total: number;
  totalWithKnyt: number;
}

function lineQty(item: CartItem): number {
  return item.qty && item.qty > 0 ? item.qty : 1;
}

export function KnytCartDrawer({
  open,
  onClose,
  items,
  onRemove,
  onClearCart,
  onSetQty,
  personaId,
  total,
  totalWithKnyt,
}: Props) {
  const [checkoutItem, setCheckoutItem] = useState<CartItem | null>(null);
  const [useKnytDiscount, setUseKnytDiscount] = useState(false);

  if (!open) return null;

  const displayTotal = useKnytDiscount ? totalWithKnyt : total;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[55] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="absolute inset-y-0 right-0 z-[56] w-72 flex flex-col bg-slate-900 border-l border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-teal-400" />
            <span className="text-sm font-semibold text-slate-200">Cart ({cartItemCount(items)})</span>
          </div>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
              <button
                type="button"
                onClick={onClearCart}
                className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                title="Clear cart"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <ShoppingCart className="h-8 w-8 text-slate-700 mb-3" />
              <p className="text-sm text-slate-500">Your cart is empty</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {items.map((item) => {
                const unitPrice = useKnytDiscount && !item.excludeKnytDiscount
                  ? getKnytDiscountedPrice(item.priceUsd)
                  : item.priceUsd;
                const qty = lineQty(item);
                const lineTotal = unitPrice * qty;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 rounded-xl border border-white/5 bg-slate-800/50 p-2.5"
                  >
                    {item.thumbUrl && (
                      <img
                        src={item.thumbUrl}
                        alt={item.label}
                        className="h-10 w-8 rounded object-contain bg-slate-900 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white leading-snug truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{item.modality} · {item.layer}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {/* Qty stepper — only shown when host wires onSetQty.
                            Falls back to read-only "qty: N" tag otherwise. */}
                        {onSetQty ? (
                          <div className="flex items-center gap-0.5 rounded border border-white/10 bg-slate-900/60">
                            <button
                              type="button"
                              onClick={() => onSetQty(item.id, qty - 1)}
                              className="px-1.5 py-0.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-l transition-colors"
                              title={qty <= 1 ? 'Remove from cart' : 'Decrease quantity'}
                            >
                              <Minus className="h-2.5 w-2.5" />
                            </button>
                            <span className="px-1.5 text-[10px] font-semibold text-slate-200 tabular-nums min-w-[1.5ch] text-center">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSetQty(item.id, qty + 1)}
                              className="px-1.5 py-0.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-r transition-colors"
                              title="Increase quantity"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : qty > 1 ? (
                          <span className="text-[9px] text-slate-500 tabular-nums">qty: {qty}</span>
                        ) : null}
                        <p className="text-[11px] font-semibold text-teal-300">
                          ${lineTotal.toFixed(2)}
                          {qty > 1 && (
                            <span className="text-[9px] font-normal text-slate-500 ml-1">
                              ({qty} × ${unitPrice.toFixed(2)})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="p-0.5 rounded text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove line"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — totals + checkout */}
        {items.length > 0 && (
          <div className="flex-shrink-0 border-t border-slate-800/60 p-4 space-y-3">
            {/* KNYT discount toggle */}
            <button
              type="button"
              onClick={() => setUseKnytDiscount((v) => !v)}
              className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors text-left ${
                useKnytDiscount
                  ? 'border-yellow-700/50 bg-yellow-900/20'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <Zap className={`h-3.5 w-3.5 shrink-0 ${useKnytDiscount ? 'text-yellow-400' : 'text-slate-500'}`} />
              <div className="flex-1">
                <p className={`text-[11px] font-medium ${useKnytDiscount ? 'text-yellow-300' : 'text-slate-400'}`}>
                  Pay with $KNYT COYN
                </p>
                <p className="text-[9px] text-slate-500">{Math.round(KNYT_COYN_DISCOUNT * 100)}% discount applied</p>
              </div>
              <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                useKnytDiscount ? 'border-yellow-500 bg-yellow-500' : 'border-slate-600'
              }`}>
                {useKnytDiscount && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </button>

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total</span>
              <div className="text-right">
                <span className="text-sm font-bold text-white">${displayTotal.toFixed(2)}</span>
                {useKnytDiscount && (
                  <p className="text-[10px] text-slate-500 line-through">${total.toFixed(2)}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">≈ KNYT</span>
              <span className="text-[10px] text-slate-400">{usdToKnyt(displayTotal).toFixed(2)} KNYT</span>
            </div>

            {/* Checkout each item sequentially */}
            <button
              type="button"
              onClick={() => setCheckoutItem(items[0])}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:from-teal-500 hover:to-cyan-500 transition-all"
            >
              <CreditCard className="h-4 w-4" />
              Checkout
            </button>
            <p className="text-[9px] text-slate-600 text-center">Each item checked out individually</p>
          </div>
        )}
      </div>

      {/* Checkout modal for individual item */}
      {checkoutItem && (
        <ContentPurchaseModal
          open={true}
          onClose={() => setCheckoutItem(null)}
          personaId={personaId}
          contentType={'scroll_still' as ContentType}
          contentId={checkoutItem.id}
          contentTitle={checkoutItem.label}
          contentImage={checkoutItem.thumbUrl}
          priceUsdOverride={checkoutItem.priceUsd}
          baseKnytOverride={usdToKnyt(checkoutItem.priceUsd)}
          onPurchaseComplete={() => {
            onRemove(checkoutItem.id);
            const remaining = items.filter((i) => i.id !== checkoutItem.id);
            setCheckoutItem(remaining[0] ?? null);
          }}
        />
      )}
    </>
  );
}
