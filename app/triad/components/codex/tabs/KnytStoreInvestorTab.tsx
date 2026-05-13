'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Film, Lock, Package, Plus, ShoppingCart, Sparkles, User, Zap } from 'lucide-react';
import {
  BUNDLE_PRICING,
  EPISODE_PRICING,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  usdToKnyt,
  type BundlePricing,
  type CartItem,
} from '@/types/knyt-store';
import { useKnytThumbnails } from './useKnytThumbnails';
import { useBundleImages } from './useBundleImages';
import { useKnytCart } from './useKnytCart';
import { KnytCartDrawer } from './KnytCartDrawer';
import { ContentPurchaseModal } from '../../content/ContentPurchaseModal';
import type { ContentType } from '../../content/ContentPurchaseModal';
import { useKnytBalance } from '@/app/hooks/useKnytBalance';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

interface PendingPurchase {
  contentType: ContentType;
  contentId: string;
  contentTitle: string;
  contentImage?: string;
  priceUsdOverride: number;
  /** Optional explicit KNYT base, set per-SKU when the static USD→KNYT
   *  conversion doesn't reflect the desired token figure (e.g. Satoshi). */
  baseKnytOverride?: number;
}

type InvestorView =
  | { kind: 'landing' }
  | { kind: 'bundle-detail'; bundle: BundlePricing };

const INVESTOR_SEAL = '/images/metaknyt-knight-round.png';

function KnytPricePill({ basePrice }: { basePrice: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-2 py-1">
      <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
      <span className="text-xs text-yellow-300 font-medium">
        ${getKnytDiscountedPrice(basePrice).toFixed(2)} w/ $KNYT COYN
      </span>
      <span className="text-[10px] text-yellow-600">({Math.round(KNYT_COYN_DISCOUNT * 100)}% off)</span>
    </div>
  );
}

/**
 * Adds a small "+ cart" button next to the buy button. When `onAddToCart` is
 * provided, the row renders both. Otherwise it renders just the buy button.
 * When `isVerified` is false, both buttons are replaced with a locked indicator.
 */
function InvestorBuyRow({
  onBuy,
  onAddToCart,
  isVerified,
}: {
  onBuy: (e: React.MouseEvent) => void;
  onAddToCart?: (e: React.MouseEvent) => void;
  isVerified: boolean;
}) {
  if (!isVerified) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="flex items-center gap-1 rounded-lg border border-yellow-900/40 bg-yellow-950/30 px-2 py-1 text-[10px] text-yellow-700">
          <Lock className="h-2.5 w-2.5 shrink-0" />
          Investors only
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 justify-end">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onBuy(e); }}
        className="flex items-center gap-1 rounded-lg bg-yellow-700/80 hover:bg-yellow-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors"
        title="Buy now"
      >
        <Crown className="h-3 w-3 shrink-0" />
        <span>Buy</span>
      </button>
      {onAddToCart && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddToCart(e); }}
          className="flex items-center justify-center rounded-lg bg-yellow-800/80 hover:bg-yellow-700 px-1.5 py-1 text-white transition-colors border border-yellow-900/50"
          title="Add to cart"
        >
          <Plus className="h-3 w-3 shrink-0" />
        </button>
      )}
    </div>
  );
}

function InvestorBundleCard({
  bundle,
  onClick,
  onBuy,
  onAddToCart,
  getCoverThumb,
  tierImage,
  isVerified,
  remainingSupply,
}: {
  bundle: BundlePricing;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
  onAddToCart?: (e: React.MouseEvent) => void;
  getCoverThumb: (n: number) => string | undefined;
  tierImage?: string | null;
  /** Live count of remaining units for limited SKUs, sourced from
   *  /api/wallet/knyt/sku-supply. Falls back to bundle.limitedSupply when
   *  the API hasn't responded yet. Undefined means "use the static field".
   */
  remainingSupply?: number;
  isVerified: boolean;
}) {
  const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
  const cardImage = tierImage ?? (isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL);
  return (
    <div className="flex flex-col rounded-xl border border-yellow-800/40 bg-slate-900/60 overflow-hidden hover:border-yellow-600/40 hover:bg-slate-800/60 transition-colors w-full">
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
          <img src={cardImage} alt={bundle.label} className="w-full h-full object-contain" loading="lazy" />
          {bundle.badgeTier === 'qripto' ? (
            <div className="absolute top-1 left-1 rounded border border-purple-700/40 bg-purple-900/70 px-1 py-0.5 text-[9px] font-bold text-purple-300">
              Qripto
            </div>
          ) : bundle.badgeTier === 'digital' ? (
            <div className="absolute top-1 left-1 rounded border border-sky-700/40 bg-sky-900/70 px-1 py-0.5 text-[9px] font-bold text-sky-300">
              Digital
            </div>
          ) : (
            <div className="absolute top-1 left-1 rounded border border-yellow-700/40 bg-yellow-900/70 px-1 py-0.5 text-[9px] font-bold text-yellow-300">
              INV
            </div>
          )}
          {bundle.isLimited && bundle.limitedSupply && (
            <div className="absolute top-1 right-1 rounded border border-red-700/40 bg-red-900/70 px-1 py-0.5 text-[9px] font-bold text-red-300">
              {(remainingSupply ?? bundle.limitedSupply)} of {bundle.limitedSupply} left
            </div>
          )}
          {bundle.isConditional && (
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 rounded border border-slate-600/40 bg-slate-900/80 py-0.5">
              <Lock className="h-2.5 w-2.5 text-slate-400" />
              <span className="text-[8px] text-slate-400">≥{bundle.conditionalMinOrders} orders</span>
            </div>
          )}
        </div>
        <div className="px-1.5 pt-1 pb-0.5">
          <p className="text-[10px] font-semibold text-white leading-tight">{bundle.label}</p>
          <div className="flex items-baseline gap-1 flex-wrap">
            <p className="text-[13px] font-bold text-yellow-300">${bundle.digitalPrice}</p>
            {bundle.retailPrice && bundle.retailPrice !== bundle.digitalPrice && (
              <p className="text-[10px] text-slate-500 line-through">${bundle.retailPrice}</p>
            )}
          </div>
        </div>
      </button>
      <div className="px-1.5 pb-1.5 pt-0.5">
        <InvestorBuyRow onBuy={onBuy} onAddToCart={onAddToCart} isVerified={isVerified} />
      </div>
    </div>
  );
}

function InvestorBundleDetail({
  bundle,
  onBuy,
  onAddToCart,
  getCoverThumb,
  getCharacterThumb,
  tierImage,
  isVerified,
}: {
  bundle: BundlePricing;
  onBuy: () => void;
  onAddToCart?: () => void;
  getCoverThumb: (n: number) => string | undefined;
  getCharacterThumb: (n: number) => string | undefined;
  tierImage?: string | null;
  isVerified: boolean;
}) {
  const includedEpisodes = EPISODE_PRICING.filter((ep) => bundle.episodes.includes(ep.episodeNumber));
  const individualTotal = includedEpisodes.reduce((s, ep) => s + ep.digitalPrice, 0);

  const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
  const heroImage = tierImage ?? (isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL);

  const hasCharacters = bundle.includes?.some((s) => {
    const l = s.toLowerCase();
    return l.includes('character card') || l.includes('knyt character');
  });
  const cardEpisodes = bundle.episodes.filter((n) => n >= 0);
  const cardThumbs = hasCharacters
    ? cardEpisodes.map((n) => ({ n, thumb: getCharacterThumb(n) })).filter((x) => x.thumb)
    : [];

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 items-start">
        <div className="aspect-[2/3] rounded-xl overflow-hidden bg-slate-950 border border-yellow-800/30">
          <img src={heroImage} alt={bundle.label} className="w-full h-full object-contain" loading="lazy" />
        </div>

        <div className="space-y-2.5 min-w-0">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
              <span className="text-[9px] font-semibold text-yellow-400 uppercase tracking-wide">Investor Bundle</span>
            </div>
            <p className="text-sm font-bold text-white">{bundle.label}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {bundle.badgeTier === 'qripto' && (
                <span className="rounded-full bg-purple-900/40 border border-purple-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-purple-400">
                  Qripto Edition
                </span>
              )}
              {bundle.badgeTier === 'digital' && (
                <span className="rounded-full bg-sky-900/40 border border-sky-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400">
                  Digital Edition
                </span>
              )}
              {bundle.isLimited && bundle.limitedSupply && (
                <span className="rounded-full bg-red-900/40 border border-red-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">
                  Limited {bundle.limitedSupply}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 p-3 space-y-1.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-yellow-300">${bundle.digitalPrice}</span>
              {bundle.retailPrice && bundle.retailPrice !== bundle.digitalPrice && (
                <span className="text-sm text-slate-500 line-through">${bundle.retailPrice} retail</span>
              )}
              <span className="text-[11px] text-slate-400">USD</span>
            </div>
            <p className="text-[10px] font-semibold text-yellow-400">Investor pricing</p>
            {bundle.memberPrice && (
              <p className="text-[10px] text-teal-400">
                ${bundle.memberPrice} for {bundle.memberCohort} members
              </p>
            )}
            <KnytPricePill basePrice={bundle.memberPrice ?? bundle.digitalPrice} />
            {bundle.digitalPrice < individualTotal && (
              <p className="text-[10px] text-teal-400">
                Save ${(individualTotal - bundle.digitalPrice).toFixed(0)} vs individually
              </p>
            )}
            {isVerified ? (
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={onBuy}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-yellow-700/80 hover:bg-yellow-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
                  title="Buy now"
                >
                  <Crown className="h-3.5 w-3.5 shrink-0" />
                  Buy Investor Bundle
                </button>
                {onAddToCart && (
                  <button
                    type="button"
                    onClick={onAddToCart}
                    className="flex items-center justify-center rounded-lg bg-yellow-800/80 hover:bg-yellow-700 px-2 py-1.5 text-white transition-colors border border-yellow-900/50"
                    title="Add to cart"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1 rounded-lg border border-yellow-900/40 bg-yellow-950/30 px-3 py-1.5">
                <Lock className="h-3.5 w-3.5 text-yellow-700 shrink-0" />
                <span className="text-[11px] text-yellow-700">CRM-verified investors only</span>
              </div>
            )}
          </div>

          {bundle.isConditional && (
            <div className="rounded-xl border border-slate-600/40 bg-slate-800/60 p-2.5 flex items-start gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-slate-300">Conditionally Available</p>
                <p className="text-[9px] text-slate-400 mt-0.5">{bundle.conditionalNote}</p>
              </div>
            </div>
          )}

          {bundle.accessGrant && (
            <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-2.5 flex items-start gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-yellow-300">Order of Metaiye Access</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Grants Zero KNYT tier on purchase.</p>
              </div>
            </div>
          )}

          {bundle.includes && bundle.includes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-300 mb-1">Includes</p>
              <div className="space-y-0.5">
                {bundle.includes.map((item, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-slate-300">
                    <span className="text-yellow-400 shrink-0">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-width episode thumbnail grid — skip for single-GN bundles (hero image already shows it) */}
      {!isGnOnly && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Episodes included ({includedEpisodes.length})
          </p>
          <div className="grid grid-cols-5 gap-1">
            {includedEpisodes.map((ep) => {
              const thumb = getCoverThumb(ep.episodeNumber);
              return (
                <div key={ep.episodeNumber} className="flex flex-col rounded overflow-hidden border border-white/5 bg-slate-900/60">
                  <div className="aspect-[2/3] bg-slate-950 overflow-hidden">
                    {thumb ? (
                      <img src={thumb} alt={`Ep ${ep.episodeNumber}`} className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Film className="h-3 w-3 text-slate-700" />
                      </div>
                    )}
                  </div>
                  <p className="text-[7px] text-slate-400 text-center py-0.5 leading-none">
                    {ep.episodeNumber === -1 ? 'GN' : `Ep ${ep.episodeNumber}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Character card thumbnail grid */}
      {cardThumbs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <User className="h-3 w-3" />
            KNYT Character Cards ({cardEpisodes.length})
          </p>
          <div className="grid grid-cols-7 gap-1">
            {cardThumbs.map(({ n, thumb }) => (
              <div key={n} className="flex flex-col rounded overflow-hidden border border-white/5 bg-slate-900/60">
                <div className="aspect-[3/4] bg-slate-950 overflow-hidden">
                  <img src={thumb!} alt={`Card ${n}`} className="w-full h-full object-contain" loading="lazy" />
                </div>
                <p className="text-[7px] text-slate-400 text-center py-0.5 leading-none">#{n}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const gnInvestorBundles         = BUNDLE_PRICING.filter((b) => b.isInvestorOnly && b.episodes.length === 1 && b.episodes[0] === -1);
const collectionInvestorBundles = BUNDLE_PRICING.filter((b) => b.isInvestorOnly && !(b.episodes.length === 1 && b.episodes[0] === -1));

export function KnytStoreInvestorTab({ personaId, theme: _theme }: Props) {
  // DVN KNYT balance for the active persona — feeds the ContentPurchaseModal's
  // Pay-with-KNYT affordance. Without this prop the modal renders "No KNYT
  // balance" disabled, even when the persona has a credited DVN balance.
  const { balance, spendableBalance, refreshBalance } = useKnytBalance(personaId);

  // Live remaining-supply per limited bundle. Sourced from /sku-supply so
  // the "N left" badge decrements as units sell. Refreshed on mount + after
  // every successful purchase via refreshSupply().
  const limitedBundleIds = useMemo(
    () => BUNDLE_PRICING.filter((b) => b.isLimited && b.limitedSupply).map((b) => b.id),
    [],
  );
  const [supplyMap, setSupplyMap] = useState<Record<string, number>>({});
  const refreshSupply = useCallback(async () => {
    if (limitedBundleIds.length === 0) return;
    try {
      const res = await fetch(`/api/wallet/knyt/sku-supply?ids=${limitedBundleIds.join(',')}`);
      if (!res.ok) return;
      const json = await res.json() as { supply: Record<string, { remaining: number | null }> };
      const next: Record<string, number> = {};
      for (const [id, row] of Object.entries(json.supply ?? {})) {
        if (typeof row?.remaining === 'number') next[id] = row.remaining;
      }
      setSupplyMap(next);
    } catch { /* non-fatal — falls back to static limitedSupply */ }
  }, [limitedBundleIds]);
  useEffect(() => { void refreshSupply(); }, [refreshSupply]);
  const [view, setView]         = useState<InvestorView>({ kind: 'landing' });
  const [purchase, setPurchase] = useState<PendingPurchase | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Purchase access mirrors the retail store: anyone reaching this tab can
  // purchase at investor pricing. The investor offers themselves are the
  // discount; further entitlement enforcement lives at the cart/checkout layer.
  const isVerified = true;
  const { getCoverThumb, getCharacterThumb } = useKnytThumbnails();
  const { getBundleImage } = useBundleImages();
  const cart = useKnytCart();

  const detailLabel = view.kind === 'bundle-detail' ? view.bundle.label : null;

  function addBundleToCart(bundle: BundlePricing) {
    const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
    const image = isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL;
    const item: CartItem = {
      id:          bundle.id,
      label:       bundle.label,
      modality:    'bundle',
      layer:       'digital',
      priceUsd:    bundle.memberPrice ?? bundle.digitalPrice,
      thumbUrl:    image,
      contentType: 'season_codex_still',  // mirrors openBundlePurchase below
      // Forward per-SKU KNYT base when present (e.g. Satoshi 1800 KNYT)
      // so the /api/cart/quote KNYT-rail price matches what
      // ContentPurchaseModal shows for the same bundle.
      baseKnytOverride: bundle.baseKnytOverride,
    };
    cart.addToCart(item);
    setCartOpen(true);
  }

  function openBundlePurchase(bundle: BundlePricing) {
    const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
    const image = isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL;
    setPurchase({
      contentType:      'season_codex_still',
      contentId:        bundle.id,
      contentTitle:     bundle.label,
      contentImage:     image,
      priceUsdOverride: bundle.memberPrice ?? bundle.digitalPrice,
      baseKnytOverride: bundle.baseKnytOverride,
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar — always visible so the cart badge persists.
          Back button is conditional on a sub-view being open. */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        {view.kind !== 'landing' && (
          <button
            type="button"
            onClick={() => setView({ kind: 'landing' })}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {detailLabel && (
          <span className="text-sm font-semibold text-slate-200 min-w-0 truncate">{detailLabel}</span>
        )}
        {/* Cart badge — right-aligned */}
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="ml-auto relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Open cart"
        >
          <ShoppingCart className="h-4 w-4" />
          {cart.count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-teal-500 text-[8px] font-bold text-white flex items-center justify-center">
              {cart.count}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'landing' && (
          <div className="p-2.5 space-y-4">
            <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 px-3 py-2.5 flex items-start gap-2">
              <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-yellow-300 mb-0.5">Investor-priced bundles</p>
                <p className="text-[10px] text-slate-400">
                  Qripto and digital editions, character cards, print variants, and Order of Metaiye access at exclusive investor prices.
                </p>
              </div>
            </div>

            {/* Graphic Novel investor editions */}
            {gnInvestorBundles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5">Graphic Novel — 20% off retail</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {gnInvestorBundles.map((bundle) => (
                    <InvestorBundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
                      onAddToCart={(e) => { e.stopPropagation(); addBundleToCart(bundle); }}
                      getCoverThumb={getCoverThumb}
                      tierImage={getBundleImage(bundle.id)}
                      isVerified={isVerified}
                      remainingSupply={supplyMap[bundle.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Collection bundles — Qripto and Digital mixed */}
            {collectionInvestorBundles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5">Collection Bundles</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {collectionInvestorBundles.map((bundle) => (
                    <InvestorBundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
                      onAddToCart={(e) => { e.stopPropagation(); addBundleToCart(bundle); }}
                      getCoverThumb={getCoverThumb}
                      tierImage={getBundleImage(bundle.id)}
                      isVerified={isVerified}
                      remainingSupply={supplyMap[bundle.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-700/40 bg-slate-800/40 px-3 py-2.5 flex items-start gap-2">
              <Package className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-slate-400">
                  Print fulfillment occurs post-Kickstarter for most bundles. Author-signed editions require bespoke fulfilment scheduling.
                </p>
              </div>
            </div>
          </div>
        )}

        {view.kind === 'bundle-detail' && (
          <InvestorBundleDetail
            bundle={view.bundle}
            onBuy={() => openBundlePurchase(view.bundle)}
            onAddToCart={() => addBundleToCart(view.bundle)}
            getCoverThumb={getCoverThumb}
            getCharacterThumb={getCharacterThumb}
            tierImage={getBundleImage(view.bundle.id)}
            isVerified={isVerified}
          />
        )}
      </div>

      {purchase && (
        <ContentPurchaseModal
          open={true}
          onClose={() => setPurchase(null)}
          personaId={personaId}
          contentType={purchase.contentType}
          contentId={purchase.contentId}
          contentTitle={purchase.contentTitle}
          contentImage={purchase.contentImage}
          priceUsdOverride={purchase.priceUsdOverride}
          baseKnytOverride={purchase.baseKnytOverride ?? usdToKnyt(purchase.priceUsdOverride)}
          knytBalance={balance?.dvnKnyt ?? 0}
          spendableKnyt={spendableBalance ?? 0}
          evmKnyt={balance?.evmKnyt ?? 0}
          onBalanceRefresh={() => refreshBalance()}
          onPurchaseComplete={() => {
            setPurchase(null);
            void refreshBalance();
            void refreshSupply();
          }}
        />
      )}

      {/* Cart drawer */}
      <KnytCartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        onRemove={cart.removeFromCart}
        onSetQty={cart.setQty}
        onClearCart={cart.clearCart}
        personaId={personaId}
        total={cart.total}
        totalWithKnyt={cart.totalWithKnyt}
      />
    </div>
  );
}
