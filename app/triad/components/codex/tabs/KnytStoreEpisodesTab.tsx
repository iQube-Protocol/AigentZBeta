'use client';

import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Film, ShoppingCart, Zap } from 'lucide-react';
import {
  EPISODE_PRICING,
  QRIPTO_SUPPLY,
  GN_PROVENANCE_PRICE_USD,
  GN_PROVENANCE_PRICE_KNYT,
  PRINT_PROVENANCE_PRICE_USD,
  PRINT_PROVENANCE_PRICE_KNYT,
  getEpisodePairPrice,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  usdToKnyt,
  type EpisodePricing,
} from '@/types/knyt-store';

type Modality = 'still' | 'motion' | 'bundle';
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
  hideVersionSelector?: boolean;
}

// ── GN SKUs — 4 fixed formats (no motion comic for GN) ────────────────────────

const GN_EP = EPISODE_PRICING.find((e) => e.episodeNumber === -1)!;

interface GNSku {
  id: string;
  label: string;
  sublabel: string;
  price: number;
  layer: 'qripto' | 'digital' | 'print';
  printVariant?: 'paperback' | 'hardcover';
}

const GN_SKUS: GNSku[] = [
  { id: 'gn-qripto',    label: 'GN Qripto',   sublabel: 'Collectible · 1,860 supply', price: GN_EP?.qriptoPrice ?? 78,                layer: 'qripto'  },
  { id: 'gn-digital',   label: 'GN Digital',  sublabel: 'Digital · Unlimited',        price: GN_EP?.digitalPrice ?? 52,               layer: 'digital' },
  { id: 'gn-paperback', label: 'Paperback',   sublabel: '−1α · Print',               price: GN_EP?.printVariants?.[0]?.price ?? 186, layer: 'print',  printVariant: 'paperback' },
  { id: 'gn-hardcover', label: 'Hardcover',   sublabel: '−1β · Print',               price: GN_EP?.printVariants?.[1]?.price ?? 210, layer: 'print',  printVariant: 'hardcover' },
];

// ── View state ────────────────────────────────────────────────────────────────

type EpisodesView =
  | { kind: 'list' }
  | { kind: 'episode'; ep: EpisodePricing }
  | { kind: 'gn-sku'; sku: GNSku };

// ── Style maps ────────────────────────────────────────────────────────────────

const LAYER_BADGE: Record<string, string> = {
  qripto:  'bg-purple-900/70 text-purple-300 border-purple-700/40',
  digital: 'bg-sky-900/70 text-sky-300 border-sky-700/40',
  print:   'bg-amber-900/70 text-amber-300 border-amber-700/40',
};

// ── Shared components ─────────────────────────────────────────────────────────

function KnytPricePill({ basePrice }: { basePrice: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded border border-yellow-700/40 bg-yellow-900/20 px-1.5 py-0.5">
      <Zap className="h-2.5 w-2.5 text-yellow-400 shrink-0" />
      <span className="text-[9px] text-yellow-300 font-medium">
        ${getKnytDiscountedPrice(basePrice).toFixed(2)} w/ KNYT
      </span>
      <span className="text-[8px] text-yellow-600">({Math.round(KNYT_COYN_DISCOUNT * 100)}% off)</span>
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
      className={`flex items-center gap-1 rounded-lg bg-teal-700/80 hover:bg-teal-600 px-2 py-1 text-[9px] font-semibold text-white transition-colors ${className ?? ''}`}
    >
      <ShoppingCart className="h-3 w-3 shrink-0" />
      {label && <span>{label}</span>}
    </button>
  );
}

// ── GN grid card (4-col, single price + cart) ────────────────────────────────

function GNGridCard({
  sku,
  thumbUrl,
  onClick,
  onBuy,
}: {
  sku: GNSku;
  thumbUrl?: string;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
  const badgeClass = LAYER_BADGE[sku.layer];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 w-full"
    >
      <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={sku.label} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-700">
            <Film className="h-5 w-5" />
          </div>
        )}
        <div className={`absolute top-1 right-1 rounded border px-1.5 py-0.5 text-[9px] font-bold capitalize ${badgeClass}`}>
          {sku.layer}
        </div>
      </div>
      <div className="px-1.5 pt-1 pb-1.5 space-y-1">
        <p className="text-[10px] font-semibold text-white leading-tight">{sku.label}</p>
        <p className="text-[9px] text-slate-500 leading-tight">{sku.sublabel}</p>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-white">${sku.price}</p>
          <CartButton onClick={onBuy} />
        </div>
      </div>
    </button>
  );
}

// ── Episode grid card (4-col, 3-price layout) ─────────────────────────────────
// Row 1: "Ep. N" left, "Print $X.XX" right
// Row 2: "Qripto $X" left, "Digital $X" right

function EpisodeGridCard({
  ep,
  thumbUrl,
  onClick,
  onBuy,
}: {
  ep: EpisodePricing;
  thumbUrl?: string;
  onClick: () => void;
  onBuy: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 w-full"
    >
      <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
        {thumbUrl ? (
          <img src={thumbUrl} alt={`Ep. ${ep.episodeNumber}`} className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-700">
            <Film className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="px-1.5 pt-1 pb-1.5 space-y-0.5">
        {/* Row 1: episode number + print price */}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold text-white">Ep. {ep.episodeNumber}</span>
          <span className="text-[10px] font-semibold text-amber-400">Print ${ep.printPrice}</span>
        </div>
        {/* Row 2: Qripto + Digital */}
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-purple-400">Qripto ${ep.qriptoPrice}</span>
          <span className="text-[10px] text-sky-400">Digital ${ep.digitalPrice}</span>
        </div>
        {/* Cart button */}
        <div className="flex justify-end pt-0.5">
          <CartButton onClick={onBuy} />
        </div>
      </div>
    </button>
  );
}

// ── Shared portrait column (left side of detail pages) ───────────────────────

function PortraitColumn({
  thumbUrl,
  altText,
  showMotionStub,
}: {
  thumbUrl?: string;
  altText: string;
  showMotionStub?: boolean;
}) {
  return (
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
      <div className="rounded-lg border border-white/10 bg-slate-800/40 px-2 py-1.5 flex items-start gap-1.5">
        <BookOpen className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] text-slate-400 font-medium">Still Preview</p>
          <p className="text-[9px] text-slate-600">First 5 pages · PDF reader coming soon</p>
        </div>
      </div>
      {showMotionStub && (
        <div className="rounded-lg border border-white/10 bg-slate-800/40 px-2 py-1.5 flex items-start gap-1.5">
          <Film className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium">Motion Preview</p>
            <p className="text-[9px] text-slate-600">First 45 sec · Video player coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Episode detail — all 3 prices shown simultaneously ───────────────────────

function EpisodeDetail({
  ep,
  thumbUrl,
  modality,
  onBuy,
}: {
  ep: EpisodePricing;
  thumbUrl?: string;
  modality: Modality;
  onBuy: (p: PendingPurchase) => void;
}) {
  const qriptoPairPrice  = getEpisodePairPrice(ep, 'qripto');
  const digitalPairPrice = getEpisodePairPrice(ep, 'digital');
  const pairPrice = getEpisodePairPrice(ep, 'digital'); // legacy — kept for print section
  const amazonUrl = ep.printVariants?.[0]?.amazonUrl;
  const label = `Episode ${ep.episodeNumber}`;

  const activeQriptoPrice  = modality === 'bundle' ? qriptoPairPrice  : ep.qriptoPrice;
  const activeDigitalPrice = modality === 'bundle' ? digitalPairPrice : ep.digitalPrice;
  const modalLabel = modality === 'bundle' ? 'Still + Motion' : modality === 'motion' ? 'Motion' : 'Still';

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      <PortraitColumn thumbUrl={thumbUrl} altText={label} showMotionStub />

      <div className="space-y-2 min-w-0">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Episode {ep.episodeNumber}</p>
          <p className="text-sm font-bold text-white">metaKnyt</p>
        </div>

        {/* Qripto */}
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-purple-700/40 bg-purple-900/70 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
              Qripto
            </span>
            <span className="text-[8px] text-purple-400/60 italic">{QRIPTO_SUPPLY.toLocaleString()} total</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">${activeQriptoPrice}</span>
            <span className="text-[10px] text-slate-400">/ {modalLabel}</span>
          </div>
          <KnytPricePill basePrice={activeQriptoPrice} />
          <p className="text-[9px] text-slate-400">18 Legendary · 186 Epic · 1,656 Rare · 2 Black</p>
          <CartButton
            label={`Buy Qripto ${modalLabel}`}
            onClick={() => onBuy({
              contentType: modality === 'bundle' ? 'bundle_3_still' : 'scroll_still',
              contentId: `episode-${ep.episodeNumber}-qripto-${modality}`,
              contentTitle: `${label} — Qripto ${modalLabel}`,
              contentImage: thumbUrl,
              priceUsdOverride: activeQriptoPrice,
              stillPriceKnytOverride: usdToKnyt(ep.qriptoPrice),
              motionPriceKnytOverride: usdToKnyt(ep.qriptoPrice),
            })}
            className="w-full justify-center"
          />
        </div>

        {/* Digital */}
        <div className="rounded-xl border border-sky-800/30 bg-sky-900/10 p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-sky-700/40 bg-sky-900/70 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
              Digital
            </span>
            <span className="text-[8px] text-sky-400/60 italic">Unlimited</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">${activeDigitalPrice}</span>
            <span className="text-[10px] text-slate-400">/ {modalLabel}</span>
          </div>
          <KnytPricePill basePrice={activeDigitalPrice} />
          <CartButton
            label={`Buy Digital ${modalLabel}`}
            onClick={() => onBuy({
              contentType: modality === 'bundle' ? 'bundle_3_still' : 'scroll_still',
              contentId: `episode-${ep.episodeNumber}-digital-${modality}`,
              contentTitle: `${label} — Digital ${modalLabel}`,
              contentImage: thumbUrl,
              priceUsdOverride: activeDigitalPrice,
              stillPriceKnytOverride: usdToKnyt(ep.digitalPrice),
              motionPriceKnytOverride: usdToKnyt(ep.digitalPrice),
            })}
            className="w-full justify-center"
          />
        </div>

        {/* Print */}
        <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5 space-y-1.5">
          <span className="rounded border border-amber-700/40 bg-amber-900/70 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
            Print Paperback
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">${ep.printPrice}</span>
            <span className="text-[10px] text-slate-400">USD</span>
          </div>
          <p className="text-[9px] text-slate-400">Unlimited first editions</p>
          {amazonUrl && (
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] text-amber-400 underline underline-offset-2 hover:text-amber-300"
            >
              <BookOpen className="h-2.5 w-2.5" /> Buy on Amazon →
            </a>
          )}
          <CartButton
            label="Buy Print"
            onClick={() => onBuy({
              contentType: 'scroll_still',
              contentId: `episode-${ep.episodeNumber}-print`,
              contentTitle: `${label} — Print`,
              contentImage: thumbUrl,
              priceUsdOverride: ep.printPrice,
              hideVersionSelector: true,
            })}
            className="w-full justify-center"
          />
        </div>

        {/* Still + Motion bundle savings note */}
        {modality !== 'bundle' && (
          <div className="rounded-lg border border-teal-800/20 bg-teal-900/10 px-2.5 py-1.5">
            <p className="text-[9px] text-teal-400">
              Switch to "Still + Motion" above to save 20% on both modalities together
              — Qripto ${qriptoPairPrice} · Digital ${digitalPairPrice}
            </p>
          </div>
        )}

        {/* Print Provenance */}
        <div className="rounded-lg border border-white/10 bg-slate-800/40 p-2.5 space-y-1">
          <p className="text-[10px] font-semibold text-slate-300">Print Provenance</p>
          <div className="flex items-baseline justify-between">
            <span className="text-[9px] text-slate-400">Register print copy</span>
            <span className="text-sm font-bold text-amber-400">
              ${PRINT_PROVENANCE_PRICE_USD}
              <span className="text-[9px] font-normal text-amber-600"> / {PRINT_PROVENANCE_PRICE_KNYT} KNYT</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GN SKU detail — focused single-format view ────────────────────────────────

function GNSkuDetail({
  sku,
  thumbUrl,
  onBuy,
}: {
  sku: GNSku;
  thumbUrl?: string;
  onBuy: (p: PendingPurchase) => void;
}) {
  const isPrint  = sku.layer === 'print';
  const isQripto = sku.layer === 'qripto';

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      <PortraitColumn thumbUrl={thumbUrl} altText={sku.label} showMotionStub={false} />

      <div className="space-y-2.5 min-w-0">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Graphic Novel</p>
          <p className="text-sm font-bold text-white">{sku.label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{sku.sublabel}</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
          {isQripto && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="rounded border border-purple-700/40 bg-purple-900/70 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                Qripto
              </span>
              <span className="text-[8px] text-purple-400/60 italic">Special Introductory Price</span>
            </div>
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">${sku.price}</span>
            <span className="text-[10px] text-slate-400">{isPrint ? 'USD' : 'USD / modal'}</span>
          </div>
          {!isPrint && <KnytPricePill basePrice={sku.price} />}
          {isPrint && <p className="text-[10px] text-slate-500">Print · no $KNYT COYN discount</p>}
        </div>

        {isQripto && (
          <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5">
            <p className="text-[10px] font-semibold text-purple-300 mb-1">
              {QRIPTO_SUPPLY.toLocaleString()} total editions
            </p>
            <p className="text-[9px] text-slate-300">18 Legendary · 186 Epic · 1,656 Rare</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Rarity randomly assigned on reveal</p>
          </div>
        )}

        {sku.layer === 'digital' && (
          <div className="rounded-xl border border-sky-800/30 bg-sky-900/10 p-2.5">
            <p className="text-[10px] text-slate-300">Unlimited non-Qripto Digital editions</p>
          </div>
        )}

        {isPrint && (
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5">
            <p className="text-[10px] text-slate-300">Unlimited first edition</p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {sku.printVariant === 'hardcover' ? 'Hardcover (−1β)' : 'Paperback (−1α)'}
            </p>
          </div>
        )}

        {!isPrint && (
          <div className="rounded-lg border border-white/10 bg-slate-800/40 px-2 py-2">
            <p className="text-[9px] text-slate-500 mb-1">Modal</p>
            <div className="flex gap-1">
              <div className="rounded bg-slate-700/60 px-2 py-1 flex items-center gap-1">
                <BookOpen className="h-2.5 w-2.5 text-slate-400" />
                <span className="text-[10px] text-slate-300">Still</span>
              </div>
            </div>
          </div>
        )}

        {/* GN Provenance (print only) */}
        {isPrint && (
          <div className="rounded-lg border border-white/10 bg-slate-800/40 p-2.5 space-y-1">
            <p className="text-[10px] font-semibold text-slate-300">Print Provenance</p>
            <div className="flex items-baseline justify-between">
              <span className="text-[9px] text-slate-400">Register print GN</span>
              <span className="text-sm font-bold text-amber-400">
                ${GN_PROVENANCE_PRICE_USD}
                <span className="text-[9px] font-normal text-amber-600"> / {GN_PROVENANCE_PRICE_KNYT} KNYT</span>
              </span>
            </div>
          </div>
        )}

        <CartButton
          label={`Buy ${sku.label}`}
          onClick={(e) => { e.stopPropagation(); onBuy({
            contentType: 'scroll_still',
            contentId: `gn-${sku.id}`,
            contentTitle: `metaKnyt GN — ${sku.label}`,
            contentImage: thumbUrl,
            priceUsdOverride: sku.price,
            hideVersionSelector: true,
          }); }}
          className="w-full justify-center"
        />
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function KnytStoreEpisodesTab({ personaId, theme: _theme }: Props) {
  const [view, setView]         = useState<EpisodesView>({ kind: 'list' });
  const [modality, setModality] = useState<Modality>('still');
  const [purchase, setPurchase] = useState<PendingPurchase | null>(null);
  const { getCoverThumb } = useKnytThumbnails();

  const episodes = EPISODE_PRICING
    .filter((e) => e.episodeNumber >= 0)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);

  const headerLabel =
    view.kind === 'list'     ? 'Episodes & Graphic Novel'
    : view.kind === 'gn-sku' ? `GN — ${view.sku.label}`
    : `Episode ${(view as { kind: 'episode'; ep: EpisodePricing }).ep.episodeNumber}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header with inline format selector */}
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
        <span className="text-sm font-semibold text-slate-200 flex-1 min-w-0 truncate">{headerLabel}</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <span className="text-[9px] text-slate-500 mr-0.5">Format:</span>
          {(['still', 'motion', 'bundle'] as Modality[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModality(m)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                modality === m
                  ? 'bg-teal-500/20 border border-teal-500/30 text-teal-300'
                  : 'text-slate-400 hover:text-slate-300 border border-transparent'
              }`}
            >
              {m === 'bundle' ? 'S+M' : m === 'still' ? 'Still' : 'Motion'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'list' && (
          <div className="p-2.5 space-y-4">
            {/* Graphic Novel — 4 SKUs, no motion */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Graphic Novel
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {GN_SKUS.map((sku) => {
                  const thumb = sku.printVariant === 'hardcover' ? getCoverThumb(-4) : getCoverThumb(-1);
                  return (
                    <GNGridCard
                      key={sku.id}
                      sku={sku}
                      thumbUrl={thumb}
                      onClick={() => setView({ kind: 'gn-sku', sku })}
                      onBuy={() => setPurchase({
                        contentType: 'scroll_still',
                        contentId: `gn-${sku.id}`,
                        contentTitle: `metaKnyt GN — ${sku.label}`,
                        contentImage: thumb,
                        priceUsdOverride: sku.price,
                        hideVersionSelector: true,
                      })}
                    />
                  );
                })}
              </div>
            </div>

            {/* Episodes 0–12 */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Episodes 0–12
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {episodes.map((ep) => {
                  const thumb = getCoverThumb(ep.episodeNumber);
                  return (
                    <EpisodeGridCard
                      key={ep.episodeNumber}
                      ep={ep}
                      thumbUrl={thumb}
                      onClick={() => setView({ kind: 'episode', ep })}
                      onBuy={() => setPurchase({
                        contentType: 'scroll_still',
                        contentId: `episode-${ep.episodeNumber}`,
                        contentTitle: `Episode ${ep.episodeNumber}`,
                        contentImage: thumb,
                        priceUsdOverride: ep.digitalPrice,
                        stillPriceKnytOverride: usdToKnyt(ep.digitalPrice),
                        motionPriceKnytOverride: usdToKnyt(ep.digitalPrice),
                      })}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view.kind === 'episode' && (
          <EpisodeDetail
            ep={view.ep}
            thumbUrl={getCoverThumb(view.ep.episodeNumber)}
            modality={modality}
            onBuy={setPurchase}
          />
        )}

        {view.kind === 'gn-sku' && (
          <GNSkuDetail
            sku={view.sku}
            thumbUrl={view.sku.printVariant === 'hardcover' ? getCoverThumb(-4) : getCoverThumb(-1)}
            onBuy={setPurchase}
          />
        )}
      </div>

      {/* Purchase modal */}
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
          hideVersionSelector={purchase.hideVersionSelector}
        />
      )}
    </div>
  );
}
