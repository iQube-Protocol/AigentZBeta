'use client';

/**
 * ContentPurchaseModal - Multi-rail pricing modal for KNYT Codex content
 *
 * Phase 1 Tier 0: Supports Q¢, KNYT (20% off), USDC, and PayPal payment rails
 * Grants perpetual streaming/in-app access entitlements
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Coins,
  CreditCard,
  Wallet,
  Check,
  Loader2,
  Sparkles,
  ShoppingCart,
  LogIn,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { useEvmKnytPayment } from '@/app/hooks/useEvmKnytPayment';
import { useSupabaseSessionPersonas } from '@/app/hooks/useSupabaseSessionPersonas';
import { bundleIncludesPrintGn } from '@/types/knyt-store';

// Phase 1 Pricing Constants
const KNYT_USD_RATE = 1.40;
const KNYT_DISCOUNT_PERCENT = 0.20;
const FIAT_FEE_PERCENT = 0.03;
const FIAT_PREMIUM_PERCENT = 0.07;
const USDC_FEE_PERCENT = 0.01;
const PREORDER_SHIPPING_USD = 20;
const PREORDER_ID_PREFIX = 'metaKnyts_preorder_';

export type ContentType =
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

// Base prices in KNYT
const CONTENT_PRICES: Record<ContentType, number> = {
  scroll_still: 3,
  scroll_motion: 5,
  character_card: 2,
  character_card_motion: 4,
  bundle_3_still: 8,
  bundle_5_still: 12,
  bundle_3_motion: 12,
  bundle_5_motion: 18,
  season_codex_still: 25,
  season_codex_motion: 40,
};

const CONTENT_LABELS: Record<ContentType, string> = {
  scroll_still: 'Digital Scroll (Still)',
  scroll_motion: 'Motion Comic',
  character_card: 'Character Card',
  character_card_motion: 'Character Card (Motion)',
  bundle_3_still: '3-Scroll Bundle (Stills)',
  bundle_5_still: '5-Scroll Bundle (Stills)',
  bundle_3_motion: '3-Scroll Bundle (Motion)',
  bundle_5_motion: '5-Scroll Bundle (Motion)',
  season_codex_still: 'Season Codex (Stills)',
  season_codex_motion: 'Season Codex (Motion)',
};

type PaymentRail = 'knyt' | 'qcents' | 'usdc' | 'paypal';

interface MultiRailPricing {
  baseKnyt: number;
  usdBase: number;
  rails: {
    knyt: { amount: number; discount: number };
    qcents: { amount: number };
    usdc: { amount: number; fee: number };
    paypal: { amount: number; fee: number };
  };
}

function calculatePricing(baseKnyt: number, extraUsd: number = 0, usdOverride?: number): MultiRailPricing {
  // When usdOverride is provided, lock the USD-rail prices to it (plus any
  // extras like shipping). Otherwise fall back to the static USD/KNYT rate.
  // Used for SKUs like the Satoshi KNYT Collection whose USD price has no
  // discount vs retail and shouldn't be re-derived from the KNYT figure.
  const usdBase = (usdOverride !== undefined ? usdOverride : baseKnyt * KNYT_USD_RATE) + extraUsd;

  return {
    baseKnyt,
    usdBase,
    rails: {
      knyt: {
        amount: baseKnyt * (1 - KNYT_DISCOUNT_PERCENT),
        discount: KNYT_DISCOUNT_PERCENT,
      },
      qcents: {
        amount: usdBase,
      },
      usdc: {
        amount: usdBase * (1 + USDC_FEE_PERCENT),
        fee: USDC_FEE_PERCENT,
      },
      paypal: {
        amount: usdBase * (1 + FIAT_FEE_PERCENT + FIAT_PREMIUM_PERCENT),
        fee: FIAT_FEE_PERCENT + FIAT_PREMIUM_PERCENT,
      },
    },
  };
}

interface ContentPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  personaId?: string;
  onRequestPersona?: (mode: 'signin' | 'signup') => void;
  contentType: ContentType;
  contentId: string;
  contentTitle: string;
  contentImage?: string;
  baseKnytOverride?: number;
  priceUsdOverride?: number;
  /** DVN ledger balance (immediately spendable in-app) */
  knytBalance?: number;
  /** Same as knytBalance — preferred alias passed by KnytTab */
  spendableKnyt?: number;
  /** On-chain EVM KNYT balance — shown to user but requires a bridge to spend in-app */
  evmKnyt?: number;
  /** When provided, override the KNYT price shown for "Still" in the version selector */
  stillPriceKnytOverride?: number;
  /** When provided, override the KNYT price shown for "Motion" in the version selector */
  motionPriceKnytOverride?: number;
  /** When true, hides the Still/Motion version selector (e.g. for print purchases) */
  hideVersionSelector?: boolean;
  /**
   * When the modal is opened from a cart-checkout iteration, pass cart
   * progress / running totals so the user sees they're inside a multi-item
   * flow rather than a one-off purchase. The modal renders a thin amber
   * banner above the body summarising:
   *   "Cart checkout · Item 2 of 3 · Cart total $42.00 (remaining $28.00)"
   * Per-item settlement still happens through the existing single-item
   * flow — Phase 2 will replace this with /api/cart/{quote,complete}.
   */
  cartContext?: {
    itemIndex: number;       // 1-based
    totalItems: number;      // sum of qty across cart
    cartTotalUsd: number;    // total cart value the user is committed to
    remainingUsd?: number;   // sum of the lines not yet settled
    useKnytDiscount?: boolean;
  };
  /**
   * When provided, the modal renders an "Add to Cart" button alongside the
   * Review Purchase CTA. Lets the user defer settlement and aggregate items
   * across the same KNYT cart used by the Store tabs / KnytCardsGrid.
   * Caller is responsible for closing the modal after the cart-add.
   */
  onAddToCart?: () => void;
  onPurchaseComplete?: (entitlementId: string) => void;
  onBalanceRefresh?: () => void;
}

export function ContentPurchaseModal({
  open,
  onClose,
  personaId,
  onRequestPersona,
  contentType,
  contentId,
  contentTitle,
  contentImage,
  baseKnytOverride,
  priceUsdOverride,
  knytBalance = 0,
  spendableKnyt,
  evmKnyt = 0,
  stillPriceKnytOverride,
  motionPriceKnytOverride,
  hideVersionSelector,
  cartContext,
  onAddToCart,
  onPurchaseComplete,
  onBalanceRefresh,
}: ContentPurchaseModalProps) {
  const router = useRouter();
  const effectiveSpendable = spendableKnyt ?? knytBalance;

  // Detect live Supabase session so we don't show "Sign In Required" to a user
  // who is already authenticated but whose personaId hasn't resolved yet (e.g. on first load).
  const { sessionEmail, sessionPersonas } = useSupabaseSessionPersonas();
  const hasSession = !!sessionEmail;
  const resolvedPersonaId = personaId || sessionPersonas[0]?.id;
  const isSignedIn =
    (!!resolvedPersonaId && resolvedPersonaId !== 'default' && resolvedPersonaId !== 'guest') ||
    hasSession;

  const [selectedRail, setSelectedRail] = useState<PaymentRail>('knyt');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ entitlementId: string; amount: number; currency: string; rail: string } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [selectedVersion, setSelectedVersion] = useState<'still' | 'motion'>('still');

  const evmPay = useEvmKnytPayment();

  useEffect(() => {
    if (!open) return;
    if (contentType.includes('motion')) {
      setSelectedVersion('motion');
    } else {
      setSelectedVersion('still');
    }
  }, [contentType, open]);

  const getEffectiveContentType = (): ContentType => {
    if (contentType === 'scroll_still' || contentType === 'scroll_motion') {
      return selectedVersion === 'motion' ? 'scroll_motion' : 'scroll_still';
    }
    if (contentType === 'character_card' || contentType === 'character_card_motion') {
      return selectedVersion === 'motion' ? 'character_card_motion' : 'character_card';
    }
    return contentType;
  };

  const effectiveContentType = getEffectiveContentType();
  // Resolve base KNYT: version-specific overrides take priority over the single baseKnytOverride
  const baseKnyt = selectedVersion === 'motion'
    ? (motionPriceKnytOverride ?? baseKnytOverride ?? CONTENT_PRICES[effectiveContentType])
    : (stillPriceKnytOverride ?? baseKnytOverride ?? CONTENT_PRICES[effectiveContentType]);

  const isPreorder = contentId?.startsWith(PREORDER_ID_PREFIX);
  const shippingUsd = isPreorder ? PREORDER_SHIPPING_USD : 0;

  const baseUsd = priceUsdOverride !== undefined ? priceUsdOverride : baseKnyt * KNYT_USD_RATE;
  const totalUsd = baseUsd + shippingUsd;

  const pricing = calculatePricing(baseKnyt, shippingUsd, priceUsdOverride);

  const canAffordKnyt = effectiveSpendable >= pricing.rails.knyt.amount;
  const canAffordEvmKnyt = evmKnyt >= pricing.rails.knyt.amount;
  // Bundles containing a physical print GN may not be settled via EVM KNYT
  // (operator rule: DVN KNYT is OK, on-chain EVM KNYT is not for these SKUs).
  const evmKnytBlocked = bundleIncludesPrintGn(contentId ?? '');
  // True when user has no DVN KNYT but has sufficient EVM KNYT — triggers MetaMask signing path
  const useEvmPath = selectedRail === 'knyt' && !canAffordKnyt && canAffordEvmKnyt && !evmKnytBlocked;

  const apiBase = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '';

  useEffect(() => {
    if (open) {
      setSelectedRail(canAffordKnyt || (canAffordEvmKnyt && !evmKnytBlocked) ? 'knyt' : 'paypal');
      setError(null);
      setSuccess(null);
      setShowConfirmation(false);
      evmPay.reset();
    }
  // Intentionally only depends on `open`. Including canAffordKnyt /
  // canAffordEvmKnyt would re-fire this reset every time the buyer's
  // balance changes mid-flow — which happens immediately after a
  // successful purchase (onBalanceRefresh updates the parent's balance,
  // affordability recomputes, the reset wipes setSuccess(...) before the
  // success view paints). The 5-second auto-close path runs through
  // onPurchaseComplete instead, so resetting here on balance change is
  // unnecessary AND breaks the confirmation render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePurchase = async (evmTxHash?: string) => {
    setPurchasing(true);
    setError(null);

    try {
      if (selectedRail === 'knyt' && !canAffordKnyt && !evmTxHash) {
        setError('Insufficient KNYT balance');
        setPurchasing(false);
        return;
      }

      if (selectedRail === 'paypal') {
        const amountUSD = pricing.rails.paypal.amount;
        const response = await fetch(`${apiBase}/api/purchase/paypal/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaId: resolvedPersonaId,
            contentType: effectiveContentType,
            contentId,
            contentTitle,
            amount: amountUSD,
            version: selectedVersion,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.approvalUrl) {
          throw new Error(result.error || 'Failed to create PayPal order');
        }

        const popup = window.open(
          result.approvalUrl,
          'PayPal Checkout',
          'width=500,height=700,scrollbars=yes'
        );

        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }

        let popupResolved = false;
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        const cleanup = () => {
          window.removeEventListener('message', messageHandler);
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        };

        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'paypal-success') {
            popupResolved = true;
            cleanup();
            setSuccess({
              entitlementId: event.data.entitlementId || 'paypal-success',
              amount: amountUSD,
              currency: 'USD',
              rail: 'paypal',
            });
            onBalanceRefresh?.();
            setTimeout(() => {
              onPurchaseComplete?.(event.data.purchaseId || 'paypal-success');
            }, 5000);
            setPurchasing(false);
          } else if (event.data.type === 'paypal-error') {
            popupResolved = true;
            cleanup();
            setError('Payment failed: ' + (event.data.error || 'Unknown error'));
            setPurchasing(false);
          } else if (event.data.type === 'paypal-cancelled') {
            popupResolved = true;
            cleanup();
            setError('Payment cancelled');
            setPurchasing(false);
          }
        };

        window.addEventListener('message', messageHandler);

        pollTimer = setInterval(() => {
          if (popup.closed) {
            cleanup();
            if (!popupResolved) {
              setError('Payment window closed');
              setPurchasing(false);
            }
          }
        }, 500);

        return;
      }

      const railMap: Record<PaymentRail, string> = {
        knyt: evmTxHash ? 'knyt_evm' : 'knyt',
        qcents: 'qc',
        usdc: 'usdc',
        paypal: 'paypal',
      };

      const productTypeMap: Record<ContentType, string> = {
        scroll_still: 'knyt_scroll_still',
        scroll_motion: 'knyt_scroll_motion',
        character_card: 'knyt_character_card_still',
        character_card_motion: 'knyt_character_card_motion',
        bundle_3_still: 'knyt_scroll_bundle_still_3',
        bundle_5_still: 'knyt_scroll_bundle_still_5',
        bundle_3_motion: 'knyt_scroll_bundle_motion_3',
        bundle_5_motion: 'knyt_scroll_bundle_motion_5',
        season_codex_still: 'knyt_season_codex_stills',
        season_codex_motion: 'knyt_season_codex_motion',
      };

      // /api/purchase/complete resolves the active persona server-side via
      // the spine's getActivePersona — the personaId field is no longer
      // trusted from the request body (T0 leak / spoof risk). We keep
      // sending it for backwards compatibility with older deployments;
      // newer servers ignore it and read the session.
      const response = await fetch(`${apiBase}/api/purchase/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: resolvedPersonaId,
          productType: productTypeMap[effectiveContentType],
          assetIds: contentId ? [contentId] : [],
          paymentRail: railMap[selectedRail],
          ...(evmTxHash ? { paymentReference: evmTxHash } : {}),
          metadata: {
            amount:
              selectedRail === 'knyt'
                ? pricing.rails.knyt.amount
                : selectedRail === 'qcents'
                ? pricing.rails.qcents.amount
                : selectedRail === 'usdc'
                ? pricing.rails.usdc.amount
                : pricing.rails.paypal.amount,
            currency: selectedRail === 'knyt' ? 'KNYT' : 'USD',
            contentTitle,
            contentImage,
            version: selectedVersion,
            includesAllClips: selectedVersion === 'motion',
          },
        }),
      });

      // Surface a useful message when the server returns an empty body
      // (e.g. a 502 / proxy timeout) instead of a generic JSON parse error.
      const rawBody = await response.text();
      let result: { success?: boolean; error?: string; purchaseId?: string; entitlementId?: string } = {};
      if (rawBody) {
        try {
          result = JSON.parse(rawBody) as typeof result;
        } catch {
          throw new Error(`Server returned non-JSON response (${response.status}): ${rawBody.slice(0, 120)}`);
        }
      } else {
        throw new Error(`Server returned empty response (${response.status} ${response.statusText || 'no status'})`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Purchase failed (${response.status})`);
      }

      const amountPaid =
        selectedRail === 'knyt'
          ? pricing.rails.knyt.amount
          : selectedRail === 'qcents'
          ? pricing.rails.qcents.amount
          : selectedRail === 'usdc'
          ? pricing.rails.usdc.amount
          : pricing.rails.paypal.amount;

      setSuccess({
        entitlementId: result.purchaseId || result.entitlementId || 'success',
        amount: amountPaid,
        currency: selectedRail === 'knyt' ? 'KNYT' : 'USD',
        rail: selectedRail,
      });

      onBalanceRefresh?.();

      setTimeout(() => {
        onPurchaseComplete?.(result.purchaseId || result.entitlementId || 'success');
      }, 5000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchasing(false);
    }
  };

  const handlePersonaAction = (mode: 'signin' | 'signup') => {
    onClose();
    if (onRequestPersona) {
      onRequestPersona(mode);
      return;
    }
    router.push(mode === 'signup' ? '/auth?mode=signup' : '/auth');
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-32 bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
          {contentImage && (
            <img
              src={contentImage}
              alt={contentTitle}
              className="absolute inset-0 w-full h-full object-cover opacity-50"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
          >
            <X className="w-5 h-5 text-white/80" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-xs text-cyan-400 font-medium">{CONTENT_LABELS[effectiveContentType]}</p>
            <h3 className="text-lg font-bold text-white truncate">{contentTitle}</h3>
          </div>
        </div>

        {/* Cart-checkout context banner — only present when this modal was
            opened from a cart-iteration. Tells the user where they are in
            the multi-item flow and what's left to settle. */}
        {cartContext && (
          <div className="border-y border-amber-500/30 bg-amber-500/[0.07] px-4 py-2 flex items-center gap-2">
            <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <div className="flex-1 min-w-0 text-[11px] leading-snug">
              <div className="text-amber-100 font-medium">
                Cart checkout · Item {cartContext.itemIndex} of {cartContext.totalItems}
              </div>
              <div className="text-amber-200/70 mt-0.5 truncate">
                Cart total ${cartContext.cartTotalUsd.toFixed(2)}
                {typeof cartContext.remainingUsd === 'number' && cartContext.remainingUsd !== cartContext.cartTotalUsd && (
                  <> · ${cartContext.remainingUsd.toFixed(2)} remaining</>
                )}
                {cartContext.useKnytDiscount && <> · KNYT 20% applied</>}
              </div>
            </div>
          </div>
        )}

        <div className="p-5 overflow-y-auto">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-white font-medium text-lg">Purchase Complete!</p>
              <p className="text-white/60 text-sm mt-2">
                You now have access to "{contentTitle}"
              </p>

              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-emerald-500/20">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/60">Amount Paid:</span>
                  <span className="text-white font-medium">
                    {success.amount} {success.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Payment Method:</span>
                  <span className="text-white font-medium capitalize">{success.rail}</span>
                </div>
              </div>

              <p className="text-xs text-emerald-400 mt-3">✓ Added to your library</p>
              <p className="text-xs text-white/40 mt-1">Tier 0 - Streaming Access</p>

              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                Done
              </button>
            </div>
          ) : !isSignedIn ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                <LogIn className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Sign In Required</h3>
              <p className="text-white/60 text-sm mb-6">
                Sign in or create an account to purchase content and unlock full Codex access.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handlePersonaAction('signin')}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
                <button
                  onClick={() => handlePersonaAction('signup')}
                  className="px-5 py-2.5 rounded-lg bg-white/10 text-white font-medium flex items-center gap-2 hover:bg-white/20 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </button>
              </div>
            </div>
          ) : isSignedIn && !resolvedPersonaId ? (
            /* Authenticated via Supabase but persona hasn't resolved yet */
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Signed In</h3>
              {sessionEmail && (
                <p className="text-white/60 text-sm mb-2">{sessionEmail}</p>
              )}
              <p className="text-white/50 text-sm mb-6">
                Open Smart Wallet to set up your persona before purchasing.
              </p>
              <button
                onClick={() => handlePersonaAction('signin')}
                className="px-5 py-2.5 rounded-lg bg-purple-500/20 text-purple-300 font-medium hover:bg-purple-500/30 transition-all"
              >
                Open Wallet
              </button>
            </div>
          ) : (
            <>
              {!hideVersionSelector && (contentType === 'scroll_still' ||
                contentType === 'scroll_motion' ||
                contentType === 'character_card' ||
                contentType === 'character_card_motion') && (
                <div className="mb-4">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Select Version</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedVersion('still')}
                      className={`p-3 rounded-xl border transition-all text-center ${
                        selectedVersion === 'still'
                          ? 'border-purple-500/50 bg-purple-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">Still</div>
                      <div className="text-xs text-white/50">
                        {stillPriceKnytOverride ?? CONTENT_PRICES[contentType.includes('character') ? 'character_card' : 'scroll_still']} KNYT
                      </div>
                    </button>
                    <button
                      onClick={() => setSelectedVersion('motion')}
                      className={`p-3 rounded-xl border transition-all text-center ${
                        selectedVersion === 'motion'
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">Motion</div>
                      <div className="text-xs text-white/50">
                        {motionPriceKnytOverride ?? CONTENT_PRICES[contentType.includes('character') ? 'character_card_motion' : 'scroll_motion']} KNYT
                      </div>
                      <div className="text-[10px] text-cyan-400 mt-0.5">All clips included</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Bundle: show Still+Motion included note instead of selector */}
              {(contentType === 'bundle_3_still' ||
                contentType === 'bundle_5_still' ||
                contentType === 'bundle_3_motion' ||
                contentType === 'bundle_5_motion' ||
                contentType === 'season_codex_still' ||
                contentType === 'season_codex_motion') && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-teal-600/30 bg-teal-900/20 px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <p className="text-xs text-teal-300">Bundle includes both Still &amp; Motion formats</p>
                </div>
              )}

              <div className="mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Base Price</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{baseKnyt} KNYT</span>
                    <span className="text-white/40 text-sm ml-2">(${baseUsd.toFixed(2)})</span>
                  </div>
                </div>

                {isPreorder && (
                  <>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white/60 text-sm">Post & Packaging</span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-white">${PREORDER_SHIPPING_USD.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                      <span className="text-white/70 text-sm font-medium">Total</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-white">${totalUsd.toFixed(2)}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-white/50 mt-2">
                      Shipping during presale is Continental US only.
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2 mb-5">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Select Payment Method</p>

                <button
                  onClick={() => setSelectedRail('knyt')}
                  disabled={!canAffordKnyt && !canAffordEvmKnyt}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedRail === 'knyt'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  } ${!canAffordKnyt && !canAffordEvmKnyt ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium flex items-center gap-2">
                        Pay with KNYT
                        <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 rounded font-bold">
                          20% OFF
                        </span>
                        {canAffordEvmKnyt && !canAffordKnyt && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded font-medium flex items-center gap-1">
                            <ExternalLink className="w-2.5 h-2.5" />MetaMask
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/50">
                        {effectiveSpendable > 0 ? (
                          <>Available: {effectiveSpendable.toFixed(2)} KNYT</>
                        ) : canAffordEvmKnyt ? (
                          <span className="text-amber-300/80">
                            {evmKnyt.toFixed(2)} KNYT on-chain · sign with MetaMask
                          </span>
                        ) : evmKnyt > 0 ? (
                          <span className="text-amber-400/50">
                            {evmKnyt.toFixed(2)} on-chain (need {pricing.rails.knyt.amount.toFixed(2)})
                          </span>
                        ) : (
                          <span className="text-white/30">No KNYT balance</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-300 font-bold">{pricing.rails.knyt.amount.toFixed(2)} KNYT</div>
                    <div className="text-xs text-white/50">(${(pricing.rails.knyt.amount * KNYT_USD_RATE).toFixed(2)} USD)</div>
                    <div className="text-xs text-white/40 line-through">{baseKnyt} KNYT</div>
                  </div>
                </button>

                <button
                  onClick={() => setSelectedRail('qcents')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedRail === 'qcents'
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">Pay with Q¢</div>
                      <div className="text-xs text-white/50">No fees</div>
                    </div>
                  </div>
                  <div className="text-cyan-300 font-bold">${pricing.rails.qcents.amount.toFixed(2)}</div>
                </button>

                <button
                  onClick={() => setSelectedRail('usdc')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedRail === 'usdc'
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">Pay with USDC</div>
                      <div className="text-xs text-white/50">1% fee</div>
                    </div>
                  </div>
                  <div className="text-blue-300 font-bold">${pricing.rails.usdc.amount.toFixed(2)}</div>
                </button>

                <button
                  onClick={() => setSelectedRail('paypal')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedRail === 'paypal'
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-medium">Pay with PayPal</div>
                      <div className="text-xs text-white/50">10% fee</div>
                    </div>
                  </div>
                  <div className="text-indigo-300 font-bold">${pricing.rails.paypal.amount.toFixed(2)}</div>
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-xs mb-3 p-2 bg-red-500/10 rounded-lg">{error}</p>
              )}

              {!showConfirmation ? (
                <div className={onAddToCart ? 'flex gap-2' : ''}>
                  <button
                    onClick={() => setShowConfirmation(true)}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Review Purchase
                  </button>
                  {onAddToCart && (
                    <button
                      onClick={onAddToCart}
                      className="px-4 py-3 rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 font-semibold flex items-center justify-center gap-2 hover:bg-cyan-500/20 transition-all whitespace-nowrap"
                      title="Add to cart and keep shopping"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-white font-medium text-sm mb-2">Confirm Purchase</p>
                    <div className="text-xs text-white/70 space-y-1">
                      <p>• {contentTitle}</p>
                      <p>
                        • {pricing.rails[selectedRail].amount.toFixed(2)}{' '}
                        {selectedRail === 'knyt' ? 'KNYT' : 'USD'} via {selectedRail.toUpperCase()}
                      </p>
                      {selectedRail === 'knyt' && !useEvmPath && <p>• Will be deducted from your wallet</p>}
                      {useEvmPath && (
                        <p className="text-blue-300">
                          • MetaMask will request a signature to transfer {pricing.rails.knyt.amount.toFixed(2)} KNYT on-chain
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      disabled={purchasing}
                      className="py-2.5 rounded-lg bg-white/5 text-white/70 font-medium hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (useEvmPath) {
                          setPurchasing(true);
                          setError(null);
                          try {
                            const hash = await evmPay.sendKnyt(pricing.rails.knyt.amount);
                            await handlePurchase(hash);
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : 'MetaMask signing failed';
                            if (!msg.toLowerCase().includes('rejected') && !msg.toLowerCase().includes('denied') && !msg.toLowerCase().includes('user denied')) {
                              setError(msg);
                            }
                            setPurchasing(false);
                          }
                        } else {
                          handlePurchase();
                        }
                      }}
                      disabled={purchasing}
                      className="py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-green-400 transition-all"
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {useEvmPath && evmPay.status === 'waiting' ? 'Awaiting MetaMask...' : 'Processing...'}
                        </>
                      ) : useEvmPath ? (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          Sign with MetaMask
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Confirm Payment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-center text-white/40 text-xs mt-3">
                Tier 0 Access • Perpetual streaming rights
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContentPurchaseModal;
