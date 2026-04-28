'use client';

import React, { useState } from 'react';
import { ArrowLeft, ShoppingCart, User, Zap } from 'lucide-react';
import {
  QRIPTO_SUPPLY,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  usdToKnyt,
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
  stillPriceKnytOverride?: number;
  motionPriceKnytOverride?: number;
}

type CardVariant = 'still' | 'motion' | 'bundle';
type CardsView = { kind: 'landing' } | { kind: 'detail'; epNum: number };

const CARD_EPISODE_NUMBERS = Array.from({ length: 13 }, (_, i) => i);

// Card pricing per variant
const CARD_PRICES: Record<CardVariant, number> = {
  still:  2,   // USD
  motion: 4,   // USD (4 KNYT base = ~$5.60)
  bundle: 7,   // USD (5 KNYT base = $7.00 — both still+motion)
};

// KNYT prices for each variant (used in selector display)
const CARD_KNYT_PRICES: Record<CardVariant, number> = {
  still:  2,  // 2 KNYT
  motion: 4,  // 4 KNYT
  bundle: 5,  // 5 KNYT (discounted bundle)
};

const VARIANT_LABELS: Record<CardVariant, { short: string; desc: string }> = {
  still:  { short: 'Still',         desc: 'Static character art' },
  motion: { short: 'Motion',        desc: 'Animated card' },
  bundle: { short: 'Still + Motion', desc: 'Both formats · 5 KNYT' },
};

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

// ── 4-col character card grid item ────────────────────────────────────────────

function CharacterCardItem({
  epNum,
  thumbUrl,
  title,
  variant,
  onClick,
  onBuy,
}: {
  epNum: number;
  thumbUrl?: string;
  title?: string;
  variant: CardVariant;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
  const price = CARD_PRICES[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 w-full"
    >
      <div className="relative w-full aspect-[3/4] bg-slate-950 overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={title ?? `Card #${epNum}`} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-700">
            <User className="h-4 w-4" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
          <p className="text-[8px] text-slate-300 text-center">#{epNum}</p>
        </div>
        {variant === 'bundle' && (
          <div className="absolute top-1 left-1 rounded border border-teal-700/40 bg-teal-900/70 px-1 py-0.5 text-[8px] font-bold text-teal-300">
            S+M
          </div>
        )}
        {variant === 'motion' && (
          <div className="absolute top-1 left-1 rounded border border-cyan-700/40 bg-cyan-900/70 px-1 py-0.5 text-[8px] font-bold text-cyan-300">
            MO
          </div>
        )}
      </div>
      <div className="px-1.5 pt-1 pb-1.5 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight truncate">
          {title || `Character ${epNum}`}
        </p>
        <p className="text-xs font-bold text-white">${price}</p>
        <div className="flex justify-end pt-0.5">
          <CartButton onClick={onBuy} />
        </div>
      </div>
    </button>
  );
}

// ── Character card detail (2-col) — shows all 3 variants ─────────────────────

function CharacterCardDetail({
  epNum,
  thumbUrl,
  title,
  variant,
  onBuy,
}: {
  epNum: number;
  thumbUrl?: string;
  title?: string;
  variant: CardVariant;
  onBuy: (v: CardVariant) => void;
}) {
  const cardTitle = title || `Character #${epNum}`;

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      {/* Left: portrait */}
      <div className="space-y-2">
        <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-950 border border-white/5">
          {thumbUrl ? (
            <img src={thumbUrl} alt={cardTitle} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <User className="h-8 w-8 text-slate-700" />
            </div>
          )}
        </div>
        <div className="w-full text-center rounded-lg border border-sky-700/40 bg-sky-900/70 px-2 py-1 text-[10px] font-semibold text-sky-300">
          KNYT Character Card
        </div>
      </div>

      {/* Right: metadata + pricing per variant */}
      <div className="space-y-2.5 min-w-0">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Episode #{epNum}</p>
          <p className="text-sm font-bold text-white">{cardTitle}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Qripto rarity assigned on reveal · {QRIPTO_SUPPLY.toLocaleString()}-unit pool
          </p>
        </div>

        {/* Still */}
        <div className={`rounded-xl border p-2.5 space-y-1.5 transition-colors ${variant === 'still' ? 'border-purple-500/40 bg-purple-900/10' : 'border-white/5 bg-slate-900/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-300">Still</span>
            <span className="text-sm font-bold text-white">{CARD_KNYT_PRICES.still} KNYT <span className="text-[10px] text-slate-500">(${CARD_PRICES.still})</span></span>
          </div>
          <CartButton label="Buy Still" onClick={() => onBuy('still')} className="w-full justify-center" />
        </div>

        {/* Motion */}
        <div className={`rounded-xl border p-2.5 space-y-1.5 transition-colors ${variant === 'motion' ? 'border-cyan-500/40 bg-cyan-900/10' : 'border-white/5 bg-slate-900/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-300">Motion</span>
            <span className="text-sm font-bold text-white">{CARD_KNYT_PRICES.motion} KNYT <span className="text-[10px] text-slate-500">(${CARD_PRICES.motion})</span></span>
          </div>
          <p className="text-[9px] text-cyan-400">Animated card — all clips</p>
          <CartButton label="Buy Motion" onClick={() => onBuy('motion')} className="w-full justify-center" />
        </div>

        {/* Bundle */}
        <div className={`rounded-xl border p-2.5 space-y-1.5 transition-colors ${variant === 'bundle' ? 'border-teal-500/40 bg-teal-900/10' : 'border-white/5 bg-slate-900/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-300">Still + Motion</span>
            <span className="text-sm font-bold text-white">{CARD_KNYT_PRICES.bundle} KNYT <span className="text-[10px] text-slate-500">(${CARD_PRICES.bundle})</span></span>
          </div>
          <p className="text-[9px] text-teal-400">Both formats · save vs separate</p>
          <KnytPricePill basePrice={CARD_PRICES.bundle} />
          <CartButton label="Buy Bundle" onClick={() => onBuy('bundle')} className="w-full justify-center" />
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function KnytStoreCardsTab({ personaId, theme: _theme }: Props) {
  const [view, setView]         = useState<CardsView>({ kind: 'landing' });
  const [variant, setVariant]   = useState<CardVariant>('still');
  const [purchase, setPurchase] = useState<PendingPurchase | null>(null);
  const { characters, getCharacterThumb } = useKnytThumbnails();

  function getTitle(epNum: number): string | undefined {
    return characters.find((c) => c.episodeNumber === epNum)?.title;
  }

  function openPurchase(epNum: number, v: CardVariant) {
    const isMotion = v === 'motion';
    const isBundle = v === 'bundle';
    setPurchase({
      contentType:            isBundle ? 'character_card' : isMotion ? 'character_card_motion' : 'character_card',
      contentId:              `character-card-${epNum}-${v}`,
      contentTitle:           `${getTitle(epNum) ?? `Character #${epNum}`} — ${VARIANT_LABELS[v].short}`,
      contentImage:           getCharacterThumb(epNum),
      priceUsdOverride:       CARD_PRICES[v],
      stillPriceKnytOverride: CARD_KNYT_PRICES.still,
      motionPriceKnytOverride: CARD_KNYT_PRICES.motion,
    });
  }

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
        <User className="h-4 w-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">
          {view.kind === 'landing'
            ? 'KNYT Character Cards'
            : (getTitle(view.epNum) ?? `Character #${view.epNum}`)}
        </span>
      </div>

      {/* Variant selector */}
      <div className="flex-shrink-0 border-b border-slate-800/40 bg-slate-900/20 px-3 py-1.5 flex items-center gap-1">
        <span className="text-[10px] text-slate-500 mr-1">Format:</span>
        {(['still', 'motion', 'bundle'] as CardVariant[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVariant(v)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
              variant === v
                ? 'bg-teal-500/20 border border-teal-500/30 text-teal-300'
                : 'text-slate-400 hover:text-slate-300 border border-transparent'
            }`}
          >
            {VARIANT_LABELS[v].short}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-slate-500">{CARD_KNYT_PRICES[variant]} KNYT / card</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'landing' && (
          <div className="p-2.5 space-y-3">
            <p className="text-[11px] text-slate-400 px-0.5">
              13 KNYT character cards — one per episode. Each card drawn from its own {QRIPTO_SUPPLY.toLocaleString()}-unit Qripto pool.
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {CARD_EPISODE_NUMBERS.map((epNum) => (
                <CharacterCardItem
                  key={epNum}
                  epNum={epNum}
                  thumbUrl={getCharacterThumb(epNum)}
                  title={getTitle(epNum)}
                  variant={variant}
                  onClick={() => setView({ kind: 'detail', epNum })}
                  onBuy={(e) => { e.stopPropagation(); openPurchase(epNum, variant); }}
                />
              ))}
            </div>
          </div>
        )}

        {view.kind === 'detail' && (
          <CharacterCardDetail
            epNum={view.epNum}
            thumbUrl={getCharacterThumb(view.epNum)}
            title={getTitle(view.epNum)}
            variant={variant}
            onBuy={(v) => openPurchase(view.epNum, v)}
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
          stillPriceKnytOverride={purchase.stillPriceKnytOverride}
          motionPriceKnytOverride={purchase.motionPriceKnytOverride}
        />
      )}
    </div>
  );
}
