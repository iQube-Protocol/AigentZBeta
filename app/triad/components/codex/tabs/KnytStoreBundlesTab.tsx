'use client';

import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Crown, Film, Lock, Package, Sparkles, Zap } from 'lucide-react';
import {
  BUNDLE_PRICING,
  GRAPHIC_NOVEL_PRICING,
  EPISODE_PRICING,
  getKnytDiscountedPrice,
  getPrintFulfillmentMessage,
  KNYT_COYN_DISCOUNT,
  type BundlePricing,
  type GraphicNovelPricing,
} from '@/types/knyt-store';
import { useKnytThumbnails } from './useKnytThumbnails';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type BundleView =
  | { kind: 'landing' }
  | { kind: 'bundle-detail'; bundle: BundlePricing }
  | { kind: 'gn-detail'; option: GraphicNovelPricing };

function KnytPricePill({ basePrice }: { basePrice: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-2.5 py-1">
      <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
      <span className="text-xs text-yellow-300 font-medium">
        ${getKnytDiscountedPrice(basePrice).toFixed(2)} with $KNYT COYN
      </span>
      <span className="text-[10px] text-yellow-600">({Math.round(KNYT_COYN_DISCOUNT * 100)}% off)</span>
    </div>
  );
}

function BundleDetail({
  bundle,
  onBack: _onBack,
  getCoverThumb,
}: {
  bundle: BundlePricing;
  onBack: () => void;
  getCoverThumb: (epNum: number) => string | undefined;
}) {
  const includedEpisodes = EPISODE_PRICING.filter((ep) => bundle.episodes.includes(ep.episodeNumber));
  // Cover thumbnails for included episodes (max 6 shown)
  const thumbs = includedEpisodes
    .slice(0, 6)
    .map((ep) => ({ epNum: ep.episodeNumber, url: getCoverThumb(ep.episodeNumber) }))
    .filter((t) => t.url) as { epNum: number; url: string }[];

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{bundle.isInvestorOnly ? 'Investor Bundle' : 'Episode Bundle'}</p>
        <h2 className="text-xl font-bold text-white">{bundle.label}</h2>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {bundle.isFullSeason && (
            <span className="rounded-full bg-teal-900/40 border border-teal-700/40 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
              Full Season
            </span>
          )}
          {bundle.isInvestorOnly && (
            <span className="rounded-full bg-yellow-900/40 border border-yellow-700/40 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
              Investor Only
            </span>
          )}
          {bundle.isLimited && bundle.limitedSupply && (
            <span className="rounded-full bg-red-900/40 border border-red-700/40 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              Limited — {bundle.limitedSupply} units
            </span>
          )}
        </div>
      </div>

      {/* Episode cover thumbnail strip */}
      {thumbs.length > 0 && (
        <div className="flex gap-1.5 overflow-hidden rounded-xl">
          {thumbs.map(({ epNum, url }) => (
            <div key={epNum} className="flex-1 aspect-[3/4] min-w-0 overflow-hidden rounded-lg bg-slate-800">
              <img src={url} alt={`Ep ${epNum}`} className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
          {includedEpisodes.length > 6 && (
            <div className="flex-1 min-w-0 aspect-[3/4] rounded-lg bg-slate-800/80 flex items-center justify-center border border-white/5">
              <span className="text-[10px] font-semibold text-slate-400">+{includedEpisodes.length - 6}</span>
            </div>
          )}
        </div>
      )}

      {/* Pricing */}
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-white">${bundle.digitalPrice}</span>
          <span className="text-sm text-slate-400 mb-0.5">USD</span>
        </div>
        <KnytPricePill basePrice={bundle.digitalPrice} />
        <div className="flex items-start gap-2 rounded-lg border border-amber-800/30 bg-amber-900/10 px-3 py-2 mt-2">
          <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">{getPrintFulfillmentMessage(false)}</p>
        </div>
      </div>

      {/* Investor includes list */}
      {bundle.includes && bundle.includes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-300 mb-2">What's Included</p>
          <div className="space-y-1">
            {bundle.includes.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-yellow-400 shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bundle.accessGrant && (
        <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-3 flex items-start gap-2">
          <Crown className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-yellow-300">Order of Metaiye Access</p>
            <p className="text-xs text-slate-400 mt-0.5">Grants instant Zero KNYT tier access upon purchase.</p>
          </div>
        </div>
      )}

      {/* Included episodes */}
      <div>
        <p className="text-xs font-semibold text-slate-300 mb-2">Included Episodes</p>
        <div className="space-y-1">
          {includedEpisodes.map((ep) => (
            <div key={ep.episodeNumber} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2">
              <span className="text-xs text-slate-300">Episode {ep.episodeNumber}</span>
              <span className="text-xs text-slate-500">${ep.digitalPrice} individually</span>
            </div>
          ))}
        </div>
        {bundle.digitalPrice < includedEpisodes.reduce((s, ep) => s + ep.digitalPrice, 0) && (
          <p className="text-xs text-teal-400 mt-2">
            Save ${(includedEpisodes.reduce((s, ep) => s + ep.digitalPrice, 0) - bundle.digitalPrice).toFixed(0)} vs buying individually
          </p>
        )}
      </div>

      {/* Provenance entry */}
      <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 flex items-start gap-2">
        <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-slate-300">Print Provenance</p>
          <p className="text-xs text-slate-500 mt-0.5">Print bundle recipients can register provenance records after fulfillment.</p>
          <button type="button" className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
            Register provenance after delivery →
          </button>
        </div>
      </div>
    </div>
  );
}

function GnDetail({
  option,
  onBack: _onBack,
  gnThumbUrl,
}: {
  option: GraphicNovelPricing;
  onBack: () => void;
  gnThumbUrl?: string;
}) {
  const isPrint  = option.layer === 'print';
  const isQripto = option.layer === 'qripto';

  return (
    <div className="p-4 space-y-5">
      {/* GN cover thumbnail hero */}
      {gnThumbUrl && (
        <div className="rounded-xl overflow-hidden aspect-[3/4] max-h-56 bg-slate-800 relative">
          <img src={gnThumbUrl} alt="Graphic Novel cover" className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
            <p className="text-xs font-bold text-white">metaKnyt</p>
            <p className="text-[10px] text-slate-300">{option.label}</p>
          </div>
        </div>
      )}

      {!gnThumbUrl && (
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Graphic Novel</p>
          <h2 className="text-xl font-bold text-white">metaKnyt — {option.label}</h2>
        </div>
      )}

      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-white">${option.price}</span>
          <span className="text-sm text-slate-400 mb-0.5">USD</span>
        </div>
        {!isPrint && <KnytPricePill basePrice={option.price} />}
        {isPrint && (
          <p className="text-xs text-slate-500">Print edition — fulfillment via publisher or campaign. Not eligible for $KNYT COYN discount.</p>
        )}
      </div>

      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-4">
          <p className="text-sm font-semibold text-purple-300 mb-1">Qripto Edition</p>
          <p className="text-xs text-slate-400">
            Collectible digital Graphic Novel with Qripto rarity. 1,860 total supply. Rarity randomly assigned — Legendary, Epic, Rare, or hidden Black Edition.
          </p>
        </div>
      )}

      {isPrint && option.amazonUrl && (
        <a
          href={option.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-amber-700/40 bg-amber-900/10 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-800/20 transition-colors"
        >
          <BookOpen className="h-4 w-4" /> Buy on Amazon
        </a>
      )}

      {isPrint && (
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 flex items-start gap-2">
          <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-300">Print Provenance</p>
            <p className="text-xs text-slate-500 mt-0.5">Register your print Graphic Novel to link provenance to your KNYT Shelf.</p>
            <button type="button" className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Register provenance →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const publicBundles = BUNDLE_PRICING.filter((b) => !b.isInvestorOnly);
const investorBundles = BUNDLE_PRICING.filter((b) => b.isInvestorOnly);

export function KnytStoreBundlesTab({ personaId: _personaId, theme: _theme }: Props) {
  const [view, setView] = useState<BundleView>({ kind: 'landing' });
  const { getCoverThumb } = useKnytThumbnails();
  // Episode -1 is the GN; maps to episodeNumber -1 in DB
  const gnThumbUrl = getCoverThumb(-1);

  const headerLabel =
    view.kind === 'landing' ? 'Bundles & Graphic Novel'
    : view.kind === 'bundle-detail' ? view.bundle.label
    : view.kind === 'gn-detail' ? `GN — ${view.option.label}`
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
          <div className="p-4 space-y-6">
            {/* Episode bundles */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3">Episode Bundles</p>
              <div className="space-y-2">
                {publicBundles.map((bundle) => {
                  // Show up to 3 cover thumbs for included episodes
                  const bundleThumbs = bundle.episodes
                    .slice(0, 3)
                    .map((epNum) => getCoverThumb(epNum))
                    .filter(Boolean) as string[];
                  return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setView({ kind: 'bundle-detail', bundle })}
                    className="w-full flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3 hover:border-teal-500/30 hover:bg-slate-800/60 transition-colors text-left"
                  >
                    {/* Thumbnail stack */}
                    {bundleThumbs.length > 0 && (
                      <div className="flex gap-0.5 shrink-0">
                        {bundleThumbs.map((url, i) => (
                          <div key={i} className="w-8 aspect-[3/4] rounded overflow-hidden bg-slate-800">
                            <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    )}
                    {bundleThumbs.length === 0 && (
                      <div className="w-8 aspect-[3/4] rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Film className="h-3 w-3 text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-white truncate">{bundle.label}</p>
                        {bundle.isFullSeason && (
                          <span className="rounded-full bg-teal-900/40 border border-teal-700/40 px-1.5 py-0.5 text-[9px] font-semibold text-teal-400 shrink-0">
                            Full Season
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-yellow-400 mt-0.5">
                        ${getKnytDiscountedPrice(bundle.digitalPrice).toFixed(2)} w/ $KNYT COYN
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-white">${bundle.digitalPrice}</p>
                      <p className="text-[10px] text-slate-500">{bundle.episodes.length} eps</p>
                    </div>
                  </button>
                );})}
              </div>
            </div>

            {/* Investor bundles */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold text-slate-300">Investor Bundles</p>
                <Lock className="h-3 w-3 text-yellow-500" />
              </div>
              <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 px-3 py-2 mb-3 flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-yellow-300">Token-gated. Requires investor access to unlock.</p>
              </div>
              <div className="space-y-2">
                {investorBundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setView({ kind: 'bundle-detail', bundle })}
                    className="w-full flex items-center justify-between rounded-xl border border-yellow-800/30 bg-slate-900/60 p-4 hover:border-yellow-600/40 hover:bg-slate-800/60 transition-colors opacity-80 hover:opacity-100"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        <p className="text-sm font-semibold text-white">{bundle.label}</p>
                        {bundle.isLimited && bundle.limitedSupply && (
                          <span className="rounded-full bg-red-900/40 border border-red-700/40 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            Limited {bundle.limitedSupply}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{bundle.episodes.length} items</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">${bundle.digitalPrice}</p>
                      <p className="text-[10px] text-yellow-600">Investor only</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Graphic Novel */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-3">Graphic Novel</p>
              <div className="space-y-2">
                {GRAPHIC_NOVEL_PRICING.map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setView({ kind: 'gn-detail', option })}
                    className="w-full flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3 hover:border-teal-500/30 hover:bg-slate-800/60 transition-colors text-left"
                  >
                    {gnThumbUrl ? (
                      <div className="w-10 aspect-[3/4] rounded overflow-hidden bg-slate-800 shrink-0">
                        <img src={gnThumbUrl} alt="GN" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className="w-10 aspect-[3/4] rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Film className="h-3 w-3 text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{option.label}</p>
                      {option.layer !== 'print' && (
                        <p className="text-[10px] text-yellow-400 mt-0.5">
                          ${getKnytDiscountedPrice(option.price).toFixed(2)} w/ $KNYT COYN
                        </p>
                      )}
                    </div>
                    <p className="text-xl font-bold text-white shrink-0">${option.price}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {view.kind === 'bundle-detail' && (
          <BundleDetail bundle={view.bundle} onBack={() => setView({ kind: 'landing' })} getCoverThumb={getCoverThumb} />
        )}
        {view.kind === 'gn-detail' && (
          <GnDetail option={view.option} onBack={() => setView({ kind: 'landing' })} gnThumbUrl={gnThumbUrl} />
        )}
      </div>
    </div>
  );
}
