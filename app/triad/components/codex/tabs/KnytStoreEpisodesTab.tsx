'use client';

import React, { useState } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, Film, Layers, Zap } from 'lucide-react';
import {
  EPISODE_PRICING,
  getKnytDiscountedPrice,
  getPrintFulfillmentMessage,
  KNYT_COYN_DISCOUNT,
  type EpisodePricing,
  type CommercialLayer,
} from '@/types/knyt-store';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type EpisodeView = { kind: 'list' } | { kind: 'detail'; episode: EpisodePricing; layer: CommercialLayer };

// ── Layer badge ───────────────────────────────────────────────────────────────

const LAYER_META: Record<string, { label: string; color: string }> = {
  'digital-common': { label: 'Digital',        color: 'text-sky-400 bg-sky-900/30 border-sky-800/50' },
  'print':          { label: 'Print',           color: 'text-amber-400 bg-amber-900/30 border-amber-800/50' },
  'qripto':         { label: 'Qripto Edition',  color: 'text-purple-400 bg-purple-900/30 border-purple-800/50' },
};

function LayerBadge({ layer }: { layer: string }) {
  const m = LAYER_META[layer] ?? { label: layer, color: 'text-slate-400 bg-slate-800 border-slate-700' };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.color}`}>
      {m.label}
    </span>
  );
}

// ── KNYT discount pill ────────────────────────────────────────────────────────

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

// ── Episode card ──────────────────────────────────────────────────────────────

function EpisodeCard({
  ep,
  onSelect,
}: {
  ep: EpisodePricing;
  onSelect: (ep: EpisodePricing, layer: CommercialLayer) => void;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Episode</p>
          <p className="text-lg font-bold text-white">{ep.episodeNumber}</p>
        </div>
        <Film className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
      </div>

      <div className="space-y-2">
        {/* Digital */}
        <button
          type="button"
          onClick={() => onSelect(ep, 'digital-common')}
          className="w-full flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/60 px-3 py-2 hover:border-sky-500/40 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <LayerBadge layer="digital-common" />
          </div>
          <span className="text-sm font-semibold text-white">${ep.digitalPrice}</span>
        </button>

        {/* Print */}
        <button
          type="button"
          onClick={() => onSelect(ep, 'print')}
          className="w-full flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/60 px-3 py-2 hover:border-amber-500/40 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <LayerBadge layer="print" />
            <span className="text-[10px] text-slate-500">Amazon</span>
          </div>
          <span className="text-sm font-semibold text-white">${ep.printPrice}</span>
        </button>

        {/* Qripto */}
        <button
          type="button"
          onClick={() => onSelect(ep, 'qripto')}
          className="w-full flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/60 px-3 py-2 hover:border-purple-500/40 hover:bg-slate-800 transition-colors"
        >
          <LayerBadge layer="qripto" />
          <span className="text-sm font-semibold text-white">${ep.qriptoPrice}</span>
        </button>
      </div>
    </div>
  );
}

// ── Product detail ────────────────────────────────────────────────────────────

function EpisodeDetail({
  episode,
  layer,
  onBack,
}: {
  episode: EpisodePricing;
  layer: CommercialLayer;
  onBack: () => void;
}) {
  const isPrint   = layer === 'print';
  const isQripto  = layer === 'qripto';
  const isDigital = layer === 'digital-common';
  const price     = isPrint ? episode.printPrice : episode.digitalPrice;

  return (
    <div className="p-4 space-y-5">
      {/* Title */}
      <div>
        <p className="text-xs text-slate-500 mb-0.5">Episode {episode.episodeNumber}</p>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">metaKnyt — Episode {episode.episodeNumber}</h2>
          <LayerBadge layer={layer} />
        </div>
      </div>

      {/* Pricing block */}
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-white">${price}</span>
          <span className="text-sm text-slate-400 mb-0.5">USD</span>
        </div>
        {!isPrint && <KnytPricePill basePrice={price} />}
        {isPrint && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-800/30 bg-amber-900/10 px-3 py-2">
            <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">{getPrintFulfillmentMessage(true)}</p>
            <a
              href={`https://amazon.com`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 shrink-0"
            >
              Amazon <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Qripto framing */}
      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-purple-400" />
            <p className="text-sm font-semibold text-purple-300">Qripto Edition</p>
          </div>
          <p className="text-xs text-slate-400">
            1,860 total supply per episode. Rarity is randomly assigned at mint — Legendary (18), Epic (186), Rare (1,654), with 2 hidden Black Edition anomalies.
          </p>
          <p className="text-xs text-slate-500">You will not know your rarity until after purchase. Price is the same regardless of rarity.</p>
        </div>
      )}

      {/* Vintage CTA (motion episodes) */}
      {isQripto && (
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 flex items-start gap-2">
          <Film className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-300">Already own a legacy motion edition?</p>
            <p className="text-xs text-slate-500 mt-0.5">Vintage motion holders can claim the corresponding Qripto motion edition — rarity randomly assigned.</p>
            <button type="button" className="mt-2 text-xs text-teal-400 hover:text-teal-300 underline underline-offset-2">
              Check Vintage claim eligibility →
            </button>
          </div>
        </div>
      )}

      {/* Provenance entry point (print) */}
      {isPrint && (
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 flex items-start gap-2">
          <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-300">Print Provenance</p>
            <p className="text-xs text-slate-500 mt-0.5">Register your print purchase to link provenance to your KNYT Shelf.</p>
            <button type="button" className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Register provenance →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function KnytStoreEpisodesTab({ personaId, theme }: Props) {
  const [view, setView] = useState<EpisodeView>({ kind: 'list' });

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        {view.kind === 'detail' && (
          <button
            type="button"
            onClick={() => setView({ kind: 'list' })}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Film className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">
          {view.kind === 'list' ? 'Episodes' : `Episode ${view.episode.episodeNumber} — ${LAYER_META[view.layer]?.label}`}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'list' && (
          <div className="p-4">
            <p className="text-xs text-slate-400 mb-4">
              13 episodes — digital, print (Amazon), and Qripto editions. Pay with $KNYT COYN for {Math.round(KNYT_COYN_DISCOUNT * 100)}% off digital purchases.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {EPISODE_PRICING.map((ep) => (
                <EpisodeCard
                  key={ep.episodeNumber}
                  ep={ep}
                  onSelect={(ep, layer) => setView({ kind: 'detail', episode: ep, layer })}
                />
              ))}
            </div>
          </div>
        )}
        {view.kind === 'detail' && (
          <EpisodeDetail
            episode={view.episode}
            layer={view.layer}
            onBack={() => setView({ kind: 'list' })}
          />
        )}
      </div>
    </div>
  );
}
