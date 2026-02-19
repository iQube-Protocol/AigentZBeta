'use client';

/**
 * ContentPurchaseModal - Multi-rail pricing modal for KNYT Codex content
 *
 * Phase 1 Tier 0: Supports Q¢, KNYT (20% off), USDC, and PayPal payment rails
 * Grants perpetual streaming/in-app access entitlements
 */

import { useEffect, useState } from 'react';
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
} from 'lucide-react';

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

function calculatePricing(baseKnyt: number, extraUsd: number = 0): MultiRailPricing {
  const usdBase = baseKnyt * KNYT_USD_RATE + extraUsd;

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
  knytBalance?: number;
  spendableKnyt?: number;
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
  onPurchaseComplete,
  onBalanceRefresh,
}: ContentPurchaseModalProps) {
  const effectiveSpendable = spendableKnyt ?? knytBalance;
  const isSignedIn = !!personaId && personaId !== 'default' && personaId !== 'guest';

  const [selectedRail, setSelectedRail] = useState<PaymentRail>('knyt');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ entitlementId: string; amount: number; currency: string; rail: string } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [selectedVersion, setSelectedVersion] = useState<'still' | 'motion'>('still');

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
  const baseKnyt = baseKnytOverride ?? CONTENT_PRICES[effectiveContentType];

  const isPreorder = contentId?.startsWith(PREORDER_ID_PREFIX);
  const shippingUsd = isPreorder ? PREORDER_SHIPPING_USD : 0;

  const baseUsd = priceUsdOverride ? priceUsdOverride : baseKnyt * KNYT_USD_RATE;
  const totalUsd = baseUsd + shippingUsd;

  const pricing = priceUsdOverride
    ? calculatePricing(priceUsdOverride / KNYT_USD_RATE, shippingUsd)
    : calculatePricing(baseKnyt, shippingUsd);

  const canAffordKnyt = effectiveSpendable >= pricing.rails.knyt.amount;

  const apiBase = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '';

  useEffect(() => {
    if (open) {
      setSelectedRail(canAffordKnyt ? 'knyt' : 'paypal');
      setError(null);
      setSuccess(null);
      setShowConfirmation(false);
    }
  }, [open, canAffordKnyt]);

  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);

    try {
      if (selectedRail === 'knyt' && !canAffordKnyt) {
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
            personaId,
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

        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'paypal-success') {
            window.removeEventListener('message', messageHandler);
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
            window.removeEventListener('message', messageHandler);
            setError('Payment failed: ' + (event.data.error || 'Unknown error'));
            setPurchasing(false);
          } else if (event.data.type === 'paypal-cancelled') {
            window.removeEventListener('message', messageHandler);
            setError('Payment cancelled');
            setPurchasing(false);
          }
        };

        window.addEventListener('message', messageHandler);

        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer);
            window.removeEventListener('message', messageHandler);
            if (purchasing) {
              setError('Payment window closed');
              setPurchasing(false);
            }
          }
        }, 500);

        return;
      }

      const railMap: Record<PaymentRail, string> = {
        knyt: 'knyt',
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

      const response = await fetch(`${apiBase}/api/purchase/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          productType: productTypeMap[effectiveContentType],
          assetIds: contentId ? [contentId] : [],
          paymentRail: railMap[selectedRail],
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

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Purchase failed');
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
    onRequestPersona?.(mode);
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
              <h3 className="text-lg font-semibold text-white mb-2">Persona Required</h3>
              <p className="text-white/60 text-sm mb-6">
                Connect or create a persona in Smart Wallet to purchase content and track your collection.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handlePersonaAction('signin')}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold flex items-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Connect Persona
                </button>
                <button
                  onClick={() => handlePersonaAction('signup')}
                  className="px-5 py-2.5 rounded-lg bg-white/10 text-white font-medium flex items-center gap-2 hover:bg-white/20 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Persona
                </button>
              </div>
            </div>
          ) : (
            <>
              {(contentType === 'scroll_still' ||
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
                        {CONTENT_PRICES[contentType.includes('character') ? 'character_card' : 'scroll_still']} KNYT
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
                        {CONTENT_PRICES[contentType.includes('character') ? 'character_card_motion' : 'scroll_motion']} KNYT
                      </div>
                      <div className="text-[10px] text-cyan-400 mt-0.5">All clips included</div>
                    </button>
                  </div>
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
                  disabled={!canAffordKnyt}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedRail === 'knyt'
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  } ${!canAffordKnyt ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                      </div>
                      {(effectiveSpendable > 0 || knytBalance > 0) && (
                        <div className="text-xs text-white/50">
                          {effectiveSpendable > 0 ? (
                            <>Spendable: {effectiveSpendable.toFixed(2)} KNYT</>
                          ) : knytBalance > 0 ? (
                            <span className="text-amber-400/70">
                              {knytBalance.toFixed(2)} KNYT on-chain (bridge to spend)
                            </span>
                          ) : null}
                        </div>
                      )}
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
                <button
                  onClick={() => setShowConfirmation(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Review Purchase
                </button>
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
                      {selectedRail === 'knyt' && <p>• Will be deducted from your wallet</p>}
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
                      onClick={handlePurchase}
                      disabled={purchasing}
                      className="py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:from-emerald-400 hover:to-green-400 transition-all"
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
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
