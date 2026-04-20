'use client';

import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Crown, Film, Lock, Package, ShoppingCart, Sparkles, User, Zap } from 'lucide-react';
import {
  BUNDLE_PRICING,
  EPISODE_PRICING,
  KNYT_CARDS_PRICING,
  QRIPTO_SUPPLY,
  getKnytDiscountedPrice,
  getPrintFulfillmentMessage,
  KNYT_COYN_DISCOUNT,
  usdToKnyt,
  type BundlePricing,
  type CardsPricing,
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

type BundleView =
  | { kind: 'landing' }
  | { kind: 'bundle-detail'; bundle: BundlePricing }
  | { kind: 'pack-detail'; option: CardsPricing };

function getBundleContentType(bundle: BundlePricing): ContentType {
  if (bundle.isInvestorOnly) return 'season_codex_still';
  switch (bundle.id) {
    case 'bundle-0-2':  return 'bundle_3_still';
    case 'bundle-3-7':  return 'bundle_5_still';
    case 'bundle-8-12': return 'bundle_5_still';
    case 'bundle-full': return 'season_codex_still';
    default:            return 'bundle_3_still';
  }
}

const LAYER_BADGE: Record<string, string> = {
  qripto:          'bg-purple-900/70 text-purple-300 border-purple-700/40',
  'digital-common':'bg-sky-900/70 text-sky-300 border-sky-700/40',
  print:           'bg-amber-900/70 text-amber-300 border-amber-700/40',
  physical:        'bg-amber-900/70 text-amber-300 border-amber-700/40',
};

const LAYER_SHORT: Record<string, string> = {
  qripto: 'Qripto', 'digital-common': 'Digital', print: 'Print', physical: 'Physical',
};

const INVESTOR_SEAL = '/images/metaknyt-logo.png';

const CARD_EPISODE_NUMBERS = Array.from({ length: 13 }, (_, i) => i);

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

function CartButton({
  label,
  onClick,
  className,
}: {
  label?: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className={`flex items-center gap-1 rounded-lg bg-teal-700/80 hover:bg-teal-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors ${className ?? ''}`}
    >
      <ShoppingCart className="h-3 w-3 shrink-0" />
      {label && <span>{label}</span>}
    </button>
  );
}

// ── 4-col bundle grid card — image navigates to detail, cart opens payment ─────

function BundleGridCard({
  bundle,
  thumbUrl,
  isInvestor,
  onClick,
  onBuy,
}: {
  bundle: BundlePricing;
  thumbUrl?: string;
  isInvestor?: boolean;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-slate-900/60 overflow-hidden transition-colors hover:bg-slate-800/60 w-full ${
        isInvestor
          ? 'border-yellow-800/40 hover:border-yellow-600/40'
          : 'border-white/5 hover:border-teal-500/20'
      }`}
    >
      {/* Clickable image area → detail */}
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
          {thumbUrl ? (
            <img src={thumbUrl} alt={bundle.label} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-700">
              <Film className="h-5 w-5" />
            </div>
          )}
          <div className="absolute top-1 right-1 rounded border border-teal-700/40 bg-teal-900/70 px-1 py-0.5 text-[9px] font-bold text-teal-300">
            {bundle.episodes.length} eps
          </div>
          {isInvestor && (
            <div className="absolute top-1 left-1 rounded border border-yellow-700/40 bg-yellow-900/70 px-1 py-0.5 text-[9px] font-bold text-yellow-300">
              INV
            </div>
          )}
          {bundle.isFullSeason && !isInvestor && (
            <div className="absolute top-1 left-1 rounded border border-teal-700/40 bg-teal-900/70 px-1 py-0.5 text-[9px] font-bold text-teal-300">
              Season
            </div>
          )}
        </div>
        <div className="px-1.5 pt-1 pb-0.5">
          <p className="text-xs font-semibold text-white leading-tight">{bundle.label}</p>
          <p className="text-[13px] font-bold text-white">${bundle.digitalPrice}</p>
        </div>
      </button>
      {/* Cart row — only cart button, no outer-button interference */}
      <div className="flex justify-end px-1.5 pb-1.5 pt-0.5">
        <CartButton onClick={onBuy} />
      </div>
    </div>
  );
}

// ── 3-col card pack grid item — image → detail, cart → payment ─────────────────

function CardPackCard({
  option,
  getCharacterThumb,
  onClick,
  onBuy,
}: {
  option: CardsPricing;
  getCharacterThumb: (ep: number) => string | undefined;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
  const badgeClass = LAYER_BADGE[option.layer] ?? LAYER_BADGE['digital-common'];
  const layerLabel = LAYER_SHORT[option.layer] ?? option.layer;
  const previewThumb = [0, 1, 2, 3, 4].map((n) => getCharacterThumb(n)).find(Boolean);

  return (
    <div className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 w-full">
      {/* Clickable image → detail */}
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
          {previewThumb ? (
            <img src={previewThumb} alt={layerLabel} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-700">
              <User className="h-5 w-5" />
            </div>
          )}
          <div className={`absolute top-1 right-1 rounded border px-1 py-0.5 text-[8px] font-bold ${badgeClass}`}>
            {layerLabel}
          </div>
        </div>
        <div className="px-1.5 pt-1 pb-0.5">
          <p className="text-xs font-semibold text-white leading-tight">13 Card Pack</p>
          <p className="text-[8px] text-slate-500">{layerLabel}</p>
          <p className="text-[13px] font-bold text-white">${option.price}</p>
        </div>
      </button>
      {/* Cart row */}
      <div className="flex justify-end px-1.5 pb-1.5 pt-0.5">
        <CartButton onClick={onBuy} />
      </div>
    </div>
  );
}

// ── Bundle detail — 2-col header + full-width episode thumbnail grid ───────────

function BundleDetail({
  bundle,
  getCoverThumb,
  onBuy,
}: {
  bundle: BundlePricing;
  getCoverThumb: (epNum: number) => string | undefined;
  onBuy: () => void;
}) {
  const includedEpisodes = EPISODE_PRICING.filter((ep) => bundle.episodes.includes(ep.episodeNumber));
  const previewThumb = bundle.isInvestorOnly ? INVESTOR_SEAL : getCoverThumb(bundle.episodes[0]);
  const individualTotal = includedEpisodes.reduce((s, ep) => s + ep.digitalPrice, 0);

  return (
    <div className="p-3 space-y-3">
      {/* 2-col: main cover thumb + metadata */}
      <div className="grid grid-cols-2 gap-3 items-start">
        <div>
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-slate-950 border border-white/5">
            {previewThumb ? (
              <img src={previewThumb} alt={bundle.label} className="w-full h-full object-contain" loading="lazy" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Film className="h-8 w-8 text-slate-700" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5 min-w-0">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">
              {bundle.isInvestorOnly ? 'Investor Bundle' : 'Episode Bundle'}
            </p>
            <p className="text-sm font-bold text-white">{bundle.label}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {bundle.isFullSeason && (
                <span className="rounded-full bg-teal-900/40 border border-teal-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-teal-400">
                  Full Season
                </span>
              )}
              {bundle.isInvestorOnly && (
                <span className="rounded-full bg-yellow-900/40 border border-yellow-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-400">
                  Investor Only
                </span>
              )}
              {bundle.isLimited && bundle.limitedSupply && (
                <span className="rounded-full bg-red-900/40 border border-red-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">
                  Limited {bundle.limitedSupply}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">${bundle.digitalPrice}</span>
              <span className="text-[11px] text-slate-400">USD</span>
            </div>
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
            <CartButton label="Add to Cart" onClick={() => onBuy()} className="w-full justify-center mt-1" />
          </div>

          {bundle.accessGrant && (
            <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-2.5 flex items-start gap-1.5">
              <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-yellow-300">Order of Metaiye Access</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Grants Zero KNYT tier on purchase.</p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-2.5 py-2 flex items-start gap-1.5">
            <BookOpen className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[9px] text-amber-300">{getPrintFulfillmentMessage(false)}</p>
          </div>

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

      {/* Full-width episode thumbnail grid */}
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
    </div>
  );
}

// ── Pack detail — 2-col: character grid + metadata ─────────────────────────────

function PackDetail({
  option,
  getCharacterThumb,
  onBuy,
}: {
  option: CardsPricing;
  getCharacterThumb: (ep: number) => string | undefined;
  onBuy: () => void;
}) {
  const layerLabel = LAYER_SHORT[option.layer] ?? option.layer;
  const badgeClass = LAYER_BADGE[option.layer] ?? LAYER_BADGE['digital-common'];
  const isQripto   = option.layer === 'qripto';
  const isPhysical = option.layer === 'physical';

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      {/* Left: 13-card mini grid */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1">
          {CARD_EPISODE_NUMBERS.map((epNum) => {
            const thumb = getCharacterThumb(epNum);
            return (
              <div key={epNum} className="rounded overflow-hidden aspect-[3/4] bg-slate-800 border border-white/5 relative">
                {thumb ? (
                  <img src={thumb} alt={`Card ${epNum}`} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600">
                    <User className="h-3 w-3" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                  <p className="text-[7px] text-slate-300 text-center">#{epNum}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[8px] text-slate-500 text-center">13 cards · {QRIPTO_SUPPLY.toLocaleString()}-unit issuance each</p>
        <div className={`w-full text-center rounded-lg border px-2 py-1 text-[9px] font-semibold ${badgeClass}`}>
          {layerLabel}
        </div>
      </div>

      {/* Right: metadata + pricing */}
      <div className="space-y-2.5 min-w-0">
        <div>
          <p className="text-[9px] text-slate-500 uppercase tracking-wide">KNYT Cards</p>
          <p className="text-sm font-bold text-white">{layerLabel} Pack</p>
          <p className="text-[9px] text-slate-400 mt-0.5">1 pack = all 13 KNYT character cards</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">${option.price}</span>
            <span className="text-[10px] text-slate-400">USD</span>
          </div>
          {!isPhysical && <KnytPricePill basePrice={option.price} />}
          {isPhysical && (
            <p className="text-[9px] text-slate-500">Ships to your address. No $KNYT COYN discount.</p>
          )}
          <CartButton label="Add to Cart" onClick={() => onBuy()} className="w-full justify-center mt-1" />
        </div>

        {isQripto && (
          <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
            <p className="text-[9px] font-semibold text-slate-300">Qripto Rarity</p>
            <p className="text-[8px] text-slate-500 mt-0.5">
              Rarity independently drawn per card from its own {QRIPTO_SUPPLY.toLocaleString()}-unit pool. Random on reveal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

const publicBundles  = BUNDLE_PRICING.filter((b) => !b.isInvestorOnly);
const investorBundles = BUNDLE_PRICING.filter((b) => b.isInvestorOnly);

export function KnytStoreBundlesTab({ personaId, theme: _theme }: Props) {
  const [view, setView]         = useState<BundleView>({ kind: 'landing' });
  const [purchase, setPurchase] = useState<PendingPurchase | null>(null);
  const { getCoverThumb, getCharacterThumb } = useKnytThumbnails();

  const headerLabel =
    view.kind === 'landing'       ? 'Bundles & Cards'
    : view.kind === 'bundle-detail' ? view.bundle.label
    : `${LAYER_SHORT[view.option.layer] ?? view.option.layer} — 13 Cards`;

  function openBundlePurchase(bundle: BundlePricing) {
    setPurchase({
      contentType:      getBundleContentType(bundle),
      contentId:        bundle.id,
      contentTitle:     bundle.label,
      contentImage:     bundle.isInvestorOnly ? INVESTOR_SEAL : getCoverThumb(bundle.episodes[0]),
      priceUsdOverride: bundle.memberPrice ?? bundle.digitalPrice,
    });
  }

  function openPackPurchase(option: CardsPricing) {
    setPurchase({
      contentType:      'character_card',
      contentId:        `cards-pack-${option.layer}`,
      contentTitle:     `13 Card Pack — ${LAYER_SHORT[option.layer] ?? option.layer}`,
      priceUsdOverride: option.price,
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
        <Package className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">{headerLabel}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'landing' && (
          <div className="p-2.5 space-y-4">
            {/* Episode Bundles — 4-col */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Episode Bundles
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {publicBundles.map((bundle) => (
                  <BundleGridCard
                    key={bundle.id}
                    bundle={bundle}
                    thumbUrl={getCoverThumb(bundle.episodes[0])}
                    onClick={() => setView({ kind: 'bundle-detail', bundle })}
                    onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
                  />
                ))}
              </div>
            </div>

            {/* KNYT Cards Packs — 3-col */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                KNYT Cards — 13-Card Packs
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {KNYT_CARDS_PRICING.map((option) => (
                  <CardPackCard
                    key={option.layer}
                    option={option}
                    getCharacterThumb={getCharacterThumb}
                    onClick={() => setView({ kind: 'pack-detail', option })}
                    onBuy={(e) => { e.stopPropagation(); openPackPurchase(option); }}
                  />
                ))}
              </div>
            </div>

            {/* Investor Bundles — 4-col with seal */}
            {investorBundles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-0.5 mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Investor Bundles
                  </p>
                  <Lock className="h-3 w-3 text-yellow-500" />
                </div>
                <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 px-3 py-2 mb-2 flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300">Token-gated. Requires investor access.</p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {investorBundles.map((bundle) => (
                    <BundleGridCard
                      key={bundle.id}
                      bundle={bundle}
                      thumbUrl={INVESTOR_SEAL}
                      isInvestor
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      onBuy={(e) => { e.stopPropagation(); openBundlePurchase(bundle); }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view.kind === 'bundle-detail' && (
          <BundleDetail
            bundle={view.bundle}
            getCoverThumb={getCoverThumb}
            onBuy={() => openBundlePurchase(view.bundle)}
          />
        )}

        {view.kind === 'pack-detail' && (
          <PackDetail
            option={view.option}
            getCharacterThumb={getCharacterThumb}
            onBuy={() => openPackPurchase(view.option)}
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
