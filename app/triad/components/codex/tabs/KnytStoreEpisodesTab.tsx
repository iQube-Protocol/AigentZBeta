'use client';

import React from 'react';
import { useState } from 'react';
import { ArrowLeft, BookOpen, Film, Zap } from 'lucide-react';
import {
  EPISODE_PRICING,
  QRIPTO_SUPPLY,
  getEpisodePairPrice,
  getKnytDiscountedPrice,
  KNYT_COYN_DISCOUNT,
  type EpisodePricing,
} from '@/types/knyt-store';
import { useKnytThumbnails } from './useKnytThumbnails';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
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
  { id: 'gn-qripto',    label: 'GN Qripto',   sublabel: 'Collectible · Still', price: GN_EP?.qriptoPrice ?? 78,  layer: 'qripto'  },
  { id: 'gn-digital',   label: 'GN Digital',  sublabel: 'Digital · Still',     price: GN_EP?.digitalPrice ?? 78,  layer: 'digital' },
  { id: 'gn-paperback', label: 'Paperback',   sublabel: '−1α · Print',        price: GN_EP?.printVariants?.[0]?.price ?? 186, layer: 'print', printVariant: 'paperback' },
  { id: 'gn-hardcover', label: 'Hardcover',   sublabel: '−1β · Print',        price: GN_EP?.printVariants?.[1]?.price ?? 210, layer: 'print', printVariant: 'hardcover' },
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

// ── GN grid card (4-col, single price) ───────────────────────────────────────

function GNGridCard({ sku, thumbUrl, onClick }: { sku: GNSku; thumbUrl?: string; onClick: () => void }) {
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
        <div className={`absolute top-1 right-1 rounded border px-1 py-0.5 text-[7px] font-bold capitalize ${badgeClass}`}>
          {sku.layer}
        </div>
      </div>
      <div className="px-1.5 pt-1 pb-1.5">
        <p className="text-[10px] font-semibold text-white leading-tight">{sku.label}</p>
        <p className="text-[8px] text-slate-500 leading-tight">{sku.sublabel}</p>
        <p className="text-[11px] font-bold text-white mt-0.5">${sku.price}</p>
      </div>
    </button>
  );
}

// ── Episode grid card (4-col, 3-price strip) ─────────────────────────────────

function EpisodeGridCard({ ep, thumbUrl, onClick }: { ep: EpisodePricing; thumbUrl?: string; onClick: () => void }) {
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
      <div className="px-1.5 pt-1 pb-1.5">
        <p className="text-[10px] font-semibold text-white">Ep. {ep.episodeNumber}</p>
        <div className="flex justify-between mt-0.5">
          <span className="text-[7px] text-purple-400">Q ${ep.qriptoPrice}</span>
          <span className="text-[7px] text-sky-400">D ${ep.digitalPrice}</span>
          <span className="text-[7px] text-amber-400">P ${ep.printPrice}</span>
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
      {/* Still preview stub */}
      <div className="rounded-lg border border-white/10 bg-slate-800/40 px-2 py-1.5 flex items-start gap-1.5">
        <BookOpen className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[9px] text-slate-400 font-medium">Still Preview</p>
          <p className="text-[8px] text-slate-600">First 5 pages · PDF reader coming soon</p>
        </div>
      </div>
      {/* Motion preview stub (episodes only) */}
      {showMotionStub && (
        <div className="rounded-lg border border-white/10 bg-slate-800/40 px-2 py-1.5 flex items-start gap-1.5">
          <Film className="h-3 w-3 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] text-slate-400 font-medium">Motion Preview</p>
            <p className="text-[8px] text-slate-600">First 45 sec · Video player coming soon</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Episode detail — all 3 prices shown simultaneously ───────────────────────

function EpisodeDetail({ ep, thumbUrl }: { ep: EpisodePricing; thumbUrl?: string }) {
  const pairPrice = getEpisodePairPrice(ep);
  const amazonUrl = ep.printVariants?.[0]?.amazonUrl;

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      <PortraitColumn thumbUrl={thumbUrl} altText={`Episode ${ep.episodeNumber}`} showMotionStub />

      <div className="space-y-2 min-w-0">
        {/* Header */}
        <div>
          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Episode {ep.episodeNumber}</p>
          <p className="text-sm font-bold text-white">metaKnyt</p>
        </div>

        {/* Qripto */}
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5 space-y-1.5">
          <span className="rounded border border-purple-700/40 bg-purple-900/70 px-1.5 py-0.5 text-[7px] font-bold text-purple-300">
            Qripto
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">${ep.qriptoPrice}</span>
            <span className="text-[9px] text-slate-400">/ modal</span>
          </div>
          <KnytPricePill basePrice={ep.qriptoPrice} />
          <p className="text-[8px] text-slate-400">
            {QRIPTO_SUPPLY.toLocaleString()} total · 18 Legendary · 186 Epic · 1,656 Rare
          </p>
          <div className="flex gap-1">
            <div className="flex-1 rounded bg-slate-800/60 px-1 py-1 text-center">
              <p className="text-[7px] text-slate-500">Still</p>
              <p className="text-[10px] font-bold text-white">${ep.qriptoPrice}</p>
            </div>
            <div className="flex-1 rounded bg-slate-800/60 px-1 py-1 text-center">
              <p className="text-[7px] text-slate-500">Motion</p>
              <p className="text-[10px] font-bold text-white">${ep.qriptoPrice}</p>
            </div>
          </div>
        </div>

        {/* Digital */}
        <div className="rounded-xl border border-sky-800/30 bg-sky-900/10 p-2.5 space-y-1.5">
          <span className="rounded border border-sky-700/40 bg-sky-900/70 px-1.5 py-0.5 text-[7px] font-bold text-sky-300">
            Digital
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">${ep.digitalPrice}</span>
            <span className="text-[9px] text-slate-400">/ modal</span>
          </div>
          <KnytPricePill basePrice={ep.digitalPrice} />
          <p className="text-[8px] text-slate-400">Unlimited non-Qripto Digital editions</p>
          <div className="flex gap-1">
            <div className="flex-1 rounded bg-slate-800/60 px-1 py-1 text-center">
              <p className="text-[7px] text-slate-500">Still</p>
              <p className="text-[10px] font-bold text-white">${ep.digitalPrice}</p>
            </div>
            <div className="flex-1 rounded bg-slate-800/60 px-1 py-1 text-center">
              <p className="text-[7px] text-slate-500">Motion</p>
              <p className="text-[10px] font-bold text-white">${ep.digitalPrice}</p>
            </div>
          </div>
        </div>

        {/* Print */}
        <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5 space-y-1.5">
          <span className="rounded border border-amber-700/40 bg-amber-900/70 px-1.5 py-0.5 text-[7px] font-bold text-amber-300">
            Print
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-white">${ep.printPrice}</span>
            <span className="text-[9px] text-slate-400">USD</span>
          </div>
          <p className="text-[8px] text-slate-400">Unlimited first editions</p>
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
        </div>

        {/* Still + Motion Bundle */}
        <div className="rounded-xl border border-teal-800/30 bg-teal-900/10 p-2.5 space-y-1">
          <p className="text-[9px] font-semibold text-teal-300">Still + Motion Bundle</p>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-teal-400">${pairPrice}</span>
            <span className="text-[9px] text-slate-400">USD</span>
          </div>
          <p className="text-[8px] text-slate-500">Both modalities together · save 20%</p>
        </div>
      </div>
    </div>
  );
}

// ── GN SKU detail — focused single-format view ────────────────────────────────

function GNSkuDetail({ sku, thumbUrl }: { sku: GNSku; thumbUrl?: string }) {
  const isPrint  = sku.layer === 'print';
  const isQripto = sku.layer === 'qripto';

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      <PortraitColumn thumbUrl={thumbUrl} altText={sku.label} showMotionStub={false} />

      <div className="space-y-2.5 min-w-0">
        {/* Header */}
        <div>
          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Graphic Novel</p>
          <p className="text-sm font-bold text-white">{sku.label}</p>
          <p className="text-[9px] text-slate-400 mt-0.5">{sku.sublabel}</p>
        </div>

        {/* Price */}
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">${sku.price}</span>
            <span className="text-[10px] text-slate-400">{isPrint ? 'USD' : 'USD / modal'}</span>
          </div>
          {!isPrint && <KnytPricePill basePrice={sku.price} />}
          {isPrint && <p className="text-[9px] text-slate-500">Print · no $KNYT COYN discount</p>}
        </div>

        {/* Qripto supply */}
        {isQripto && (
          <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5">
            <p className="text-[9px] font-semibold text-purple-300 mb-1">
              {QRIPTO_SUPPLY.toLocaleString()} total editions
            </p>
            <p className="text-[8px] text-slate-300">18 Legendary · 186 Epic · 1,656 Rare</p>
            <p className="text-[8px] text-slate-500 mt-0.5">Rarity randomly assigned on reveal</p>
          </div>
        )}

        {/* Digital supply */}
        {sku.layer === 'digital' && (
          <div className="rounded-xl border border-sky-800/30 bg-sky-900/10 p-2.5">
            <p className="text-[9px] text-slate-300">Unlimited non-Qripto Digital editions</p>
          </div>
        )}

        {/* Print edition info */}
        {isPrint && (
          <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5">
            <p className="text-[9px] text-slate-300">Unlimited first edition</p>
            <p className="text-[8px] text-slate-500 mt-0.5">
              {sku.printVariant === 'hardcover' ? 'Hardcover (−1β)' : 'Paperback (−1α)'}
            </p>
          </div>
        )}

        {/* Modal */}
        {!isPrint && (
          <div className="rounded-lg border border-white/10 bg-slate-800/40 px-2 py-2">
            <p className="text-[8px] text-slate-500 mb-1">Modal</p>
            <div className="flex gap-1">
              <div className="rounded bg-slate-700/60 px-2 py-1 flex items-center gap-1">
                <BookOpen className="h-2.5 w-2.5 text-slate-400" />
                <span className="text-[9px] text-slate-300">Still</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function KnytStoreEpisodesTab({ personaId: _personaId, theme: _theme }: Props) {
  const [view, setView] = useState<EpisodesView>({ kind: 'list' });
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
        {view.kind === 'list' && (
          <div className="p-2.5 space-y-4">
            {/* Graphic Novel — 4 SKUs, no motion */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Graphic Novel
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {GN_SKUS.map((sku) => (
                  <GNGridCard
                    key={sku.id}
                    sku={sku}
                    thumbUrl={getCoverThumb(-1)}
                    onClick={() => setView({ kind: 'gn-sku', sku })}
                  />
                ))}
              </div>
            </div>

            {/* Episodes 0–12 */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Episodes 0–12
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {episodes.map((ep) => (
                  <EpisodeGridCard
                    key={ep.episodeNumber}
                    ep={ep}
                    thumbUrl={getCoverThumb(ep.episodeNumber)}
                    onClick={() => setView({ kind: 'episode', ep })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {view.kind === 'episode' && (
          <EpisodeDetail ep={view.ep} thumbUrl={getCoverThumb(view.ep.episodeNumber)} />
        )}

        {view.kind === 'gn-sku' && (
          <GNSkuDetail sku={view.sku} thumbUrl={getCoverThumb(-1)} />
        )}
      </div>
    </div>
  );
}
