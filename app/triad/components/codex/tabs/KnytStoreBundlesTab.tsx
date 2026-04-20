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

const LAYER_BADGE: Record<string, string> = {
  qripto:          'bg-purple-900/70 text-purple-300 border-purple-700/40',
  'digital-common':'bg-sky-900/70 text-sky-300 border-sky-700/40',
  print:           'bg-amber-900/70 text-amber-300 border-amber-700/40',
  digital:         'bg-sky-900/70 text-sky-300 border-sky-700/40',
};

const LAYER_SHORT: Record<string, string> = {
  qripto: 'Qripto', 'digital-common': 'Digital', print: 'Print', digital: 'Digital',
};

function KnytPricePill({ basePrice }: { basePrice: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-2 py-1">
      <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
      <span className="text-[10px] text-yellow-300 font-medium">
        ${getKnytDiscountedPrice(basePrice).toFixed(2)} w/ $KNYT COYN
      </span>
      <span className="text-[9px] text-yellow-600">({Math.round(KNYT_COYN_DISCOUNT * 100)}% off)</span>
    </div>
  );
}

// ── 4-col grid card (GN formats) ─────────────────────────────────────────────

function GnGridCard({
  option,
  thumbUrl,
  onClick,
}: {
  option: GraphicNovelPricing;
  thumbUrl?: string;
  onClick: () => void;
}) {
  const badgeClass = LAYER_BADGE[option.layer] ?? LAYER_BADGE['digital-common'];
  const layerLabel = LAYER_SHORT[option.layer] ?? option.layer;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 w-full"
    >
      <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={option.label} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-700">
            <Film className="h-5 w-5" />
          </div>
        )}
        <div className={`absolute top-1 right-1 rounded border px-1 py-0.5 text-[7px] font-bold ${badgeClass}`}>
          {layerLabel}
        </div>
      </div>
      <div className="px-1.5 pt-1.5 pb-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight truncate">{option.label}</p>
        <p className="text-[11px] font-bold text-white">${option.price}</p>
      </div>
    </button>
  );
}

// ── 2-col bundle card for episode bundles ────────────────────────────────────

function BundleCard({
  bundle,
  getCoverThumb,
  onClick,
}: {
  bundle: BundlePricing;
  getCoverThumb: (ep: number) => string | undefined;
  onClick: () => void;
}) {
  const previewThumb = getCoverThumb(bundle.episodes[0]);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 w-full"
    >
      <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
        {previewThumb ? (
          <img src={previewThumb} alt={bundle.label} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-700">
            <Film className="h-5 w-5" />
          </div>
        )}
        <div className="absolute top-1 right-1 rounded border border-teal-700/40 bg-teal-900/70 px-1 py-0.5 text-[7px] font-bold text-teal-300">
          {bundle.episodes.length} eps
        </div>
        {bundle.isFullSeason && (
          <div className="absolute top-1 left-1 rounded border border-teal-700/40 bg-teal-900/70 px-1 py-0.5 text-[7px] font-bold text-teal-300">
            Season
          </div>
        )}
      </div>
      <div className="px-1.5 pt-1.5 pb-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight">{bundle.label}</p>
        <p className="text-[8px] text-yellow-400">${getKnytDiscountedPrice(bundle.digitalPrice).toFixed(2)} KNYT</p>
        <p className="text-[11px] font-bold text-white">${bundle.digitalPrice}</p>
      </div>
    </button>
  );
}

// ── Shared 2-col detail layout ────────────────────────────────────────────────

function DetailLayout({
  thumbUrl,
  altText,
  layerKey,
  children,
}: {
  thumbUrl?: string;
  altText: string;
  layerKey: string;
  children: React.ReactNode;
}) {
  const badgeClass = LAYER_BADGE[layerKey] ?? LAYER_BADGE['digital-common'];
  const layerLabel = LAYER_SHORT[layerKey] ?? layerKey;

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      <div className="space-y-2">
        <div className="aspect-[2/3] rounded-xl overflow-hidden bg-slate-950 border border-white/5">
          {thumbUrl ? (
            <img src={thumbUrl} alt={altText} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Film className="h-8 w-8 text-slate-700" />
            </div>
          )}
        </div>
        <div className={`w-full text-center rounded-lg border px-2 py-1 text-[9px] font-semibold ${badgeClass}`}>
          {layerLabel}
        </div>
      </div>
      <div className="space-y-2.5 min-w-0">
        {children}
      </div>
    </div>
  );
}

// ── GN detail (2-col) ─────────────────────────────────────────────────────────

function GnDetail({
  option,
  gnThumbUrl,
}: {
  option: GraphicNovelPricing;
  gnThumbUrl?: string;
}) {
  const isPrint  = option.layer === 'print';
  const isQripto = option.layer === 'qripto';

  return (
    <DetailLayout thumbUrl={gnThumbUrl} altText={option.label} layerKey={option.layer}>
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wide">Graphic Novel</p>
        <p className="text-sm font-bold text-white">metaKnyt</p>
        <p className="text-[10px] text-slate-300 mt-0.5">{option.label}</p>
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-white">${option.price}</span>
          <span className="text-[10px] text-slate-400">USD</span>
        </div>
        {!isPrint && <KnytPricePill basePrice={option.price} />}
        {isPrint && <p className="text-[9px] text-slate-500">Print · no KNYT discount</p>}
      </div>

      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-purple-300">Qripto Edition</p>
          <p className="text-[8px] text-slate-400 mt-0.5">
            1,860 total supply. Rarity randomly assigned on reveal.
          </p>
        </div>
      )}

      {isPrint && option.amazonUrl && (
        <a
          href={option.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-700/40 bg-amber-900/10 py-2 text-[10px] font-semibold text-amber-300 hover:bg-amber-800/20 transition-colors"
        >
          <BookOpen className="h-3 w-3" /> Buy on Amazon
        </a>
      )}

      {isPrint && (
        <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-amber-300">Print Provenance</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[9px] text-slate-400">Register print GN</span>
          </div>
          <button type="button" className="mt-1 text-[9px] text-amber-400 underline underline-offset-2">
            Register →
          </button>
        </div>
      )}
    </DetailLayout>
  );
}

// ── Bundle detail (2-col) ─────────────────────────────────────────────────────

function BundleDetail({
  bundle,
  getCoverThumb,
}: {
  bundle: BundlePricing;
  getCoverThumb: (epNum: number) => string | undefined;
}) {
  const includedEpisodes = EPISODE_PRICING.filter((ep) => bundle.episodes.includes(ep.episodeNumber));
  const previewThumb = getCoverThumb(bundle.episodes[0]);
  const individualTotal = includedEpisodes.reduce((s, ep) => s + ep.digitalPrice, 0);

  return (
    <DetailLayout thumbUrl={previewThumb} altText={bundle.label} layerKey="digital">
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wide">
          {bundle.isInvestorOnly ? 'Investor Bundle' : 'Episode Bundle'}
        </p>
        <p className="text-sm font-bold text-white">{bundle.label}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {bundle.isFullSeason && (
            <span className="rounded-full bg-teal-900/40 border border-teal-700/40 px-1.5 py-0.5 text-[8px] font-semibold text-teal-400">
              Full Season
            </span>
          )}
          {bundle.isInvestorOnly && (
            <span className="rounded-full bg-yellow-900/40 border border-yellow-700/40 px-1.5 py-0.5 text-[8px] font-semibold text-yellow-400">
              Investor Only
            </span>
          )}
          {bundle.isLimited && bundle.limitedSupply && (
            <span className="rounded-full bg-red-900/40 border border-red-700/40 px-1.5 py-0.5 text-[8px] font-semibold text-red-400">
              Limited {bundle.limitedSupply}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-white">${bundle.digitalPrice}</span>
          <span className="text-[10px] text-slate-400">USD</span>
        </div>
        <KnytPricePill basePrice={bundle.digitalPrice} />
        {bundle.digitalPrice < individualTotal && (
          <p className="text-[9px] text-teal-400">
            Save ${(individualTotal - bundle.digitalPrice).toFixed(0)} vs buying individually
          </p>
        )}
      </div>

      <div className="rounded-lg border border-amber-800/30 bg-amber-900/10 px-2.5 py-2 flex items-start gap-1.5">
        <BookOpen className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-amber-300">{getPrintFulfillmentMessage(false)}</p>
      </div>

      {bundle.accessGrant && (
        <div className="rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-2.5 flex items-start gap-1.5">
          <Crown className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-semibold text-yellow-300">Order of Metaiye Access</p>
            <p className="text-[8px] text-slate-400 mt-0.5">Grants Zero KNYT tier access on purchase.</p>
          </div>
        </div>
      )}

      {bundle.includes && bundle.includes.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold text-slate-300 mb-1">Includes</p>
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

      <div>
        <p className="text-[9px] font-semibold text-slate-300 mb-1">
          Episodes ({includedEpisodes.length})
        </p>
        <div className="space-y-0.5 max-h-32 overflow-y-auto">
          {includedEpisodes.map((ep) => (
            <div key={ep.episodeNumber} className="flex items-center justify-between rounded bg-slate-800/50 px-2 py-1">
              <span className="text-[9px] text-slate-300">Episode {ep.episodeNumber}</span>
              <span className="text-[9px] text-slate-500">${ep.digitalPrice}</span>
            </div>
          ))}
        </div>
      </div>
    </DetailLayout>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

const publicBundles = BUNDLE_PRICING.filter((b) => !b.isInvestorOnly);
const investorBundles = BUNDLE_PRICING.filter((b) => b.isInvestorOnly);

export function KnytStoreBundlesTab({ personaId: _personaId, theme: _theme }: Props) {
  const [view, setView] = useState<BundleView>({ kind: 'landing' });
  const { getCoverThumb } = useKnytThumbnails();
  const gnThumbUrl = getCoverThumb(-1);

  const headerLabel =
    view.kind === 'landing' ? 'Bundles & Graphic Novel'
    : view.kind === 'bundle-detail' ? view.bundle.label
    : `GN — ${view.option.label}`;

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
            {/* Graphic Novel — 4-col grid */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Graphic Novel
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {GRAPHIC_NOVEL_PRICING.map((option, i) => (
                  <GnGridCard
                    key={i}
                    option={option}
                    thumbUrl={gnThumbUrl}
                    onClick={() => setView({ kind: 'gn-detail', option })}
                  />
                ))}
              </div>
            </div>

            {/* Episode Bundles — 2-col grid */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Episode Bundles
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {publicBundles.map((bundle) => (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    getCoverThumb={getCoverThumb}
                    onClick={() => setView({ kind: 'bundle-detail', bundle })}
                  />
                ))}
              </div>
            </div>

            {/* Investor Bundles */}
            {investorBundles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-0.5 mb-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    Investor Bundles
                  </p>
                  <Lock className="h-3 w-3 text-yellow-500" />
                </div>
                <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 px-3 py-2 mb-2 flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-yellow-300">Token-gated. Requires investor access.</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {investorBundles.map((bundle) => (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => setView({ kind: 'bundle-detail', bundle })}
                      className="flex flex-col rounded-xl border border-yellow-800/30 bg-slate-900/60 p-3 text-left hover:border-yellow-600/40 hover:bg-slate-800/60 transition-colors opacity-80 hover:opacity-100"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Crown className="h-3 w-3 text-yellow-500 shrink-0" />
                        <p className="text-[10px] font-semibold text-white truncate">{bundle.label}</p>
                      </div>
                      {bundle.isLimited && bundle.limitedSupply && (
                        <span className="self-start rounded-full bg-red-900/40 border border-red-700/40 px-1.5 py-0.5 text-[8px] font-semibold text-red-400 mb-1">
                          Ltd {bundle.limitedSupply}
                        </span>
                      )}
                      <p className="text-[10px] text-slate-400">{bundle.episodes.length} items</p>
                      <p className="text-sm font-bold text-white mt-1">${bundle.digitalPrice}</p>
                      <p className="text-[9px] text-yellow-600">Investor only</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view.kind === 'gn-detail' && (
          <GnDetail option={view.option} gnThumbUrl={gnThumbUrl} />
        )}

        {view.kind === 'bundle-detail' && (
          <BundleDetail bundle={view.bundle} getCoverThumb={getCoverThumb} />
        )}
      </div>
    </div>
  );
}
