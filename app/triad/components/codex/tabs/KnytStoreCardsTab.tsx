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

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

interface PendingPurchase {
  contentId: string;
  contentTitle: string;
  contentImage?: string;
  priceUsdOverride: number;
}

type CardsView = { kind: 'landing' } | { kind: 'detail'; epNum: number };

const CARD_EPISODE_NUMBERS = Array.from({ length: 13 }, (_, i) => i);
const CARD_PRICE_USD = 2;

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
  onClick,
  onBuy,
}: {
  epNum: number;
  thumbUrl?: string;
  title?: string;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
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
      </div>
      <div className="px-1.5 pt-1 pb-1.5 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight truncate">
          {title || `Character ${epNum}`}
        </p>
        <p className="text-xs font-bold text-white">${CARD_PRICE_USD}</p>
        <div className="flex justify-end pt-0.5">
          <CartButton onClick={onBuy} />
        </div>
      </div>
    </button>
  );
}

// ── Character card detail (2-col) ─────────────────────────────────────────────

function CharacterCardDetail({
  epNum,
  thumbUrl,
  title,
  onBuy,
}: {
  epNum: number;
  thumbUrl?: string;
  title?: string;
  onBuy: () => void;
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

      {/* Right: metadata + pricing */}
      <div className="space-y-2.5 min-w-0">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Episode #{epNum}</p>
          <p className="text-sm font-bold text-white">{cardTitle}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Digital character card — Qripto rarity assigned on reveal
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">${CARD_PRICE_USD}</span>
            <span className="text-[11px] text-slate-400">USD</span>
          </div>
          <KnytPricePill basePrice={CARD_PRICE_USD} />
          <CartButton
            label="Add to Cart"
            onClick={() => onBuy()}
            className="w-full justify-center mt-1"
          />
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-2.5">
          <p className="text-[10px] font-semibold text-slate-300">
            Part of the 13-card set
          </p>
          <p className="text-[9px] text-slate-500 mt-0.5">
            Each card independently drawn from its own {QRIPTO_SUPPLY.toLocaleString()}-unit Qripto pool.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function KnytStoreCardsTab({ personaId, theme: _theme }: Props) {
  const [view, setView]         = useState<CardsView>({ kind: 'landing' });
  const [purchase, setPurchase] = useState<PendingPurchase | null>(null);
  const { characters, getCharacterThumb } = useKnytThumbnails();

  function getTitle(epNum: number): string | undefined {
    return characters.find((c) => c.episodeNumber === epNum)?.title;
  }

  function openPurchase(epNum: number) {
    setPurchase({
      contentId:        `character-card-${epNum}`,
      contentTitle:     getTitle(epNum) ?? `Character #${epNum}`,
      contentImage:     getCharacterThumb(epNum),
      priceUsdOverride: CARD_PRICE_USD,
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'landing' && (
          <div className="p-2.5 space-y-3">
            <p className="text-[11px] text-slate-400 px-0.5">
              13 KNYT character cards — one per episode. Each has independently assigned Qripto
              rarity from a {QRIPTO_SUPPLY.toLocaleString()}-unit pool.
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {CARD_EPISODE_NUMBERS.map((epNum) => (
                <CharacterCardItem
                  key={epNum}
                  epNum={epNum}
                  thumbUrl={getCharacterThumb(epNum)}
                  title={getTitle(epNum)}
                  onClick={() => setView({ kind: 'detail', epNum })}
                  onBuy={(e) => { e.stopPropagation(); openPurchase(epNum); }}
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
            onBuy={() => openPurchase(view.epNum)}
          />
        )}
      </div>

      {purchase && (
        <ContentPurchaseModal
          open={true}
          onClose={() => setPurchase(null)}
          personaId={personaId}
          contentType="character_card"
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
