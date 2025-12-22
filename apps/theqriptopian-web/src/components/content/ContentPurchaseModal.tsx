/**
 * ContentPurchaseModal - Multi-rail pricing modal for KNYT Codex content
 * 
 * Phase 1 Tier 0: Supports Q¢, KNYT (20% off), USDC, and PayPal payment rails
 * Grants perpetual streaming/in-app access entitlements
 */

import React, { useState, useEffect } from 'react';
import { X, Coins, CreditCard, Wallet, Check, Loader2, Sparkles } from 'lucide-react';

// Phase 1 Pricing Constants
const KNYT_USD_RATE = 1.40;
const KNYT_DISCOUNT_PERCENT = 0.20;
const FIAT_FEE_PERCENT = 0.03;
const FIAT_PREMIUM_PERCENT = 0.07;
const USDC_FEE_PERCENT = 0.01;

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

function calculatePricing(baseKnyt: number): MultiRailPricing {
  const usdBase = baseKnyt * KNYT_USD_RATE;
  
  return {
    baseKnyt,
    usdBase,
    rails: {
      knyt: {
        amount: baseKnyt * (1 - KNYT_DISCOUNT_PERCENT),
        discount: KNYT_DISCOUNT_PERCENT,
      },
      qcents: {
        amount: usdBase, // Q¢ = USD at par
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
  personaId: string;
  contentType: ContentType;
  contentId: string;
  contentTitle: string;
  contentImage?: string;
  knytBalance?: number;      // Total KNYT balance (DVN + EVM)
  spendableKnyt?: number;    // DVN balance only (Tier 0 spendable)
  onPurchaseComplete?: (entitlementId: string) => void;
  onBalanceRefresh?: () => void;  // Callback to refresh balance after purchase
}

export function ContentPurchaseModal({
  open,
  onClose,
  personaId,
  contentType,
  contentId,
  contentTitle,
  contentImage,
  knytBalance = 0,
  spendableKnyt,
  onPurchaseComplete,
  onBalanceRefresh,
}: ContentPurchaseModalProps) {
  // Use spendableKnyt if provided, otherwise fall back to knytBalance
  const effectiveSpendable = spendableKnyt ?? knytBalance;
  const [selectedRail, setSelectedRail] = useState<PaymentRail>('knyt');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ entitlementId: string } | null>(null);
  
  // Version selector: Still vs Motion
  const [selectedVersion, setSelectedVersion] = useState<'still' | 'motion'>('still');
  
  // Determine effective content type based on version selection
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
  const baseKnyt = CONTENT_PRICES[effectiveContentType];
  const pricing = calculatePricing(baseKnyt);
  const canAffordKnyt = effectiveSpendable >= pricing.rails.knyt.amount;

  // Use relative path - Vite proxy forwards /api to Next.js backend
  const apiBase = '';

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedRail(canAffordKnyt ? 'knyt' : 'paypal');
      setError(null);
      setSuccess(null);
    }
  }, [open, canAffordKnyt]);

  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);

    try {
      // Map frontend rail names to API expected values
      const railMap: Record<PaymentRail, string> = {
        knyt: 'knyt',
        qcents: 'qc',  // API expects 'qc' not 'qcents'
        usdc: 'usdc',
        paypal: 'paypal',
      };
      
      // Map frontend content types to database product types (add knyt_ prefix)
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
            amount: selectedRail === 'knyt' 
              ? pricing.rails.knyt.amount 
              : selectedRail === 'qcents'
              ? pricing.rails.qcents.amount
              : selectedRail === 'usdc'
              ? pricing.rails.usdc.amount
              : pricing.rails.paypal.amount,
            currency: selectedRail === 'knyt' ? 'KNYT' : 'USD',
            contentTitle,
            version: selectedVersion,
            includesAllClips: selectedVersion === 'motion',
          },
        }),
      });

      const result = await response.json();
      console.log('[ContentPurchaseModal] Purchase result:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Purchase failed');
      }

      // API returns purchaseId, not entitlementId
      setSuccess({ entitlementId: result.purchaseId || result.entitlementId || 'success' });
      onPurchaseComplete?.(result.purchaseId || result.entitlementId || 'success');
      // Refresh balance after successful purchase
      onBalanceRefresh?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPurchasing(false);
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md mx-4 overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header with content preview */}
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

        <div className="p-5">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-white font-medium text-lg">Purchase Complete!</p>
              <p className="text-white/60 text-sm mt-2">
                You now have access to "{contentTitle}"
              </p>
              <p className="text-xs text-white/40 mt-1">Tier 0 - Streaming Access</p>
              <button 
                onClick={onClose} 
                className="mt-6 px-6 py-2.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Version selector: Still vs Motion */}
              {(contentType === 'scroll_still' || contentType === 'scroll_motion' || 
                contentType === 'character_card' || contentType === 'character_card_motion') && (
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
                      <div className="text-xs text-white/50">{CONTENT_PRICES[contentType.includes('character') ? 'character_card' : 'scroll_still']} KNYT</div>
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
                      <div className="text-xs text-white/50">{CONTENT_PRICES[contentType.includes('character') ? 'character_card_motion' : 'scroll_motion']} KNYT</div>
                      <div className="text-[10px] text-cyan-400 mt-0.5">All clips included</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Price summary */}
              <div className="mb-5 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Base Price</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white">{baseKnyt} KNYT</span>
                    <span className="text-white/40 text-sm ml-2">(${pricing.usdBase.toFixed(2)})</span>
                  </div>
                </div>
              </div>

              {/* Payment rail selection */}
              <div className="space-y-2 mb-5">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Select Payment Method</p>
                
                {/* KNYT Rail - Best Value */}
                <button
                  onClick={() => setSelectedRail('knyt')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedRail === 'knyt' 
                      ? 'border-amber-500/50 bg-amber-500/10' 
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
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
                    <div className="text-xs text-white/40 line-through">{baseKnyt} KNYT</div>
                  </div>
                </button>

                {/* Q¢ Rail */}
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

                {/* USDC Rail */}
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

                {/* PayPal Rail */}
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

              {/* Purchase button */}
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 transition-all"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {selectedRail === 'knyt' 
                      ? `Pay ${pricing.rails.knyt.amount.toFixed(2)} KNYT`
                      : selectedRail === 'qcents'
                      ? `Pay $${pricing.rails.qcents.amount.toFixed(2)} Q¢`
                      : selectedRail === 'usdc'
                      ? `Pay $${pricing.rails.usdc.amount.toFixed(2)} USDC`
                      : `Pay $${pricing.rails.paypal.amount.toFixed(2)} via PayPal`
                    }
                  </>
                )}
              </button>

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
