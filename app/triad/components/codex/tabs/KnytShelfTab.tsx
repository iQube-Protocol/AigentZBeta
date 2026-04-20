'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Film,
  Layers,
  Library,
  Loader2,
  Package,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  type ShelfItem,
  type AssetFamily,
  type QriptoRarity,
  type OwnedCollectibleState,
  type ShelfItemSource,
} from '@/types/knyt-store';

interface Props {
  personaId?: string;
  theme?: 'light' | 'dark';
}

type ShelfView = { kind: 'overview' } | { kind: 'collection'; group: string };

// ── Rarity badge ──────────────────────────────────────────────────────────────

const RARITY_STYLE: Record<QriptoRarity, string> = {
  legendary: 'bg-yellow-900/40 border-yellow-700/40 text-yellow-400',
  epic:      'bg-purple-900/40 border-purple-700/40 text-purple-400',
  rare:      'bg-sky-900/40 border-sky-700/40 text-sky-400',
  black:     'bg-slate-900 border-slate-600 text-slate-300',
};

function RarityBadge({ rarity }: { rarity: QriptoRarity }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${RARITY_STYLE[rarity]}`}>
      {rarity === 'black' ? 'Black Edition' : rarity}
    </span>
  );
}

// ── State badge ───────────────────────────────────────────────────────────────

const STATE_META: Record<OwnedCollectibleState, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  owned:      { icon: CheckCircle2, label: 'Owned',     color: 'text-emerald-400' },
  missing:    { icon: Circle,       label: 'Missing',   color: 'text-slate-500'   },
  claimable:  { icon: Star,         label: 'Claimable', color: 'text-yellow-400'  },
  complete:   { icon: CheckCircle2, label: 'Complete',  color: 'text-teal-400'    },
  incomplete: { icon: Clock,        label: 'Incomplete', color: 'text-slate-400'  },
};

function StateBadge({ state }: { state: OwnedCollectibleState }) {
  const m = STATE_META[state];
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${m.color}`}>
      <m.icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

// ── Family icon ───────────────────────────────────────────────────────────────

function FamilyIcon({ family }: { family: AssetFamily }) {
  if (family === 'motion-comics')  return <Film className="h-4 w-4 text-teal-400" />;
  if (family === 'still-comics')   return <BookOpen className="h-4 w-4 text-sky-400" />;
  if (family === 'knyt-cards')     return <Package className="h-4 w-4 text-purple-400" />;
  if (family === 'graphic-novel')  return <BookOpen className="h-4 w-4 text-amber-400" />;
  if (family === 'lore-docs' || family === 'scripts') return <Layers className="h-4 w-4 text-slate-400" />;
  return <Sparkles className="h-4 w-4 text-slate-500" />;
}

// ── Source chip ───────────────────────────────────────────────────────────────

const SOURCE_META: Record<ShelfItemSource, { label: string; color: string }> = {
  codex:      { label: 'Codex',      color: 'text-teal-400   bg-teal-900/30'   },
  cartridge:  { label: 'Cartridge',  color: 'text-sky-400    bg-sky-900/30'    },
  provenance: { label: 'Provenance', color: 'text-amber-400  bg-amber-900/30'  },
};

function SourceChip({ source }: { source: ShelfItemSource }) {
  const m = SOURCE_META[source];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${m.color}`}>{m.label}</span>
  );
}

// ── Shelf item card ───────────────────────────────────────────────────────────

function ShelfCard({ item }: { item: ShelfItem }) {
  const isDimmed = item.state === 'missing';

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
      isDimmed ? 'border-white/5 bg-slate-900/30 opacity-50' : 'border-white/5 bg-slate-900/60'
    }`}>
      {/* Thumbnail or placeholder */}
      <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center">
        {item.thumbnailUrl
          ? <img src={item.thumbnailUrl} alt={item.label} className="h-full w-full object-cover" />
          : <FamilyIcon family={item.family} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <SourceChip source={item.source} />
          {item.rarity && <RarityBadge rarity={item.rarity} />}
          {item.isVintage && (
            <span className="rounded border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">Vintage</span>
          )}
          {item.hasProvenance && (
            <span className="rounded border border-slate-600 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Provenance</span>
          )}
        </div>
        <p className="text-sm font-semibold text-white truncate">{item.label}</p>
        <StateBadge state={item.state} />
        {/* NBE/quest progression placeholder */}
        {item.progressionState && item.progressionState !== 'none' && (
          <p className="text-[10px] text-slate-500 mt-0.5">
            Journey: {item.progressionState === 'in-progress' ? 'In progress' : 'Complete'}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Overview stats ────────────────────────────────────────────────────────────

function ShelfStats({ items }: { items: ShelfItem[] }) {
  const owned     = items.filter((i) => i.state === 'owned' || i.state === 'complete').length;
  const missing   = items.filter((i) => i.state === 'missing').length;
  const claimable = items.filter((i) => i.state === 'claimable').length;

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { label: 'Owned',     value: owned,     color: 'text-emerald-400' },
        { label: 'Missing',   value: missing,   color: 'text-slate-400'   },
        { label: 'Claimable', value: claimable, color: 'text-yellow-400'  },
      ].map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-white/5 bg-slate-900/60 p-3 text-center">
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Mock/placeholder shelf data ───────────────────────────────────────────────
// Real data will come from getShelfOverview(personaId) service — wired once DB tables confirmed

function buildPlaceholderShelf(personaId: string | undefined): ShelfItem[] {
  if (!personaId) return [];
  return [
    { id: 'ep0-still',   personaId, source: 'codex',      family: 'still-comics',  label: 'Episode 0 — Still',          state: 'owned',     isQripto: false, episodeNumber: 0,  collectionGroup: 'episodes', progressionState: 'none' },
    { id: 'ep1-motion',  personaId, source: 'codex',      family: 'motion-comics', label: 'Episode 1 — Motion',          state: 'owned',     isQripto: false, episodeNumber: 1,  collectionGroup: 'episodes', progressionState: 'none' },
    { id: 'ep2-qripto',  personaId, source: 'codex',      family: 'motion-comics', label: 'Episode 2 — Qripto',          state: 'owned',     isQripto: true,  rarity: 'rare',    episodeNumber: 2,  collectionGroup: 'episodes' },
    { id: 'ep3-missing', personaId, source: 'codex',      family: 'still-comics',  label: 'Episode 3 — Still',           state: 'missing',   isQripto: false, episodeNumber: 3,  collectionGroup: 'episodes' },
    { id: 'cards-pack',  personaId, source: 'cartridge',  family: 'knyt-cards',    label: 'KNYT Cards Pack',             state: 'owned',     isQripto: false, collectionGroup: 'cards' },
    { id: 'ep1-vintage', personaId, source: 'codex',      family: 'motion-comics', label: 'Episode 1 — Vintage Edition', state: 'claimable', isQripto: true,  isVintage: true,   episodeNumber: 1,  collectionGroup: 'vintage' },
    { id: 'ep0-print',   personaId, source: 'provenance', family: 'still-comics',  label: 'Episode 0 — Print',           state: 'owned',     isQripto: false, hasProvenance: true, episodeNumber: 0, collectionGroup: 'provenance' },
  ];
}

// ── Root component ────────────────────────────────────────────────────────────

export function KnytShelfTab({ personaId, theme }: Props) {
  const [view,  setView]  = useState<ShelfView>({ kind: 'overview' });
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Placeholder — replace with getShelfOverview(personaId) service call
    setTimeout(() => {
      setItems(buildPlaceholderShelf(personaId));
      setLoading(false);
    }, 400);
  }, [personaId]);

  // Group items by collectionGroup
  const groups = Array.from(
    items.reduce((map, item) => {
      const g = item.collectionGroup ?? 'other';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
      return map;
    }, new Map<string, ShelfItem[]>())
  );

  const activeItems = view.kind === 'collection'
    ? (groups.find(([g]) => g === view.group)?.[1] ?? [])
    : [];

  const GROUP_LABELS: Record<string, string> = {
    episodes:   'Episodes',
    cards:      'KNYT Cards',
    vintage:    'Vintage',
    provenance: 'Print Provenance',
    other:      'Other',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        {view.kind === 'collection' && (
          <button
            type="button"
            onClick={() => setView({ kind: 'overview' })}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <Library className="h-4 w-4 text-teal-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-200">
          {view.kind === 'overview' ? 'KNYT Shelf' : GROUP_LABELS[view.group] ?? view.group}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          </div>
        ) : !personaId ? (
          <div className="p-6 text-center">
            <Library className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Connect your persona to view your KNYT Shelf.</p>
          </div>
        ) : view.kind === 'overview' ? (
          <div className="p-4">
            <ShelfStats items={items} />

            {/* Claimable highlight */}
            {items.some((i) => i.state === 'claimable') && (
              <div className="mb-4 rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-3 flex items-start gap-2">
                <Star className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-yellow-300">You have claimable items</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Vintage motion editions can be claimed as Qripto editions — rarity randomly assigned.
                  </p>
                </div>
              </div>
            )}

            {/* Collection groups */}
            <div className="space-y-3">
              {groups.map(([group, groupItems]) => {
                const ownedCount = groupItems.filter((i) => i.state === 'owned' || i.state === 'complete').length;
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setView({ kind: 'collection', group })}
                    className="w-full flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-4 hover:border-teal-500/30 hover:bg-slate-800/60 transition-colors"
                  >
                    <p className="text-sm font-semibold text-white">{GROUP_LABELS[group] ?? group}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="text-emerald-400 font-medium">{ownedCount}</span>
                      <span>/</span>
                      <span>{groupItems.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* NBE placeholder */}
            <div className="mt-4 rounded-xl border border-white/5 bg-slate-800/30 p-3 text-center">
              <Sparkles className="h-4 w-4 text-slate-600 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Quest and journey integration — coming soon</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {activeItems.map((item) => (
              <ShelfCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
