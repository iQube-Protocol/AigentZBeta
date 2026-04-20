'use client';

import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Package, Zap } from 'lucide-react';
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

function BundleDetail({ bundle, onBack }: { bundle: BundlePricing; onBack: () => void }) {
  const includedEpisodes = EPISODE_PRICING.filter((ep) => bundle.episodes.includes(ep.episodeNumber));

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-slate-500 mb-0.5">Episode Bundle</p>
        <h2 className="text-xl font-bold text-white">{bundle.label}</h2>
        {bundle.isFullSeason && (
          <span className="mt-1 inline-block rounded-full bg-teal-900/40 border border-teal-700/40 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
            Full Season
          </span>
        )}
      </div>

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

function GnDetail({ option, onBack }: { option: GraphicNovelPricing; onBack: () => void }) {
  const isPrint  = option.layer === 'print';
  const isQripto = option.layer === 'qripto';

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-slate-500 mb-0.5">Graphic Novel</p>
        <h2 className="text-xl font-bold text-white">metaKnyt — {option.label}</h2>
      </div>

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

export function KnytStoreBundlesTab({ personaId, theme }: Props) {
  const [view, setView] = useState<BundleView>({ kind: 'landing' });

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
                {BUNDLE_PRICING.map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setView({ kind: 'bundle-detail', bundle })}
                    className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-4 hover:border-teal-500/30 hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{bundle.label}</p>
                        {bundle.isFullSeason && (
                          <span className="rounded-full bg-teal-900/40 border border-teal-700/40 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
                            Full Season
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-yellow-400 mt-0.5">
                        ${getKnytDiscountedPrice(bundle.digitalPrice).toFixed(2)} w/ $KNYT COYN
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">${bundle.digitalPrice}</p>
                      <p className="text-xs text-slate-500">{bundle.episodes.length} eps</p>
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
                    className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-4 hover:border-teal-500/30 hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{option.label}</p>
                      {option.layer !== 'print' && (
                        <p className="text-xs text-yellow-400 mt-0.5">
                          ${getKnytDiscountedPrice(option.price).toFixed(2)} w/ $KNYT COYN
                        </p>
                      )}
                    </div>
                    <p className="text-xl font-bold text-white">${option.price}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {view.kind === 'bundle-detail' && (
          <BundleDetail bundle={view.bundle} onBack={() => setView({ kind: 'landing' })} />
        )}
        {view.kind === 'gn-detail' && (
          <GnDetail option={view.option} onBack={() => setView({ kind: 'landing' })} />
        )}
      </div>
    </div>
  );
}
