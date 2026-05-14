'use client';

import React, { useMemo, useState } from 'react';
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
import { useContentQubeSeriesRights } from '@/app/triad/components/codex/tabs/useContentQubeSeriesRights';

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

type ShelfItemExt = ShelfItem & { comingSoon?: boolean };

function ShelfCard({ item }: { item: ShelfItemExt }) {
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
        {item.comingSoon ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Owned · <span className="text-slate-400">Coming Soon</span>
          </span>
        ) : (
          <StateBadge state={item.state} />
        )}
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

// ── Root component ────────────────────────────────────────────────────────────

export function KnytShelfTab({ personaId, theme }: Props) {
  const [view, setView] = useState<ShelfView>({ kind: 'overview' });

  // Phase B canonicalization (2026-05-14) — read inventory + ownership from
  // the ContentQube registry's persona-rights view. Returns the union of
  // real content_qubes rows (with persona_owns from evaluateAccess) and
  // synthesized placeholders for SKU-granted-but-unproduced slots
  // (manifest.is_placeholder = true, lifecycle_state = 'draft').
  //
  // Replaces the legacy useOwnedEntitlements → /api/codex/owned path so the
  // shelf agrees with ScrollsTab / CharactersTab / KnytTab on what is owned.
  const { qubes, loading } = useContentQubeSeriesRights('metaKnyts', {
    personaId,
    skip: !personaId,
  });

  // Build shelf items from registry qubes. Preserves the legacy semantic
  // where episode_still + episode_print collapse into a single "still-comics"
  // tile per episode (one tile per episode-and-motion-flag pairing), so the
  // operator-expected 40-item total for a Top KNYT Shelf persona still holds:
  //   13 still tiles + 13 motion tiles + 13 cards + 1 GN.
  const items = useMemo<ShelfItemExt[]>(() => {
    if (!personaId) return [];

    // Only render qubes the persona actually owns (real OR placeholder).
    const owned = qubes.filter((q) => q.manifest.persona_owns);

    // Two-pass merge for episodes: collapse all qubes for the same
    // (episodeNumber, motion-flag) into one tile. Coming-soon wins only
    // if EVERY underlying qube is coming-soon (i.e. all placeholders or
    // all draft lifecycle).
    type Bucket = {
      tileKey: string;
      qubeIds: string[];
      titles: (string | null)[];
      episodeNumber: number | null;
      isMotion: boolean;
      kind: 'episode' | 'character' | 'gn';
      anyAvailable: boolean;
      anyComingSoon: boolean;
    };

    const buckets = new Map<string, Bucket>();
    for (const q of owned) {
      const m = q.manifest;
      const isMotion = m.content_type === 'episode_motion';
      const isComingSoon = m.is_placeholder === true
        || m.lifecycle_state === 'draft'
        || m.lifecycle_state === 'semi_minted';
      const isAvailable = !isComingSoon;

      let kind: Bucket['kind'];
      let tileKey: string;
      switch (m.content_kind) {
        case 'gn':
          kind = 'gn';
          tileKey = 'gn';
          break;
        case 'character':
        case 'powers_sheet':
          kind = 'character';
          tileKey = `character:${m.display_number ?? 'unknown'}`;
          break;
        case 'episode':
        default:
          kind = 'episode';
          tileKey = `episode:${m.display_number ?? 'unknown'}:${isMotion ? 'motion' : 'still'}`;
          break;
      }

      let bucket = buckets.get(tileKey);
      if (!bucket) {
        bucket = {
          tileKey,
          qubeIds: [],
          titles: [],
          episodeNumber: m.display_number,
          isMotion,
          kind,
          anyAvailable: false,
          anyComingSoon: false,
        };
        buckets.set(tileKey, bucket);
      }
      bucket.qubeIds.push(m.id);
      bucket.titles.push(m.title);
      if (isAvailable)   bucket.anyAvailable = true;
      if (isComingSoon)  bucket.anyComingSoon = true;
    }

    const tiles: ShelfItemExt[] = [];
    for (const b of buckets.values()) {
      let family: AssetFamily;
      let collectionGroup: string;
      let label: string;

      if (b.kind === 'gn') {
        family = 'graphic-novel';
        collectionGroup = 'graphic-novel';
        label = b.titles.find((t) => !!t) || 'KNYT Graphic Novel';
      } else if (b.kind === 'character') {
        family = 'knyt-cards';
        collectionGroup = 'cards';
        label = b.titles.find((t) => !!t)
          || (b.episodeNumber != null ? `Character — Episode ${b.episodeNumber}` : 'KNYT Character');
      } else {
        family = b.isMotion ? 'motion-comics' : 'still-comics';
        collectionGroup = 'episodes';
        label = b.titles.find((t) => !!t)
          || (b.episodeNumber != null ? `Episode ${b.episodeNumber}` : 'Episode');
      }

      tiles.push({
        id: b.tileKey,
        personaId,
        source: (b.kind === 'character' ? 'cartridge' : 'codex') as ShelfItemSource,
        family,
        label,
        thumbnailUrl: undefined,
        state: 'owned' as OwnedCollectibleState,
        isQripto: b.kind === 'gn',
        episodeNumber: b.episodeNumber ?? undefined,
        collectionGroup,
        progressionState: 'none',
        comingSoon: !b.anyAvailable && b.anyComingSoon,
      });
    }

    // Stable sort: episodes by number, then characters by number, then GN.
    return tiles.sort((a, b) => {
      const groupRank = (g: string) =>
        g === 'episodes' ? 0
        : g === 'cards' ? 1
        : g === 'graphic-novel' ? 2 : 3;
      const ga = groupRank(a.collectionGroup ?? '');
      const gb = groupRank(b.collectionGroup ?? '');
      if (ga !== gb) return ga - gb;
      // Within episodes: still tiles before motion, then by episode number.
      if (a.collectionGroup === 'episodes' && b.collectionGroup === 'episodes') {
        const aMotion = a.family === 'motion-comics' ? 1 : 0;
        const bMotion = b.family === 'motion-comics' ? 1 : 0;
        if (aMotion !== bMotion) return aMotion - bMotion;
      }
      return (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0);
    });
  }, [qubes, personaId]);

  // Group items by collectionGroup
  const groups = Array.from(
    items.reduce((map, item) => {
      const g = item.collectionGroup ?? 'other';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
      return map;
    }, new Map<string, ShelfItemExt[]>())
  );

  const activeItems = view.kind === 'collection'
    ? (groups.find(([g]) => g === view.group)?.[1] ?? [])
    : [];

  const GROUP_LABELS: Record<string, string> = {
    'graphic-novel': 'Graphic Novel',
    episodes:        'Episodes',
    cards:           'KNYT Cards',
    bundles:         'Bundles',
    vintage:         'Vintage',
    provenance:      'Print Provenance',
    other:           'Other',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mini-toolbar (back button + collection title in collection view) */}
      {view.kind === 'collection' && (
        <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView({ kind: 'overview' })}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-200">
            {GROUP_LABELS[view.group] ?? view.group}
          </span>
        </div>
      )}

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
