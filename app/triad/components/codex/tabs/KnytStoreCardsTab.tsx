'use client';

import React, { useState } from 'react';
import { ArrowLeft, Layers, Package, User, Zap } from 'lucide-react';
import {
  KNYT_CARDS_PRICING,
  QRIPTO_RARITY_CONFIG,
  QRIPTO_SUPPLY,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  type CardsPricing,
} from '@/types/knyt-store';
import { useKnytThumbnails } from './useKnytThumbnails';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type CardsView = { kind: 'landing' } | { kind: 'detail'; option: CardsPricing };

// 13 KNYT character cards — each tied to an episode (episodes #0–#12)
const CARD_EPISODE_NUMBERS = Array.from({ length: 13 }, (_, i) => i);

const LAYER_META: Record<string, { label: string; badgeClass: string; borderHover: string }> = {
  qripto:           { label: 'Qripto',   badgeClass: 'bg-purple-900/70 text-purple-300 border-purple-700/40', borderHover: 'hover:border-purple-500/40' },
  'digital-common': { label: 'Digital',  badgeClass: 'bg-sky-900/70 text-sky-300 border-sky-700/40',         borderHover: 'hover:border-sky-500/40'    },
  physical:         { label: 'Physical', badgeClass: 'bg-amber-900/70 text-amber-300 border-amber-700/40',   borderHover: 'hover:border-amber-500/40'  },
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

// ── Character card mini-grid (used inside pack detail) ───────────────────────

function CharacterGrid({ getCharacterThumb }: { getCharacterThumb: (ep: number) => string | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {CARD_EPISODE_NUMBERS.map((epNum) => {
        const thumb = getCharacterThumb(epNum);
        return (
          <div
            key={epNum}
            className="rounded overflow-hidden aspect-[3/4] bg-slate-800 border border-white/5 relative"
          >
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
  );
}

// ── Pack landing card — portrait with first character thumb ──────────────────

function PackCard({
  option,
  getCharacterThumb,
  onClick,
}: {
  option: CardsPricing;
  getCharacterThumb: (ep: number) => string | undefined;
  onClick: () => void;
}) {
  const meta = LAYER_META[option.layer] ?? LAYER_META['digital-common'];
  const previewThumb = CARD_EPISODE_NUMBERS.map((n) => getCharacterThumb(n)).find(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors ${meta.borderHover} hover:bg-slate-800/60 w-full`}
    >
      <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
        {previewThumb ? (
          <img src={previewThumb} alt={meta.label} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-700">
            <Package className="h-5 w-5" />
          </div>
        )}
        <div className={`absolute top-1 right-1 rounded border px-1 py-0.5 text-[7px] font-bold ${meta.badgeClass}`}>
          {meta.label}
        </div>
      </div>
      <div className="px-1.5 pt-1.5 pb-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight">13 Card Pack</p>
        <p className="text-[8px] text-slate-500">{meta.label}</p>
        <p className="text-[11px] font-bold text-white">${option.price}</p>
      </div>
    </button>
  );
}

// ── Pack detail — 2-col: left = character grid, right = metadata ─────────────

function PackDetail({
  option,
  getCharacterThumb,
}: {
  option: CardsPricing;
  getCharacterThumb: (ep: number) => string | undefined;
}) {
  const isQripto   = option.layer === 'qripto';
  const isPhysical = option.layer === 'physical';
  const meta       = LAYER_META[option.layer] ?? LAYER_META['digital-common'];

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      {/* Left: character card grid */}
      <div className="space-y-2">
        <CharacterGrid getCharacterThumb={getCharacterThumb} />
        <p className="text-[8px] text-slate-500 text-center">13 cards · 1,860-unit issuance each</p>
        <div className={`w-full text-center rounded-lg border px-2 py-1 text-[9px] font-semibold ${meta.badgeClass}`}>
          {meta.label}
        </div>
      </div>

      {/* Right: metadata */}
      <div className="space-y-2.5 min-w-0">
        <div>
          <p className="text-[9px] text-slate-500 uppercase tracking-wide">KNYT Cards</p>
          <p className="text-sm font-bold text-white">{meta.label} Pack</p>
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
        </div>

        {isQripto && (
          <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Layers className="h-3 w-3 text-purple-400" />
              <p className="text-[9px] font-semibold text-purple-300">Qripto Rarity — Per Card</p>
            </div>
            {Object.entries(QRIPTO_RARITY_CONFIG)
              .filter(([tier]) => tier !== 'black')
              .map(([tier, cfg]) => (
                <div key={tier} className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] capitalize text-slate-300">{tier}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400">{cfg.supply} / {QRIPTO_SUPPLY}</span>
                    <span className={`text-[8px] rounded px-1 py-0.5 ${
                      tier === 'legendary' ? 'bg-yellow-900/40 text-yellow-400'
                      : tier === 'epic'    ? 'bg-purple-900/40 text-purple-400'
                      : 'bg-slate-700 text-slate-400'
                    }`}>
                      {((cfg.supply / QRIPTO_SUPPLY) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            <p className="text-[8px] text-slate-500 mt-1">
              Black Edition (2/card) — hidden anomaly. Revealed post-purchase.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
          <p className="text-[9px] font-semibold text-slate-300">Each card's rarity</p>
          <p className="text-[8px] text-slate-500 mt-0.5">
            Independently drawn from its own 1,860-unit pool. Random at reveal.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function KnytStoreCardsTab({ personaId: _personaId, theme: _theme }: Props) {
  const [view, setView] = useState<CardsView>({ kind: 'landing' });
  const { getCharacterThumb } = useKnytThumbnails();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        {view.kind === 'detail' && (
          <button
            type="button"
            onClick={() => setView({ kind: 'landing' })}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Package className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">
          {view.kind === 'landing'
            ? 'KNYT Cards'
            : `${LAYER_META[view.option.layer]?.label ?? 'Pack'} — 13 Cards`}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'landing' && (
          <div className="p-2.5 space-y-3">
            <p className="text-[10px] text-slate-400 px-0.5">
              Each pack includes all 13 KNYT character cards. Rarity independently assigned from
              each card&apos;s {QRIPTO_SUPPLY.toLocaleString()}-unit pool.
            </p>
            {/* 3 pack options in a 3-col grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {KNYT_CARDS_PRICING.map((option) => (
                <PackCard
                  key={option.layer}
                  option={option}
                  getCharacterThumb={getCharacterThumb}
                  onClick={() => setView({ kind: 'detail', option })}
                />
              ))}
            </div>
          </div>
        )}
        {view.kind === 'detail' && (
          <PackDetail option={view.option} getCharacterThumb={getCharacterThumb} />
        )}
      </div>
    </div>
  );
}
