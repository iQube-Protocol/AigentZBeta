'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Film, Lock, Package, Plus, ShoppingCart, Sparkles, User, Zap } from 'lucide-react';
import {
  BUNDLE_PRICING,
  EPISODE_PRICING,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  KNYT_USD_RATE,
  usdToKnyt,
  type BundlePricing,
  type CartItem,
} from '@/types/knyt-store';
import { useEthPrice } from '@/app/hooks/useEthPrice';
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
  /**
   * Admin override — when true, the cohort gate on franchise SKUs is
   * bypassed so admins can see and exercise the buy / purchase flow
   * regardless of campaignCohort. Sourced from TabRenderer (which
   * server-resolves the persona's adminCartridges). Mirrors the same
   * pattern used by other admin-bypass surfaces in the cartridge.
   */
  isAdmin?: boolean;
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
  /** When true, the purchase modal hides the KNYT pay rail. Set on
   *  franchise SKUs whose `noKnytRail` flag is on. */
  disableKnytRail?: boolean;
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
 *
 * Franchise extensions:
 * - `applyHref` (e.g. mailto link) — render an Apply CTA instead of buy/cart.
 *   Used by SKUs flagged `priceOnApplication`.
 * - `canPurchase=false` — render a cohort-locked indicator instead of buy/cart
 *   even when the persona IS a verified investor. Used by franchise SKUs whose
 *   `purchaseCohort` doesn't match the active persona.
 */
function InvestorBuyRow({
  onBuy,
  onAddToCart,
  isVerified,
  applyHref,
  canPurchase = true,
  cohortLockLabel,
}: {
  onBuy: (e: React.MouseEvent) => void;
  onAddToCart?: (e: React.MouseEvent) => void;
  isVerified: boolean;
  applyHref?: string;
  canPurchase?: boolean;
  cohortLockLabel?: string;
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
  if (applyHref) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <a
          href={applyHref}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-lg bg-yellow-700/80 hover:bg-yellow-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors"
          title="Apply for allocation"
        >
          <Crown className="h-3 w-3 shrink-0" />
          <span>Apply</span>
        </a>
      </div>
    );
  }
  if (!canPurchase) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="flex items-center gap-1 rounded-lg border border-yellow-900/40 bg-yellow-950/30 px-2 py-1 text-[10px] text-yellow-700">
          <Lock className="h-2.5 w-2.5 shrink-0" />
          {cohortLockLabel ?? 'Cohort only'}
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
  isZeroKnyt,
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
  /** ZeroKNYT cohort flag — toggled by parent. Used to gate buy buttons
   *  on franchise SKUs (those with purchaseCohort='zero_knyt'). */
  isZeroKnyt?: boolean;
}) {
  // Franchise SKU helpers — `applyHref` populated when the SKU is PoA;
  // `canPurchase` is false when the SKU requires a cohort the persona
  // doesn't hold. Surface a distinct lock label so the operator knows
  // it's a cohort gate, not the generic "investors only" gate.
  const applyHref = bundle.priceOnApplication
    ? `mailto:${bundle.poaEmail ?? 'info@metame.com'}?subject=${encodeURIComponent('Application: ' + bundle.label)}`
    : undefined;
  const cohortRequired = bundle.purchaseCohort;
  const canPurchase = !cohortRequired || (cohortRequired === 'zero_knyt' && !!isZeroKnyt);
  const cohortLockLabel = cohortRequired === 'zero_knyt' ? 'ZeroKNYT cohort' : 'Cohort gated';
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
              {(remainingSupply ?? (bundle.initialClaimed != null
                ? bundle.limitedSupply - bundle.initialClaimed
                : bundle.limitedSupply))} of {bundle.limitedSupply} left
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
            {bundle.priceOnApplication ? (
              <p className="text-[11px] font-bold text-yellow-300">Price on application</p>
            ) : (
              <>
                <p className="text-[13px] font-bold text-yellow-300">${bundle.digitalPrice.toLocaleString()}</p>
                {bundle.retailPrice && bundle.retailPrice !== bundle.digitalPrice && (
                  <p className="text-[10px] text-slate-500 line-through">${bundle.retailPrice.toLocaleString()}</p>
                )}
              </>
            )}
          </div>
        </div>
      </button>
      <div className="px-1.5 pb-1.5 pt-0.5">
        <InvestorBuyRow
          onBuy={onBuy}
          onAddToCart={onAddToCart}
          isVerified={isVerified}
          applyHref={applyHref}
          canPurchase={canPurchase}
          cohortLockLabel={cohortLockLabel}
        />
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
  isZeroKnyt,
}: {
  bundle: BundlePricing;
  onBuy: () => void;
  onAddToCart?: () => void;
  getCoverThumb: (n: number) => string | undefined;
  getCharacterThumb: (n: number) => string | undefined;
  tierImage?: string | null;
  isVerified: boolean;
  isZeroKnyt?: boolean;
}) {
  // Franchise extensions — see InvestorBundleCard for full notes.
  const applyHref = bundle.priceOnApplication
    ? `mailto:${bundle.poaEmail ?? 'info@metame.com'}?subject=${encodeURIComponent('Application: ' + bundle.label)}`
    : undefined;
  const cohortRequired = bundle.purchaseCohort;
  const canPurchase = !cohortRequired || (cohortRequired === 'zero_knyt' && !!isZeroKnyt);
  const cohortLockLabel = cohortRequired === 'zero_knyt' ? 'ZeroKNYT cohort only' : 'Cohort gated';
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
              {bundle.priceOnApplication ? (
                <span className="text-xl font-bold text-yellow-300">Price on application</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-yellow-300">${bundle.digitalPrice.toLocaleString()}</span>
                  {bundle.retailPrice && bundle.retailPrice !== bundle.digitalPrice && (
                    <span className="text-sm text-slate-500 line-through">${bundle.retailPrice.toLocaleString()} retail</span>
                  )}
                  <span className="text-[11px] text-slate-400">USD</span>
                </>
              )}
            </div>
            <p className="text-[10px] font-semibold text-yellow-400">
              {bundle.priceOnApplication ? 'Allocation by application' : 'Investor pricing'}
            </p>
            {bundle.memberPrice && (
              <p className="text-[10px] text-teal-400">
                ${bundle.memberPrice} for {bundle.memberCohort} members
              </p>
            )}
            {/* KNYT pill suppressed when the SKU has no KNYT rail (franchise
                guild SKUs strategic-floor priced) or when it's PoA. */}
            {!bundle.noKnytRail && !bundle.priceOnApplication && (
              <KnytPricePill basePrice={bundle.memberPrice ?? bundle.digitalPrice} />
            )}
            {bundle.digitalPrice < individualTotal && (
              <p className="text-[10px] text-teal-400">
                Save ${(individualTotal - bundle.digitalPrice).toFixed(0)} vs individually
              </p>
            )}
            {isVerified && applyHref ? (
              <a
                href={applyHref}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-yellow-700/80 hover:bg-yellow-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors"
                title="Apply for allocation"
              >
                <Crown className="h-3.5 w-3.5 shrink-0" />
                Apply for allocation
              </a>
            ) : isVerified && !canPurchase ? (
              <div className="flex items-center gap-1.5 mt-1 rounded-lg border border-yellow-900/40 bg-yellow-950/30 px-3 py-1.5">
                <Lock className="h-3.5 w-3.5 text-yellow-700 shrink-0" />
                <span className="text-[11px] text-yellow-700">{cohortLockLabel}</span>
              </div>
            ) : isVerified ? (
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

          {(() => {
            // Investor tab prefers `investorIncludes` when defined so
            // per-surface gates (e.g. "Author Signed available to current
            // ZeroKNYTs ONLY" on the First KNYT bundle) only render here,
            // not on the retail Bundles tab. Falls through to `includes`
            // otherwise.
            const items = bundle.investorIncludes ?? bundle.includes;
            if (!items || items.length === 0) return null;
            return (
              <div>
                <p className="text-[10px] font-semibold text-slate-300 mb-1">Includes</p>
                <div className="space-y-0.5">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[9px] text-slate-300">
                      <span className="text-yellow-400 shrink-0">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
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
// Collection bundles = legacy investor offers (Satoshi, GN tiers without the
// gn-only filter, etc.). Excludes franchise SKUs which render in their own
// section beneath Collection Bundles.
const collectionInvestorBundles = BUNDLE_PRICING.filter((b) =>
  b.isInvestorOnly
    && !(b.episodes.length === 1 && b.episodes[0] === -1)
    && b.category !== 'franchise',
);
const franchiseInvestorBundles  = BUNDLE_PRICING.filter((b) => b.isInvestorOnly && b.category === 'franchise');

export function KnytStoreInvestorTab({ personaId, theme: _theme, isAdmin = false }: Props) {
  const { knytPriceUsd, stale: knytRateStale } = useEthPrice();
  const liveKnytRate = knytPriceUsd > 0 ? knytPriceUsd : KNYT_USD_RATE;
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
  // CRM-investor gating. Hits /api/crm/campaign/investor-status which
  // returns { isInvestor, campaignCohort } so we can render the tab to
  // verified investors only and gate franchise-SKU buy buttons to the
  // ZeroKNYT cohort. While the request is in flight we render as if
  // unverified — better than briefly showing buy buttons to non-investors.
  const [investorStatus, setInvestorStatus] = useState<{
    isInvestor: boolean;
    campaignCohort: string | null;
    loaded: boolean;
  }>({ isInvestor: false, campaignCohort: null, loaded: false });
  useEffect(() => {
    if (!personaId) {
      setInvestorStatus({ isInvestor: false, campaignCohort: null, loaded: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/crm/campaign/investor-status?personaId=${encodeURIComponent(personaId)}`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        setInvestorStatus({
          isInvestor: !!json.isInvestor,
          campaignCohort: typeof json.campaignCohort === 'string' ? json.campaignCohort : null,
          loaded: true,
        });
      } catch {
        if (!cancelled) setInvestorStatus({ isInvestor: false, campaignCohort: null, loaded: true });
      }
    })();
    return () => { cancelled = true; };
  }, [personaId]);
  // Admins are implicitly verified investors so they can exercise the
  // payment flow end-to-end during QA — required by operator instruction
  // 2026-05-27. The investor-status check still runs in parallel for
  // real-investor branches (so admins on the ZeroKNYT cohort still get
  // ZeroKNYT-specific copy).
  const isVerified = investorStatus.isInvestor || isAdmin;
  const isZeroKnyt = investorStatus.campaignCohort === 'zero_knyt' || isAdmin;
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
    // PoA SKUs never open the purchase modal — their card surfaces an
    // Apply CTA (mailto) directly. Defence-in-depth: if a stale Buy
    // handler fires for a PoA SKU, no-op rather than open a modal with
    // misleading pricing.
    if (bundle.priceOnApplication) return;
    const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
    const image = isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL;
    setPurchase({
      contentType:      'season_codex_still',
      contentId:        bundle.id,
      contentTitle:     bundle.label,
      contentImage:     image,
      priceUsdOverride: bundle.memberPrice ?? bundle.digitalPrice,
      baseKnytOverride: bundle.baseKnytOverride,
      disableKnytRail:  !!bundle.noKnytRail,
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
                      isZeroKnyt={isZeroKnyt}
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
                      isZeroKnyt={isZeroKnyt}
                      remainingSupply={supplyMap[bundle.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 21 Sats Franchises — gold-card franchise SKUs. Visible to
                all verified investors; buy buttons gated to ZeroKNYT
                cohort (purchaseCohort='zero_knyt'). PoA SKU shows an
                Apply CTA instead of buy/cart (mailto info@metame.com). */}
            {franchiseInvestorBundles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wide px-0.5">21 Sats Franchises</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {franchiseInvestorBundles.map((bundle) => (
                    <InvestorBundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
                      onAddToCart={bundle.priceOnApplication ? undefined : (e) => { e.stopPropagation(); addBundleToCart(bundle); }}
                      getCoverThumb={getCoverThumb}
                      tierImage={getBundleImage(bundle.id)}
                      isVerified={isVerified}
                      isZeroKnyt={isZeroKnyt}
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
            isZeroKnyt={isZeroKnyt}
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
          baseKnytOverride={purchase.baseKnytOverride ?? usdToKnyt(purchase.priceUsdOverride, liveKnytRate)}
          knytUsdRate={liveKnytRate}
          knytUsdRateIsStale={knytRateStale}
          knytBalance={balance?.dvnKnyt ?? 0}
          spendableKnyt={spendableBalance ?? 0}
          evmKnyt={balance?.evmKnyt ?? 0}
          disableKnytRail={purchase.disableKnytRail}
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
