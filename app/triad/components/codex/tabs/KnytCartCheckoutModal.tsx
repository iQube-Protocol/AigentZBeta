'use client';

/**
 * KnytCartCheckoutModal — multi-item cart settlement.
 *
 * Replaces the per-item iteration the drawer used to do via
 * ContentPurchaseModal. Calls /api/cart/quote on open / rail change to
 * fetch authoritative per-rail totals, then /api/cart/complete on Pay
 * to settle every line in one round-trip.
 *
 * Phase 2c scope: KNYT / Q¢ / USDC. PayPal multi-line is Phase 3
 * (needs /api/cart/paypal/{create-order,capture} so the user only
 * authorises once for the full cart). For now the PayPal rail is
 * shown but disabled with a hint to use express buy from any card.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, ShoppingCart, X, Zap, Check, AlertCircle } from 'lucide-react';
import { type CartItem, getKnytDiscountedPrice, KNYT_COYN_DISCOUNT, usdToKnyt, cartItemCount } from '@/types/knyt-store';

type Rail = 'knyt' | 'qcents' | 'usdc' | 'paypal';

interface QuoteRail {
  total: number;
  currency: string;
  discountPct?: number;
  feePct?: number;
}
interface QuoteResponse {
  ok: true;
  baseTotalUsd: number;
  totalLines: number;
  totalQty: number;
  rails: {
    knyt:   QuoteRail;
    qcents: QuoteRail;
    usdc:   QuoteRail;
    paypal: QuoteRail;
  };
}

interface CompleteLineResult {
  lineIndex: number;
  id: string;
  success: boolean;
  purchaseId?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  personaId?: string;
  /** Called when the cart has been (fully or partially) settled — drawer
      clears cleared lines and shows the user any remaining unsettled lines. */
  onSettled?: (result: {
    settledIds: string[];
    failedIds: string[];
    cartPurchaseId: string;
  }) => void;
  /** Sign-in handler — e.g. opens the SmartWallet drawer. */
  onSignInRequest?: () => void;
}

function lineQty(item: CartItem): number {
  return item.qty && item.qty > 0 ? item.qty : 1;
}

const RAIL_LABEL: Record<Rail, string> = {
  knyt:   'KNYT',
  qcents: 'Q¢',
  usdc:   'USDC',
  paypal: 'PayPal',
};

const RAIL_NOTE: Record<Rail, string> = {
  knyt:   '20% discount applied',
  qcents: 'Base rail',
  usdc:   'Includes processor fee',
  paypal: 'Multi-line PayPal — one authorisation for the whole cart',
};

const PAYPAL_MAX_UNITS = 10;

export function KnytCartCheckoutModal({
  open,
  onClose,
  items,
  personaId,
  onSettled,
  onSignInRequest,
}: Props) {
  const [selectedRail, setSelectedRail] = useState<Rail>('knyt');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [results, setResults] = useState<CompleteLineResult[] | null>(null);
  const [cartPurchaseId, setCartPurchaseId] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  const totalQty = cartItemCount(items);

  const linesPayload = useMemo(
    () =>
      items.map((line) => ({
        id: line.id,
        contentType: line.contentType,
        priceUsd: line.priceUsd,
        qty: lineQty(line),
      })),
    [items],
  );

  // Fetch the quote whenever the cart contents change (and on open).
  const fetchQuote = useCallback(async () => {
    if (linesPayload.length === 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch('/api/cart/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId, lines: linesPayload }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setQuoteError(json.error || `Quote failed (${res.status})`);
        setQuote(null);
        return;
      }
      setQuote(json as QuoteResponse);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Quote failed');
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [linesPayload, personaId]);

  useEffect(() => {
    if (open) void fetchQuote();
  }, [open, fetchQuote]);

  /**
   * Reduce a per-unit results array into per-line settled/failed sets so the
   * drawer can remove only fully-settled lines. A line that had any qty unit
   * fail stays in the cart for retry.
   */
  const partitionResults = useCallback((rs: CompleteLineResult[]): { settledIds: string[]; failedIds: string[] } => {
    const successById = new Map<string, boolean>();
    for (const r of rs) {
      const prev = successById.get(r.id);
      if (prev === false) continue;
      successById.set(r.id, r.success && (prev === undefined || prev === true));
    }
    const settledIds: string[] = [];
    const failedIds: string[] = [];
    for (const [id, ok] of successById.entries()) {
      if (ok) settledIds.push(id);
      else failedIds.push(id);
    }
    return { settledIds, failedIds };
  }, []);

  /**
   * PayPal flow: opens a popup window pointed at /api/cart/paypal/create-order,
   * listens for the postMessage from /api/cart/paypal/return, then surfaces
   * the per-line settlement results in the same UI as the KNYT/Q¢/USDC path.
   */
  const payViaPayPal = useCallback(async () => {
    if (!personaId || items.length === 0) return;
    if (items.length > PAYPAL_MAX_UNITS) {
      setSettleError(
        `PayPal supports at most ${PAYPAL_MAX_UNITS} cart lines per order. This cart has ${items.length}. Pick a different rail or split the cart.`,
      );
      return;
    }
    setPaying(true);
    setSettleError(null);
    try {
      const orderRes = await fetch('/api/cart/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          lines: items.map((line) => ({
            id: line.id,
            contentType: line.contentType,
            label: line.label,
            priceUsd: line.priceUsd,
            qty: lineQty(line),
            thumbUrl: line.thumbUrl,
          })),
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok || !orderJson.approvalUrl) {
        setSettleError(orderJson.error || 'Failed to create PayPal order');
        setPaying(false);
        return;
      }

      const popup = window.open(orderJson.approvalUrl, 'paypal_cart_checkout', 'width=600,height=700');
      if (!popup) {
        setSettleError('Popup blocked — allow popups for this site and retry.');
        setPaying(false);
        return;
      }

      // Listen for the return-handler postMessage. The popup at
      // /api/cart/paypal/return calls window.opener.postMessage with the
      // per-line result, then closes itself.
      const messageHandler = (event: MessageEvent) => {
        const data = event.data as { type?: string; [k: string]: unknown };
        if (!data || typeof data.type !== 'string') return;
        if (!data.type.startsWith('cart-paypal-')) return;

        window.removeEventListener('message', messageHandler);

        if (data.type === 'cart-paypal-error') {
          setSettleError(typeof data.error === 'string' ? data.error : 'PayPal error');
          setPaying(false);
          return;
        }

        const lineResults: CompleteLineResult[] = Array.isArray(data.results)
          ? (data.results as Array<{ id: string; success: boolean; purchaseId?: string; error?: string }>).map(
              (r, idx) => ({
                lineIndex: idx,
                id: r.id,
                success: !!r.success,
                purchaseId: r.purchaseId,
                error: r.error,
              }),
            )
          : [];

        setResults(lineResults);
        setCartPurchaseId((data.cartPurchaseId as string) || '');
        const { settledIds, failedIds } = partitionResults(lineResults);
        onSettled?.({
          settledIds,
          failedIds,
          cartPurchaseId: (data.cartPurchaseId as string) || '',
        });
        setPaying(false);
      };
      window.addEventListener('message', messageHandler);

      // Watchdog: if the popup is closed by the user without sending a message,
      // unwind so the modal isn't stuck on "paying" forever.
      const popupWatchdog = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(popupWatchdog);
          // Give postMessage a brief grace window (chrome can fire close before message).
          window.setTimeout(() => {
            // If pay state is still true, the popup closed without a result.
            // Use the functional setter to read latest state.
            setPaying((stillPaying) => {
              if (stillPaying) {
                window.removeEventListener('message', messageHandler);
                setSettleError('PayPal window closed before completing.');
                return false;
              }
              return stillPaying;
            });
          }, 800);
        }
      }, 500);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : 'PayPal failed');
      setPaying(false);
    }
  }, [items, personaId, onSettled, partitionResults]);

  const pay = useCallback(async () => {
    if (!personaId) {
      onSignInRequest?.();
      return;
    }
    if (items.length === 0) return;
    if (selectedRail === 'paypal') {
      void payViaPayPal();
      return;
    }
    setPaying(true);
    setSettleError(null);
    try {
      const res = await fetch('/api/cart/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          paymentRail: selectedRail,
          lines: items.map((line) => ({
            id: line.id,
            contentType: line.contentType,
            priceUsd: line.priceUsd,
            qty: lineQty(line),
            label: line.label,
            thumbUrl: line.thumbUrl,
          })),
          metadata: {
            source: 'KnytCartCheckoutModal',
          },
        }),
      });
      const json = await res.json();
      if (!res.ok && !json.results) {
        setSettleError(json.error || `Settlement failed (${res.status})`);
        return;
      }

      setResults(json.results as CompleteLineResult[]);
      setCartPurchaseId(json.cartPurchaseId as string);
      const { settledIds, failedIds } = partitionResults(json.results as CompleteLineResult[]);
      onSettled?.({ settledIds, failedIds, cartPurchaseId: json.cartPurchaseId as string });
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setPaying(false);
    }
  }, [items, personaId, selectedRail, onSettled, onSignInRequest, payViaPayPal, partitionResults]);

  if (!open) return null;

  const railTotal = quote
    ? selectedRail === 'knyt'
      ? quote.rails.knyt.total
      : selectedRail === 'qcents'
      ? quote.rails.qcents.total
      : selectedRail === 'usdc'
      ? quote.rails.usdc.total
      : quote.rails.paypal.total
    : null;

  const railCurrency = quote
    ? selectedRail === 'knyt'
      ? 'KNYT'
      : selectedRail === 'qcents'
      ? 'Q¢'
      : selectedRail === 'usdc'
      ? 'USDC'
      : 'USD'
    : '';

  const totalSettled = results?.filter((r) => r.success).length ?? 0;
  const totalFailedRows = results?.filter((r) => !r.success).length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !paying) onClose(); }}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingCart className="h-4 w-4 text-teal-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100">
              {results ? 'Cart checkout — complete' : `Cart checkout · ${totalQty} item${totalQty === 1 ? '' : 's'}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={paying}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Line list */}
          {!results && (
            <div className="space-y-1.5">
              {items.map((line) => {
                const qty = lineQty(line);
                const lineTotal = line.priceUsd * qty;
                return (
                  <div key={line.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-800/40 px-2.5 py-2">
                    {line.thumbUrl && (
                      <img src={line.thumbUrl} alt={line.label} className="h-9 w-7 rounded object-contain bg-slate-900 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white truncate">{line.label}</p>
                      <p className="text-[9px] text-slate-500 capitalize">{line.modality} · {line.layer} · qty {qty}</p>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-200 tabular-nums">${lineTotal.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quote / rail selector */}
          {!results && (
            <>
              {quoteLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading quote…
                </div>
              )}
              {quoteError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{quoteError}</span>
                </div>
              )}

              {quote && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Payment rail</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['knyt', 'qcents', 'usdc', 'paypal'] as Rail[]).map((r) => {
                      // PayPal supports up to 10 cart lines per order. Beyond
                      // that, disable PayPal and steer users to KNYT/Q¢/USDC.
                      const disabled = r === 'paypal' && items.length > PAYPAL_MAX_UNITS;
                      const isSelected = selectedRail === r;
                      const railQuote =
                        r === 'knyt'
                          ? quote.rails.knyt
                          : r === 'qcents'
                          ? quote.rails.qcents
                          : r === 'usdc'
                          ? quote.rails.usdc
                          : quote.rails.paypal;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => !disabled && setSelectedRail(r)}
                          disabled={disabled}
                          className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                            isSelected && !disabled
                              ? 'border-teal-500/50 bg-teal-500/15'
                              : disabled
                              ? 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-[10px] font-semibold text-slate-300">{RAIL_LABEL[r]}</span>
                          <span className="text-sm font-bold text-white tabular-nums">
                            {railQuote.total.toFixed(2)}{' '}
                            <span className="text-[10px] font-normal text-slate-400">{railQuote.currency}</span>
                          </span>
                          <span className="text-[9px] text-slate-500 leading-tight">{RAIL_NOTE[r]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Settlement results */}
          {results && (
            <div className="space-y-2">
              {settleError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{settleError}</span>
                </div>
              )}
              <div
                className={`rounded-lg border px-3 py-2 text-[11px] ${
                  totalFailedRows === 0
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {totalFailedRows === 0 ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      All {totalSettled} units settled.
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5" />
                      {totalSettled} of {totalSettled + totalFailedRows} settled · {totalFailedRows} failed
                    </>
                  )}
                </div>
                {cartPurchaseId && (
                  <div className="text-[9px] font-mono text-slate-500 mt-1 truncate">
                    cart {cartPurchaseId.slice(0, 12)}…
                  </div>
                )}
              </div>
              {totalFailedRows > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Unsettled lines</p>
                  {results.filter((r) => !r.success).map((r, i) => (
                    <div key={`${r.id}-${i}`} className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-2.5 py-1.5 text-[10px] text-rose-200">
                      <div className="font-medium text-rose-100">{r.id}</div>
                      <div className="text-rose-300/80">{r.error}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] px-4 py-3 flex items-center justify-between gap-2">
          {!results ? (
            <>
              <div className="text-[11px] text-slate-400 min-w-0 truncate">
                {!personaId ? (
                  <span className="text-amber-300/80">Sign in required</span>
                ) : railTotal !== null ? (
                  <>
                    <span className="text-slate-300 font-semibold">
                      {railTotal.toFixed(2)} {railCurrency}
                    </span>
                    {selectedRail === 'knyt' && quote && (
                      <span className="text-slate-500"> · ≈${(quote.baseTotalUsd * (1 - KNYT_COYN_DISCOUNT)).toFixed(2)} USD</span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </div>
              {!personaId ? (
                <button
                  type="button"
                  onClick={() => onSignInRequest?.()}
                  disabled={!onSignInRequest}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                >
                  Sign in to checkout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pay}
                  disabled={paying || !quote || (selectedRail === 'paypal' && items.length > PAYPAL_MAX_UNITS)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-500/25 disabled:opacity-40"
                >
                  {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                  Pay
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default KnytCartCheckoutModal;
