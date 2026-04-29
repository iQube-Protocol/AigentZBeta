'use client';

import React, { useState } from 'react';
import { ArrowLeft, Crown, Film, Lock, Package, Sparkles, User, Zap } from 'lucide-react';
import {
  BUNDLE_PRICING,
  EPISODE_PRICING,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  usdToKnyt,
  type BundlePricing,
} from '@/types/knyt-store';
import { useKnytThumbnails } from './useKnytThumbnails';
import { ContentPurchaseModal } from '../../content/ContentPurchaseModal';
import type { ContentType } from '../../content/ContentPurchaseModal';

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

function InvestorBundleCard({
  bundle,
  onClick,
  onBuy,
}: {
  bundle: BundlePricing;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-yellow-800/40 bg-slate-900/60 overflow-hidden hover:border-yellow-600/40 hover:bg-slate-800/60 transition-colors w-full">
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
          <img src={INVESTOR_SEAL} alt={bundle.label} className="w-full h-full object-contain" loading="lazy" />
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
              {bundle.limitedSupply} left
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
      <div className="flex justify-end px-1.5 pb-1.5 pt-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onBuy(e); }}
          className="flex items-center gap-1 rounded-lg bg-yellow-700/80 hover:bg-yellow-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors"
        >
          <Crown className="h-3 w-3 shrink-0" />
          <span>Buy</span>
        </button>
      </div>
    </div>
  );
}

function InvestorBundleDetail({
  bundle,
  onBuy,
  getCoverThumb,
  getCharacterThumb,
}: {
  bundle: BundlePricing;
  onBuy: () => void;
  getCoverThumb: (n: number) => string | undefined;
  getCharacterThumb: (n: number) => string | undefined;
}) {
  const includedEpisodes = EPISODE_PRICING.filter((ep) => bundle.episodes.includes(ep.episodeNumber));
  const individualTotal = includedEpisodes.reduce((s, ep) => s + ep.digitalPrice, 0);

  const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
  const heroImage = isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL;

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
            <button
              type="button"
              onClick={onBuy}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-yellow-700/80 hover:bg-yellow-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors mt-1"
            >
              <Crown className="h-3.5 w-3.5 shrink-0" />
              Buy Investor Bundle
            </button>
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
  const [view, setView]         = useState<InvestorView>({ kind: 'landing' });
  const [purchase, setPurchase] = useState<PendingPurchase | null>(null);
  const { getCoverThumb, getCharacterThumb } = useKnytThumbnails();

  const headerLabel =
    view.kind === 'landing' ? 'Investor Bundles' : view.bundle.label;

  function openBundlePurchase(bundle: BundlePricing) {
    const isGnOnly = bundle.episodes.length === 1 && bundle.episodes[0] === -1;
    const image = isGnOnly ? getCoverThumb(-1) ?? INVESTOR_SEAL : INVESTOR_SEAL;
    setPurchase({
      contentType:      'season_codex_still',
      contentId:        bundle.id,
      contentTitle:     bundle.label,
      contentImage:     image,
      priceUsdOverride: bundle.memberPrice ?? bundle.digitalPrice,
    });
  }

  return (
    <div className="flex flex-col h-full">
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
        <Crown className="h-4 w-4 text-yellow-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">{headerLabel}</span>
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
                <div className="grid grid-cols-4 gap-2">
                  {gnInvestorBundles.map((bundle) => (
                    <InvestorBundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Collection bundles — Qripto and Digital mixed */}
            {collectionInvestorBundles.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5">Collection Bundles</p>
                <div className="grid grid-cols-4 gap-2">
                  {collectionInvestorBundles.map((bundle) => (
                    <InvestorBundleCard
                      key={bundle.id}
                      bundle={bundle}
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
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
            getCoverThumb={getCoverThumb}
            getCharacterThumb={getCharacterThumb}
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
          baseKnytOverride={usdToKnyt(purchase.priceUsdOverride)}
        />
      )}
    </div>
  );
}
