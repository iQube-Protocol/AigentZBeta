'use client';

import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Plus, ShoppingCart, User, Zap } from 'lucide-react';
import {
  QRIPTO_SUPPLY,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  usdToKnyt,
  type CartItem,
} from '@/types/knyt-store';
import { useKnytThumbnails } from './useKnytThumbnails';
import { useKnytCart } from './useKnytCart';
import { useOwnedEntitlements } from '@/app/hooks/useOwnedEntitlements';
import { KnytCartDrawer } from './KnytCartDrawer';
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
  onAddToCart,
  className,
}: {
  label?: string;
  onClick: (e: React.MouseEvent) => void;
  onAddToCart?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  if (!onAddToCart) {
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
  return (
    <div className={`flex rounded-lg overflow-hidden ${className ?? ''}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        className="flex-1 flex items-center justify-center gap-1 bg-teal-700/80 hover:bg-teal-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors"
        title={label ? `${label} — buy now` : 'Buy now'}
      >
        <ShoppingCart className="h-3 w-3 shrink-0" />
        {label && <span>{label}</span>}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onAddToCart(e); }}
        className="flex items-center justify-center bg-teal-800/80 hover:bg-teal-700 px-2 py-1 text-white transition-colors border-l border-teal-900/50"
        title="Add to cart"
      >
        <Plus className="h-3 w-3 shrink-0" />
      </button>
    </div>
  );
}

// ── 4-col character card grid item ────────────────────────────────────────────

function CharacterCardItem({
  epNum,
  thumbUrl,
  title,
  variant,
  isOwned,
  onClick,
  onBuy,
  onAddToCart,
}: {
  epNum: number;
  thumbUrl?: string;
  title?: string;
  variant: CardVariant;
  isOwned?: boolean;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
  onAddToCart?: (e: React.MouseEvent) => void;
}) {
  const price = CARD_PRICES[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col rounded-xl border overflow-hidden text-left transition-colors w-full ${
        isOwned
          ? 'border-emerald-700/40 bg-emerald-900/10 hover:border-emerald-600/50 hover:bg-emerald-900/20'
          : 'border-white/5 bg-slate-900/60 hover:border-teal-500/20 hover:bg-slate-800/60'
      }`}
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
        {isOwned && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded border border-emerald-600/50 bg-emerald-900/80 px-1 py-0.5">
            <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[8px] font-bold text-emerald-300">Owned</span>
          </div>
        )}
        {!isOwned && variant === 'bundle' && (
          <div className="absolute top-1 left-1 rounded border border-teal-700/40 bg-teal-900/70 px-1 py-0.5 text-[8px] font-bold text-teal-300">
            S+M
          </div>
        )}
        {!isOwned && variant === 'motion' && (
          <div className="absolute top-1 left-1 rounded border border-cyan-700/40 bg-cyan-900/70 px-1 py-0.5 text-[8px] font-bold text-cyan-300">
            MO
          </div>
        )}
      </div>
      <div className="px-1.5 pt-1 pb-1.5 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight truncate">
          {title || `Character ${epNum}`}
        </p>
        {isOwned ? (
          <p className="text-[10px] font-semibold text-emerald-400">In Library</p>
        ) : (
          <p className="text-xs font-bold text-white">${price}</p>
        )}
        {!isOwned && (
          <div className="flex justify-end pt-0.5">
            <CartButton onClick={onBuy} onAddToCart={onAddToCart} />
          </div>
        )}
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
  onAddToCart,
}: {
  epNum: number;
  thumbUrl?: string;
  title?: string;
  variant: CardVariant;
  onBuy: (v: CardVariant) => void;
  onAddToCart?: (v: CardVariant) => void;
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
          <CartButton label="Buy Still" onClick={() => onBuy('still')} onAddToCart={onAddToCart && (() => onAddToCart('still'))} className="w-full justify-center" />
        </div>

        {/* Motion */}
        <div className={`rounded-xl border p-2.5 space-y-1.5 transition-colors ${variant === 'motion' ? 'border-cyan-500/40 bg-cyan-900/10' : 'border-white/5 bg-slate-900/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-300">Motion</span>
            <span className="text-sm font-bold text-white">{CARD_KNYT_PRICES.motion} KNYT <span className="text-[10px] text-slate-500">(${CARD_PRICES.motion})</span></span>
          </div>
          <p className="text-[9px] text-cyan-400">Animated card — all clips</p>
          <CartButton label="Buy Motion" onClick={() => onBuy('motion')} onAddToCart={onAddToCart && (() => onAddToCart('motion'))} className="w-full justify-center" />
        </div>

        {/* Bundle */}
        <div className={`rounded-xl border p-2.5 space-y-1.5 transition-colors ${variant === 'bundle' ? 'border-teal-500/40 bg-teal-900/10' : 'border-white/5 bg-slate-900/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-300">Still + Motion</span>
            <span className="text-sm font-bold text-white">{CARD_KNYT_PRICES.bundle} KNYT <span className="text-[10px] text-slate-500">(${CARD_PRICES.bundle})</span></span>
          </div>
          <p className="text-[9px] text-teal-400">Both formats · save vs separate</p>
          <KnytPricePill basePrice={CARD_PRICES.bundle} />
          <CartButton label="Buy Bundle" onClick={() => onBuy('bundle')} onAddToCart={onAddToCart && (() => onAddToCart('bundle'))} className="w-full justify-center" />
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
  const [cartOpen, setCartOpen] = useState(false);
  const { characters, getCharacterThumb } = useKnytThumbnails();
  const cart = useKnytCart();
  const { ownedAssetIds } = useOwnedEntitlements(personaId);

  function isCardOwned(epNum: number): boolean {
    return (
      ownedAssetIds.has(`character-card-${epNum}-still`) ||
      ownedAssetIds.has(`character-card-${epNum}-motion`) ||
      ownedAssetIds.has(`character-card-${epNum}-bundle`)
    );
  }

  function addPendingToCart(p: PendingPurchase) {
    const modalityVal: CartItem['modality'] = p.contentType.includes('motion')
      ? 'motion'
      : p.contentType.startsWith('bundle')
      ? 'bundle'
      : 'still';
    const item: CartItem = {
      id:          p.contentId ?? `${p.contentType}-${p.contentTitle}`,
      label:       p.contentTitle,
      modality:    modalityVal,
      layer:       'digital',
      priceUsd:    p.priceUsdOverride ?? 0,
      thumbUrl:    p.contentImage,
      contentType: p.contentType as CartItem['contentType'],
    };
    cart.addToCart(item);
    setCartOpen(true);
  }

  function getTitle(epNum: number): string | undefined {
    return characters.find((c) => c.episodeNumber === epNum)?.title;
  }

  /** Builds the PendingPurchase payload for a given (epNum, variant). Used by both
      the express-buy path and the add-to-cart path so the same SKU shape is
      authoritative for both flows. */
  function buildPendingPurchase(epNum: number, v: CardVariant): PendingPurchase {
    const title = getTitle(epNum) ?? `Character #${epNum}`;
    const image = getCharacterThumb(epNum);
    if (v === 'bundle') {
      return {
        contentType:            'bundle_3_still',  // triggers "Bundle includes both Still & Motion" badge
        contentId:              `character-card-${epNum}-bundle`,
        contentTitle:           `${title} — Still + Motion`,
        contentImage:           image,
        priceUsdOverride:       CARD_PRICES.bundle,
        stillPriceKnytOverride: CARD_KNYT_PRICES.bundle, // 5 KNYT combined
      };
    }
    return {
      contentType:             v === 'motion' ? 'character_card_motion' : 'character_card',
      contentId:               `character-card-${epNum}-${v}`,
      contentTitle:            `${title} — ${VARIANT_LABELS[v].short}`,
      contentImage:            image,
      priceUsdOverride:        CARD_PRICES[v],
      stillPriceKnytOverride:  CARD_KNYT_PRICES.still,
      motionPriceKnytOverride: CARD_KNYT_PRICES.motion,
    };
  }

  function openPurchase(epNum: number, v: CardVariant) {
    setPurchase(buildPendingPurchase(epNum, v));
  }

  function addCardToCart(epNum: number, v: CardVariant) {
    addPendingToCart(buildPendingPurchase(epNum, v));
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
        {view.kind === 'detail' && (
          <span className="text-sm font-semibold text-slate-200 min-w-0 truncate">
            {getTitle(view.epNum) ?? `Character #${view.epNum}`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
          <span className="text-[9px] text-slate-500 mr-0.5">Format:</span>
          {(['still', 'motion', 'bundle'] as CardVariant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                variant === v
                  ? 'bg-teal-500/20 border border-teal-500/30 text-teal-300'
                  : 'text-slate-400 hover:text-slate-300 border border-transparent'
              }`}
            >
              {v === 'bundle' ? 'S+M' : v === 'still' ? 'Still' : 'Motion'}
            </button>
          ))}
          <span className="text-[9px] text-slate-500 ml-1">{CARD_KNYT_PRICES[variant]} KNYT</span>
        </div>
        {/* Cart badge */}
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          title="Open cart"
        >
          <ShoppingCart className="h-4 w-4" />
          {cart.count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-teal-500 text-[8px] font-bold text-white flex items-center justify-center">
              {cart.count}
            </span>
          )}
        </button>
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
                  isOwned={isCardOwned(epNum)}
                  onClick={() => setView({ kind: 'detail', epNum })}
                  onBuy={(e) => { e.stopPropagation(); openPurchase(epNum, variant); }}
                  onAddToCart={(e) => { e.stopPropagation(); addCardToCart(epNum, variant); }}
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
            onAddToCart={(v) => addCardToCart(view.epNum, v)}
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

      {/* Cart drawer */}
      <KnytCartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart.items}
        onRemove={cart.removeFromCart}
        onSetQty={cart.setQty}
        onClearCart={cart.clearCart}
        personaId={personaId}
        total={cart.total}
        totalWithKnyt={cart.totalWithKnyt}
      />
    </div>
  );
}
