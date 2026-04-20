'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
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
import { useKnytThumbnails } from './useKnytThumbnails';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type Modality = 'still' | 'motion';
type Layer = 'digital' | 'print' | 'qripto';

// ── GN SKU definitions ────────────────────────────────────────────────────────
// Each GN format is a separate card in the grid

const GN_EP = EPISODE_PRICING.find((e) => e.episodeNumber === -1)!;

interface GNSku {
  id: string;
  label: string;
  sublabel: string;
  price: number | null; // null = coming soon
  layer: Layer | 'coming-soon';
  modality?: Modality;
  amazonUrl?: string;
}

const GN_SKUS: GNSku[] = [
  { id: 'gn-qripto',    label: 'GN Qripto',   sublabel: 'Collectible · Still', price: 78,  layer: 'qripto',        modality: 'still' },
  { id: 'gn-digital',   label: 'GN Digital',  sublabel: 'Digital · Still',     price: 78,  layer: 'digital',       modality: 'still' },
  { id: 'gn-motion',    label: 'GN Motion',   sublabel: 'Coming Soon',         price: null, layer: 'coming-soon'  },
  { id: 'gn-paperback', label: 'Paperback',   sublabel: '−1α · Print',        price: 186, layer: 'print',         amazonUrl: GN_EP?.printVariants?.[0]?.amazonUrl },
  { id: 'gn-hardcover', label: 'Hardcover',   sublabel: '−1β · Print',        price: 210, layer: 'print',         amazonUrl: GN_EP?.printVariants?.[1]?.amazonUrl },
];

// ── View state ────────────────────────────────────────────────────────────────

type EpisodesView =
  | { kind: 'list' }
  | { kind: 'episode'; ep: EpisodePricing; layer: Layer; modality: Modality }
  | { kind: 'gn-sku'; sku: GNSku };

// ── Style maps ────────────────────────────────────────────────────────────────

const LAYER_BADGE: Record<string, string> = {
  qripto:        'bg-purple-900/70 text-purple-300 border-purple-700/40',
  digital:       'bg-sky-900/70 text-sky-300 border-sky-700/40',
  print:         'bg-amber-900/70 text-amber-300 border-amber-700/40',
  'coming-soon': 'bg-slate-800 text-slate-400 border-slate-600/40',
};

const LAYER_ACTIVE: Record<string, string> = {
  qripto:  'border-purple-500/50 bg-purple-900/30 text-purple-200',
  digital: 'border-sky-500/50 bg-sky-900/30 text-sky-200',
  print:   'border-amber-500/50 bg-amber-900/30 text-amber-200',
};

// ── Shared price pill ─────────────────────────────────────────────────────────

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

// ── Grid card (4-col) ─────────────────────────────────────────────────────────

function GridCard({
  label,
  sublabel,
  price,
  layerKey,
  thumbUrl,
  isComingSoon,
  onClick,
}: {
  label: string;
  sublabel?: string;
  price: number | null;
  layerKey: string;
  thumbUrl?: string;
  isComingSoon?: boolean;
  onClick: () => void;
}) {
  const badgeClass = LAYER_BADGE[layerKey] ?? LAYER_BADGE.digital;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isComingSoon}
      className="flex flex-col rounded-xl border border-white/5 bg-slate-900/60 overflow-hidden text-left transition-colors hover:border-teal-500/20 hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-default w-full"
    >
      {/* Portrait thumbnail — object-contain to show full cover, no crop */}
      <div className="relative w-full aspect-[2/3] bg-slate-950 overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={label}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-700">
            <Film className="h-5 w-5" />
          </div>
        )}
        {isComingSoon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-[8px] font-semibold text-slate-300 bg-slate-800/90 rounded px-1.5 py-0.5">
              Soon
            </span>
          </div>
        )}
        {/* Layer badge */}
        <div className={`absolute top-1 right-1 rounded border px-1 py-0.5 text-[7px] font-bold capitalize ${badgeClass}`}>
          {layerKey === 'coming-soon' ? 'Soon' : layerKey}
        </div>
      </div>

      {/* Label + price */}
      <div className="px-1.5 pt-1.5 pb-2 space-y-0.5">
        <p className="text-[10px] font-semibold text-white leading-tight">{label}</p>
        {sublabel && <p className="text-[8px] text-slate-500 leading-tight">{sublabel}</p>}
        <p className={`text-[11px] font-bold ${isComingSoon ? 'text-slate-600' : 'text-white'}`}>
          {price !== null ? `$${price}` : '—'}
        </p>
      </div>
    </button>
  );
}

// ── 2-column detail — left: portrait image + format picker, right: metadata ───

function DetailLayout({
  thumbUrl,
  altText,
  layerKey,
  children,
  formatPicker,
}: {
  thumbUrl?: string;
  altText: string;
  layerKey: string;
  children: React.ReactNode;
  formatPicker?: React.ReactNode;
}) {
  const badgeClass = LAYER_BADGE[layerKey] ?? LAYER_BADGE.digital;
  const layerLabel = layerKey === 'coming-soon' ? 'Coming Soon'
    : layerKey.charAt(0).toUpperCase() + layerKey.slice(1);

  return (
    <div className="p-3 grid grid-cols-2 gap-3 items-start">
      {/* Left column: portrait image, layer badge, format picker */}
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
        <div className={`w-full text-center rounded-lg border px-2 py-1 text-[9px] font-semibold ${badgeClass}`}>
          {layerLabel}
        </div>
        {formatPicker}
      </div>

      {/* Right column: all metadata — scrolls independently if needed */}
      <div className="space-y-2.5 min-w-0">
        {children}
      </div>
    </div>
  );
}

// ── Episode detail (selectable layer + modality) ──────────────────────────────

function EpisodeDetail({
  ep,
  layer,
  modality,
  thumbUrl,
  onLayerChange,
  onModalityChange,
}: {
  ep: EpisodePricing;
  layer: Layer;
  modality: Modality;
  thumbUrl?: string;
  onLayerChange: (l: Layer) => void;
  onModalityChange: (m: Modality) => void;
}) {
  const isPrint  = layer === 'print';
  const isQripto = layer === 'qripto';
  const price    = isPrint ? ep.printPrice : ep.digitalPrice;
  const pairPrice = getEpisodePairPrice(ep);
  const amazonUrl = ep.printVariants?.[0]?.amazonUrl;

  const formatPicker = (
    <div className="space-y-1">
      {/* Layer toggle */}
      <div className="flex gap-0.5">
        {(['qripto', 'digital', 'print'] as Layer[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onLayerChange(l)}
            className={`flex-1 py-1 rounded text-[8px] font-semibold transition-colors ${
              layer === l ? LAYER_ACTIVE[l] : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
            }`}
          >
            {l === 'qripto' ? 'Q' : l === 'digital' ? 'Dig' : 'Print'}
          </button>
        ))}
      </div>
      {/* Modality toggle */}
      {!isPrint && (
        <div className="flex gap-0.5">
          {(['still', 'motion'] as Modality[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModalityChange(m)}
              className={`flex-1 flex items-center justify-center gap-0.5 py-1 rounded text-[8px] font-medium transition-colors ${
                modality === m
                  ? 'bg-teal-800/40 border border-teal-600/40 text-teal-300'
                  : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'still' ? <ImageIcon className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <DetailLayout
      thumbUrl={thumbUrl}
      altText={`Episode ${ep.episodeNumber}`}
      layerKey={layer}
      formatPicker={formatPicker}
    >
      {/* Title */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wide">Episode {ep.episodeNumber}</p>
        <p className="text-sm font-bold text-white leading-snug">
          {isQripto ? 'Qripto' : isPrint ? 'Print' : 'Digital'}
          {!isPrint && ` · ${modality === 'still' ? 'Still' : 'Motion'}`}
        </p>
      </div>

      {/* Main price */}
      <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-white">${price}</span>
          <span className="text-[10px] text-slate-400">USD</span>
        </div>
        {!isPrint && <KnytPricePill basePrice={price} />}
        {isPrint && <p className="text-[9px] text-slate-500">Print · no KNYT discount</p>}
      </div>

      {/* Amazon */}
      {isPrint && amazonUrl && (
        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-700/40 bg-amber-900/10 py-2 text-[10px] font-semibold text-amber-300 hover:bg-amber-800/20 transition-colors"
        >
          <BookOpen className="h-3 w-3" /> Buy on Amazon
        </a>
      )}

      {/* Qripto rarity */}
      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-purple-300 mb-1.5">
            Qripto · {QRIPTO_SUPPLY.toLocaleString()} supply
          </p>
          {QRIPTO_RARITY_ORDER.map((r) => {
            const cfg = QRIPTO_RARITY_CONFIG[r];
            return (
              <div key={r} className="flex justify-between text-[9px] mb-0.5">
                <span className="capitalize text-slate-300">{r}</span>
                <span className="text-slate-500">{cfg.supply.toLocaleString()}</span>
              </div>
            );
          })}
          <p className="text-[8px] text-slate-600 mt-1">Random at mint · Black = hidden anomaly</p>
        </div>
      )}

      {/* Still + Motion pair — with prominent price */}
      {!isPrint && (
        <div className="rounded-xl border border-teal-800/30 bg-teal-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-teal-300">Still + Motion Pair</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[9px] text-slate-400">Both formats together</span>
            <span className="text-base font-bold text-teal-400">${pairPrice}</span>
          </div>
          <p className="text-[8px] text-slate-500 mt-0.5">Save 20% vs buying separately</p>
        </div>
      )}

      {/* Print Provenance — with prominent price */}
      {!isQripto && (
        <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-amber-300">Print Provenance</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[9px] text-slate-400">Register print copy</span>
            <span className="text-sm font-bold text-amber-400">
              ${PRINT_PROVENANCE_PRICE_USD}
              <span className="text-[8px] font-normal text-amber-600"> / {PRINT_PROVENANCE_PRICE_KNYT} KNYT</span>
            </span>
          </div>
          <button type="button" className="mt-1 text-[9px] text-amber-400 underline underline-offset-2">
            Register →
          </button>
        </div>
      )}

      {/* Vintage */}
      {!isPrint && (
        <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-yellow-300">Vintage Editions</p>
          <p className="text-[8px] text-slate-400 mt-0.5">
            Prior owners may be eligible for a Vintage Qripto upgrade.
          </p>
        </div>
      )}
    </DetailLayout>
  );
}

// ── GN SKU detail (fixed format) ──────────────────────────────────────────────

function GNSkuDetail({ sku, thumbUrl }: { sku: GNSku; thumbUrl?: string }) {
  const isPrint  = sku.layer === 'print';
  const isQripto = sku.layer === 'qripto';
  const isSoon   = sku.layer === 'coming-soon';
  const pairPrice = GN_EP ? getEpisodePairPrice(GN_EP) : null;

  return (
    <DetailLayout
      thumbUrl={thumbUrl}
      altText={sku.label}
      layerKey={sku.layer}
    >
      {/* Title */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase tracking-wide">Graphic Novel</p>
        <p className="text-sm font-bold text-white leading-snug">{sku.label}</p>
        <p className="text-[9px] text-slate-400">{sku.sublabel}</p>
      </div>

      {/* Price or coming soon */}
      {isSoon ? (
        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-300">Coming Soon</p>
            <p className="text-[9px] text-slate-500">Motion GN in production</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3 space-y-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">${sku.price}</span>
            <span className="text-[10px] text-slate-400">USD</span>
          </div>
          {!isPrint && <KnytPricePill basePrice={sku.price!} />}
          {isPrint && <p className="text-[9px] text-slate-500">Print · no KNYT discount</p>}
        </div>
      )}

      {/* Amazon */}
      {isPrint && sku.amazonUrl && (
        <a
          href={sku.amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-700/40 bg-amber-900/10 py-2 text-[10px] font-semibold text-amber-300 hover:bg-amber-800/20 transition-colors"
        >
          <BookOpen className="h-3 w-3" /> Buy on Amazon
        </a>
      )}

      {/* Qripto rarity */}
      {isQripto && (
        <div className="rounded-xl border border-purple-800/30 bg-purple-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-purple-300 mb-1.5">
            Qripto · {QRIPTO_SUPPLY.toLocaleString()} supply
          </p>
          {QRIPTO_RARITY_ORDER.map((r) => {
            const cfg = QRIPTO_RARITY_CONFIG[r];
            return (
              <div key={r} className="flex justify-between text-[9px] mb-0.5">
                <span className="capitalize text-slate-300">{r}</span>
                <span className="text-slate-500">{cfg.supply.toLocaleString()}</span>
              </div>
            );
          })}
          <p className="text-[8px] text-slate-600 mt-1">Random at mint · Black = hidden anomaly</p>
        </div>
      )}

      {/* Pair pricing — prominent */}
      {!isPrint && !isSoon && pairPrice && (
        <div className="rounded-xl border border-teal-800/30 bg-teal-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-teal-300">Still + Motion Pair</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[9px] text-slate-400">Both formats</span>
            <span className="text-base font-bold text-teal-400">${pairPrice}</span>
          </div>
          <p className="text-[8px] text-slate-500 mt-0.5">−20% · Motion coming soon</p>
        </div>
      )}

      {/* Print Provenance — prominent */}
      {!isQripto && !isSoon && (
        <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-amber-300">Print Provenance</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-[9px] text-slate-400">Register print</span>
            <span className="text-sm font-bold text-amber-400">
              ${PRINT_PROVENANCE_PRICE_USD}
              <span className="text-[8px] font-normal text-amber-600"> / {PRINT_PROVENANCE_PRICE_KNYT} KNYT</span>
            </span>
          </div>
          <button type="button" className="mt-1 text-[9px] text-amber-400 underline underline-offset-2">
            Register →
          </button>
        </div>
      )}

      {/* Vintage */}
      {!isPrint && !isSoon && (
        <div className="rounded-xl border border-yellow-800/30 bg-yellow-900/10 p-2.5">
          <p className="text-[9px] font-semibold text-yellow-300">Vintage Editions</p>
          <p className="text-[8px] text-slate-400 mt-0.5">
            Prior owners may be eligible for a Vintage Qripto upgrade.
          </p>
        </div>
      )}
    </DetailLayout>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function KnytStoreEpisodesTab({ personaId: _personaId, theme: _theme }: Props) {
  const [view, setView] = useState<EpisodesView>({ kind: 'list' });
  const [layer, setLayer] = useState<Layer>('digital');
  const [modality, setModality] = useState<Modality>('still');
  const { getCoverThumb } = useKnytThumbnails();

  // Episodes 0–12 sorted
  const episodes = EPISODE_PRICING
    .filter((e) => e.episodeNumber >= 0)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);

  // Header label
  const headerLabel =
    view.kind === 'list'
      ? 'Episodes & Graphic Novel'
      : view.kind === 'gn-sku'
      ? `GN — ${view.sku.label}`
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
            {/* ── Graphic Novel section ── */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Graphic Novel
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {GN_SKUS.map((sku) => (
                  <GridCard
                    key={sku.id}
                    label={sku.label}
                    sublabel={sku.sublabel}
                    price={sku.price}
                    layerKey={sku.layer}
                    thumbUrl={getCoverThumb(-1)}
                    isComingSoon={sku.layer === 'coming-soon'}
                    onClick={() => setView({ kind: 'gn-sku', sku })}
                  />
                ))}
              </div>
            </div>

            {/* ── Episodes 0–12 section ── */}
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-0.5 mb-2">
                Episodes 0–12
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {episodes.map((ep) => (
                  <GridCard
                    key={ep.episodeNumber}
                    label={`Ep. ${ep.episodeNumber}`}
                    sublabel={`$${ep.digitalPrice}/mod`}
                    price={ep.digitalPrice}
                    layerKey="digital"
                    thumbUrl={getCoverThumb(ep.episodeNumber)}
                    onClick={() => {
                      setLayer('digital');
                      setModality('still');
                      setView({ kind: 'episode', ep, layer: 'digital', modality: 'still' });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {view.kind === 'episode' && (
          <EpisodeDetail
            ep={view.ep}
            layer={layer}
            modality={modality}
            thumbUrl={getCoverThumb(view.ep.episodeNumber)}
            onLayerChange={(l) => {
              setLayer(l);
              setView({ ...view, layer: l });
            }}
            onModalityChange={(m) => {
              setModality(m);
              setView({ ...view, modality: m });
            }}
          />
        )}

        {view.kind === 'gn-sku' && (
          <GNSkuDetail sku={view.sku} thumbUrl={getCoverThumb(-1)} />
        )}
      </div>
    </div>
  );
}
