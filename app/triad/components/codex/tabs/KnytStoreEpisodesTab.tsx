'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Film,
  Image as ImageIcon,
  Package,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  EPISODE_PRICING,
  QRIPTO_RARITY_CONFIG,
  QRIPTO_SUPPLY,
  QRIPTO_RARITY_ORDER,
  PRINT_PROVENANCE_PRICE_USD,
  PRINT_PROVENANCE_PRICE_KNYT,
  getEpisodePairPrice,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  type EpisodePricing,
} from '@/types/knyt-store';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type Modality = 'still' | 'motion';
type Layer = 'digital' | 'print' | 'qripto';

type EpisodesView =
  | { kind: 'list' }
  | { kind: 'episode'; ep: EpisodePricing; modality: Modality; layer: Layer };

// ── Helpers ───────────────────────────────────────────────────────────────────

function epLabel(ep: EpisodePricing): string {
  return ep.episodeNumber === -1 ? 'Graphic Novel' : `Episode ${ep.episodeNumber}`;
}

function epShortLabel(ep: EpisodePricing): string {
  return ep.episodeNumber === -1 ? 'GN' : `Ep. ${ep.episodeNumber}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Episode list card ─────────────────────────────────────────────────────────

function EpisodeCard({ ep, onSelect }: { ep: EpisodePricing; onSelect: (modality: Modality, layer: Layer) => void }) {
  const isGN = ep.episodeNumber === -1;
  const pairPrice = getEpisodePairPrice(ep);

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{epLabel(ep)}</p>
          {isGN && (
            <p className="text-[10px] text-slate-400 mt-0.5">metaKnyt — −1α Paperback / −1β Hardcover</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">${ep.digitalPrice}</p>
          <p className="text-[10px] text-slate-500">per modality</p>
        </div>
      </div>

      {/* Pair bundle note */}
      <div className="mb-3 rounded-lg border border-teal-800/30 bg-teal-900/10 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-teal-300">Still + Motion pair</span>
        <span className="text-xs font-semibold text-teal-400">
          ${pairPrice} <span className="text-[10px] font-normal text-teal-600">(−20%)</span>
        </span>
      </div>

      {/* Modality + layer buttons — Qripto first */}
      <div className="space-y-2">
        {/* Qripto row */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-purple-400 uppercase tracking-wider w-12 shrink-0">Qripto</span>
          <button
            type="button"
            onClick={() => onSelect('still', 'qripto')}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-purple-700/40 bg-purple-900/20 py-1.5 text-[10px] font-medium text-purple-300 hover:bg-purple-800/30 transition-colors"
          >
            <ImageIcon className="h-3 w-3" /> Still
          </button>
          <button
            type="button"
            onClick={() => onSelect('motion', 'qripto')}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-purple-700/40 bg-purple-900/20 py-1.5 text-[10px] font-medium text-purple-300 hover:bg-purple-800/30 transition-colors"
          >
            <Film className="h-3 w-3" /> Motion
          </button>
        </div>
        {/* Digital row */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-sky-400 uppercase tracking-wider w-12 shrink-0">Digital</span>
          <button
            type="button"
            onClick={() => onSelect('still', 'digital')}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-sky-700/40 bg-sky-900/20 py-1.5 text-[10px] font-medium text-sky-300 hover:bg-sky-800/30 transition-colors"
          >
            <ImageIcon className="h-3 w-3" /> Still
          </button>
          <button
            type="button"
            onClick={() => onSelect('motion', 'digital')}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-sky-700/40 bg-sky-900/20 py-1.5 text-[10px] font-medium text-sky-300 hover:bg-sky-800/30 transition-colors"
          >
            <Film className="h-3 w-3" /> Motion
          </button>
        </div>
        {/* Print row */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider w-12 shrink-0">Print</span>
          {isGN ? (
            <>
              <button
                type="button"
                onClick={() => onSelect('still', 'print')}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-amber-700/40 bg-amber-900/20 py-1.5 text-[10px] font-medium text-amber-300 hover:bg-amber-800/30 transition-colors"
              >
                <BookOpen className="h-3 w-3" /> −1α Paperback
              </button>
              <button
                type="button"
                onClick={() => onSelect('motion', 'print')}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-amber-700/40 bg-amber-900/20 py-1.5 text-[10px] font-medium text-amber-300 hover:bg-amber-800/30 transition-colors"
              >
                <BookOpen className="h-3 w-3" /> −1β Hardcover
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSelect('still', 'print')}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-amber-700/40 bg-amber-900/20 py-1.5 text-[10px] font-medium text-amber-300 hover:bg-amber-800/30 transition-colors"
            >
              <BookOpen className="h-3 w-3" /> Paperback ${ep.printPrice}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Episode detail ─────────────────────────────────────────────────────────────

function EpisodeDetail({ ep, modality, layer }: { ep: EpisodePricing; modality: Modality; layer: Layer }) {
  const isGN = ep.episodeNumber === -1;
  const isQripto = layer === 'qripto';
  const isPrint = layer === 'print';

  // For GN print: "motion" slot = hardcover (−1β), "still" = paperback (−1α)
  const gnVariant = isGN && isPrint
    ? (modality === 'motion' ? ep.printVariants?.[1] : ep.printVariants?.[0])
    : null;

  const price = isPrint
    ? (gnVariant?.price ?? ep.printPrice)
    : ep.digitalPrice;

  const layerLabel = isQripto ? 'Qripto Edition' : isPrint ? 'Print Edition' : 'Digital Edition';
  const modalityLabel = modality === 'still' ? 'Still' : 'Motion';

  const title = isGN && isPrint
    ? (modality === 'motion' ? 'Hardcover (−1β)' : 'Paperback (−1α)')
    : `${epLabel(ep)} — ${modalityLabel} ${layerLabel}`;

  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs text-slate-500 mb-0.5">{epShortLabel(ep)} · {layerLabel}</p>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {isQripto && (
          <span className="mt-1 inline-block rounded-full bg-purple-900/40 border border-purple-700/40 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
            Qripto First
          </span>
        )}
      </div>

      {/* Pricing */}
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-white">${price}</span>
          <span className="text-sm text-slate-400 mb-0.5">USD</span>
        </div>
        {!isPrint && <KnytPricePill basePrice={price} />}
        {isPrint && (
          <p className="text-xs text-slate-500">Print edition — available via Amazon. Not eligible for $KNYT COYN discount.</p>
        )}
      </div>

      {/* Amazon button for print */}
      {isPrint && (() => {
        const amazonUrl = gnVariant?.amazonUrl ?? ep.printVariants?.[0]?.amazonUrl;
        if (!amazonUrl) return null;
        return (
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-amber-700/40 bg-amber-900/10 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-800/20 transition-colors"
          >
            <BookOpen className="h-4 w-4" /> Buy on Amazon
          </a>
        );
      })()}

      {/* Qripto rarity explainer */}
      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-4 space-y-3">
          <p className="text-sm font-semibold text-purple-300">Qripto Collectible — {QRIPTO_SUPPLY.toLocaleString()} Total Supply</p>
          <div className="space-y-1">
            {QRIPTO_RARITY_ORDER.map((r) => {
              const cfg = QRIPTO_RARITY_CONFIG[r];
              return (
                <div key={r} className="flex items-center justify-between text-xs">
                  <span className="capitalize text-slate-300">{r}</span>
                  <span className="text-slate-500">{cfg.supply.toLocaleString()} editions</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500">Rarity randomly assigned at mint. Black Edition is a hidden anomaly.</p>
        </div>
      )}

      {/* Modality note */}
      {!isPrint && (
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            {modality === 'still'
              ? <ImageIcon className="h-4 w-4 text-sky-400 shrink-0" />
              : <Film className="h-4 w-4 text-teal-400 shrink-0" />}
            <p className="text-xs font-semibold text-slate-300">{modalityLabel} Format</p>
          </div>
          <p className="text-xs text-slate-500">
            {modality === 'still'
              ? 'Portrait-format still comic — optimised for reading on any device.'
              : 'Landscape-format animated comic with sound and motion effects.'}
          </p>
        </div>
      )}

      {/* Pair bundle CTA */}
      {!isPrint && (
        <div className="rounded-xl border border-teal-800/30 bg-teal-900/10 p-3 flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-teal-300">Still + Motion Pair</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Get both formats for ${getEpisodePairPrice(ep)} — 20% off vs buying separately.
            </p>
          </div>
        </div>
      )}

      {/* Print Provenance */}
      {!isQripto && (
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 flex items-start gap-2">
          <Package className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-300">Print Provenance</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Register a print copy for ${PRINT_PROVENANCE_PRICE_USD} or {PRINT_PROVENANCE_PRICE_KNYT} KNYT to link it to your shelf.
            </p>
            <button type="button" className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Register provenance →
            </button>
          </div>
        </div>
      )}

      {/* Vintage CTA */}
      {!isPrint && (
        <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 p-3 flex items-start gap-2">
          <Sparkles className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-yellow-300">Vintage Editions</p>
            <p className="text-xs text-slate-400 mt-0.5">
              If you owned a prior edition, you may be eligible to claim a Vintage Qripto upgrade.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function KnytStoreEpisodesTab({ personaId: _personaId, theme: _theme }: Props) {
  const [view, setView] = useState<EpisodesView>({ kind: 'list' });

  // GN first, then episodes 0–12
  const episodes = [
    EPISODE_PRICING.find((e) => e.episodeNumber === -1)!,
    ...EPISODE_PRICING.filter((e) => e.episodeNumber >= 0).sort((a, b) => a.episodeNumber - b.episodeNumber),
  ].filter(Boolean);

  const headerLabel =
    view.kind === 'list'
      ? 'Episodes & Graphic Novel'
      : (() => {
          const layerStr = view.layer.charAt(0).toUpperCase() + view.layer.slice(1);
          const modalStr = view.modality === 'still' ? 'Still' : 'Motion';
          return `${epShortLabel(view.ep)} — ${modalStr} ${layerStr}`;
        })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        {view.kind !== 'list' && (
          <button
            type="button"
            onClick={() => setView({ kind: 'list' })}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Film className="h-4 w-4 text-teal-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">{headerLabel}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'list' ? (
          <div className="p-4 space-y-3">
            {episodes.map((ep) => (
              <EpisodeCard
                key={ep.episodeNumber}
                ep={ep}
                onSelect={(modality, layer) => setView({ kind: 'episode', ep, modality, layer })}
              />
            ))}
          </div>
        ) : (
          <EpisodeDetail ep={view.ep} modality={view.modality} layer={view.layer} />
        )}
      </div>
    </div>
  );
}
