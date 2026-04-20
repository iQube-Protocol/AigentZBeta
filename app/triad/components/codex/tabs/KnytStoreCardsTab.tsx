'use client';

import React, { useState } from 'react';
import { ArrowLeft, Layers, Package, Zap } from 'lucide-react';
import {
  KNYT_CARDS_PRICING,
  QRIPTO_RARITY_CONFIG,
  QRIPTO_SUPPLY,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  type CardsPricing,
} from '@/types/knyt-store';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type CardsView = { kind: 'landing' } | { kind: 'detail'; option: CardsPricing };

const CARD_COUNT = 13;

const LAYER_META: Record<string, { label: string; color: string; border: string }> = {
  physical:        { label: 'Physical Pack',         color: 'text-amber-400',  border: 'hover:border-amber-500/40' },
  'digital-common': { label: 'Digital / Common Pack', color: 'text-sky-400',   border: 'hover:border-sky-500/40'  },
  qripto:          { label: 'Qripto Pack',            color: 'text-purple-400', border: 'hover:border-purple-500/40' },
};

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

function PackDetail({ option, onBack }: { option: CardsPricing; onBack: () => void }) {
  const isQripto   = option.layer === 'qripto';
  const isPhysical = option.layer === 'physical';
  const isDigital  = option.layer === 'digital-common';
  const meta       = LAYER_META[option.layer] ?? LAYER_META['digital-common'];

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs text-slate-500 mb-0.5">KNYT Cards</p>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">{meta.label}</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          1 pack = all {CARD_COUNT} KNYT cards. Each card gets its own rarity drawn from that card's individual pool.
        </p>
      </div>

      {/* Pricing */}
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-bold text-white">${option.price}</span>
          <span className="text-sm text-slate-400 mb-0.5">USD</span>
        </div>
        {!isPhysical && <KnytPricePill basePrice={option.price} />}
        {isPhysical && (
          <p className="text-xs text-slate-500">Physical pack — ships to your address. Not eligible for $KNYT COYN discount.</p>
        )}
      </div>

      {/* Card count explainer */}
      <div className="rounded-xl border border-white/5 bg-slate-800/40 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">What's in the pack</p>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: CARD_COUNT }, (_, i) => i + 1).map((n) => (
            <div key={n} className="rounded-lg bg-slate-800 border border-white/5 p-2 text-center">
              <p className="text-xs text-slate-400">Card {n}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">Each of the 13 cards has its own 1,860-unit issuance. Rarity is randomly assigned per card on reveal.</p>
      </div>

      {/* Qripto rarity */}
      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="h-4 w-4 text-purple-400" />
            <p className="text-sm font-semibold text-purple-300">Qripto Rarity — Per Card</p>
          </div>
          <div className="space-y-1.5">
            {Object.entries(QRIPTO_RARITY_CONFIG)
              .filter(([tier]) => tier !== 'black')
              .map(([tier, cfg]) => (
                <div key={tier} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
                  <span className="text-xs capitalize font-medium text-slate-300">{tier}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{cfg.supply} / {QRIPTO_SUPPLY}</span>
                    <span className={`text-[10px] rounded px-1.5 py-0.5 ${
                      tier === 'legendary' ? 'bg-yellow-900/40 text-yellow-400'
                      : tier === 'epic' ? 'bg-purple-900/40 text-purple-400'
                      : 'bg-slate-700 text-slate-400'
                    }`}>
                      {((cfg.supply / QRIPTO_SUPPLY) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
          <p className="text-xs text-slate-500">Black Edition (2 per card) — hidden anomaly. Not above Legendary. Revealed post-purchase.</p>
        </div>
      )}
    </div>
  );
}

export function KnytStoreCardsTab({ personaId, theme }: Props) {
  const [view, setView] = useState<CardsView>({ kind: 'landing' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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
          {view.kind === 'landing' ? 'KNYT Cards' : LAYER_META[view.option.layer]?.label ?? 'Pack Detail'}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'landing' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-400 mb-2">
              {CARD_COUNT} character cards per pack. Each pack includes all {CARD_COUNT} cards.
              Each card's rarity is independently assigned from its own {QRIPTO_SUPPLY.toLocaleString()}-unit pool.
            </p>
            {KNYT_CARDS_PRICING.map((option) => {
              const meta = LAYER_META[option.layer];
              return (
                <button
                  key={option.layer}
                  type="button"
                  onClick={() => setView({ kind: 'detail', option })}
                  className={`w-full flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-4 transition-colors ${meta.border} hover:bg-slate-800/60`}
                >
                  <div className="flex items-center gap-3">
                    <Package className={`h-5 w-5 ${meta.color}`} />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">{meta.label}</p>
                      {option.layer !== 'physical' && (
                        <p className="text-xs text-yellow-400 mt-0.5">
                          ${getKnytDiscountedPrice(option.price).toFixed(2)} w/ $KNYT COYN
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">${option.price}</p>
                    <p className="text-xs text-slate-500">USD</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {view.kind === 'detail' && (
          <PackDetail option={view.option} onBack={() => setView({ kind: 'landing' })} />
        )}
      </div>
    </div>
  );
}
