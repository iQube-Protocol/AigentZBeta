"use client";

import React, { useState } from "react";
import { BookOpen, Lock, Unlock, Play, Film } from "lucide-react";
import { useKnytThumbnails } from "./useKnytThumbnails";
import { EPISODE_PRICING, QRIPTO_RARITY_ORDER, type QriptoRarity } from "@/types/knyt-store";

interface ScrollsTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
}

const RARITY_STYLE: Record<QriptoRarity, { border: string; bg: string; badge: string; label: string }> = {
  legendary: { border: 'border-yellow-500',  bg: 'bg-yellow-900/20', badge: 'bg-black/60 text-yellow-400 border-yellow-600/60', label: 'Legendary' },
  epic:      { border: 'border-purple-500',  bg: 'bg-purple-900/20', badge: 'bg-black/60 text-purple-400 border-purple-600/60', label: 'Epic'      },
  rare:      { border: 'border-sky-500',     bg: 'bg-sky-900/20',    badge: 'bg-black/60 text-sky-400 border-sky-600/60',       label: 'Rare'      },
  black:     { border: 'border-slate-600',   bg: 'bg-slate-900/40',  badge: 'bg-black/80 text-slate-300 border-slate-500/60',   label: 'Black'     },
};

// Rare and Black share the same cover image; Legendary and Epic have distinct covers.
// Since we have one cover URL per episode from the API, we use the same image for all
// variants and differentiate only via rarity badge overlay.
// Legendary gets a gold tint overlay, Epic a purple tint — Rare/Black use the plain cover.
const RARITY_OVERLAY: Partial<Record<QriptoRarity, string>> = {
  legendary: 'after:absolute after:inset-0 after:bg-yellow-500/10 after:pointer-events-none',
  epic:      'after:absolute after:inset-0 after:bg-purple-500/10 after:pointer-events-none',
};

// Episodes 0–12 only (no GN in scrolls)
const SCROLL_EPISODES = EPISODE_PRICING.filter((e) => e.episodeNumber >= 0)
  .sort((a, b) => a.episodeNumber - b.episodeNumber);

// 4 variants shown per episode: Legendary, Epic, Rare, Black
const VARIANTS: QriptoRarity[] = ['legendary', 'epic', 'rare', 'black'];

type ViewMode = 'grid' | 'by-episode';

export function ScrollsTab({ theme = 'dark', density = 'wide', personaId: _personaId }: ScrollsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('by-episode');
  const { covers, getCoverThumb, loading } = useKnytThumbnails();
  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Loading scrolls…
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Digital Scrolls — Qripto Editions</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            1,860 total · 18 Legendary · 186 Epic · 1,656 Rare · 2 Black (mystery)
          </p>
        </div>
        <div className="flex gap-1">
          {(['by-episode', 'grid'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                viewMode === m
                  ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'by-episode' ? 'By Episode' : 'Grid'}
            </button>
          ))}
        </div>
      </div>

      {/* Rarity key */}
      <div className="flex flex-wrap gap-1.5">
        {VARIANTS.map((r) => (
          <span
            key={r}
            className={`rounded border px-2 py-0.5 text-[9px] font-semibold ${RARITY_STYLE[r].badge}`}
          >
            {RARITY_STYLE[r].label}
          </span>
        ))}
        <span className="text-[9px] text-slate-500 self-center ml-1">
          Rare & Black share cover · rarity assigned randomly on reveal
        </span>
      </div>

      {viewMode === 'by-episode' ? (
        /* ── By-episode view: one row per episode, 4 variant columns ── */
        <div className="space-y-3">
          {SCROLL_EPISODES.map((ep) => {
            const coverUrl = getCoverThumb(ep.episodeNumber);
            const hasEpisodeCover = Boolean(coverUrl);
            return (
              <div key={ep.episodeNumber} className={`rounded-xl border ${isDark ? 'border-white/5 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} p-2.5`}>
                <p className="text-[10px] font-semibold text-slate-400 mb-2">
                  Episode {ep.episodeNumber}
                  {ep.episodeNumber === 0 && !hasEpisodeCover && (
                    <span className="ml-2 text-amber-500">(cover pending)</span>
                  )}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {VARIANTS.map((rarity) => {
                    const style = RARITY_STYLE[rarity];
                    const overlay = RARITY_OVERLAY[rarity] ?? '';
                    return (
                      <div
                        key={rarity}
                        className={`relative rounded-lg border-2 overflow-hidden ${style.border} ${style.bg} ${overlay}`}
                      >
                        <div className="aspect-[2/3] bg-slate-800 flex items-center justify-center relative overflow-hidden">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={`Ep ${ep.episodeNumber} ${style.label}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Film className="w-6 h-6 text-slate-600" />
                          )}
                          {/* Rarity badge */}
                          <div className="absolute top-1 left-1">
                            <span className={`rounded border px-1 py-0.5 text-[7px] font-bold leading-none ${style.badge}`}>
                              {rarity === 'black' ? '⬛' : style.label.slice(0, 3).toUpperCase()}
                            </span>
                          </div>
                          {/* Lock/unlock stub */}
                          <div className="absolute top-1 right-1">
                            <div className="bg-red-500/20 border border-red-500/40 rounded-full p-0.5">
                              <Lock className="w-2.5 h-2.5 text-red-400" />
                            </div>
                          </div>
                        </div>
                        <div className="px-1 py-1 text-center">
                          <p className="text-[8px] font-medium text-slate-300 truncate">{style.label}</p>
                          <p className="text-[8px] text-slate-500">${ep.qriptoPrice}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Grid view: all episodes flat, grouped by rarity ── */
        <div className="space-y-4">
          {QRIPTO_RARITY_ORDER.map((rarity) => {
            const style = RARITY_STYLE[rarity];
            return (
              <div key={rarity}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${style.badge.split(' ').find(c => c.startsWith('text-')) ?? 'text-slate-400'}`}>
                  {style.label}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {SCROLL_EPISODES.map((ep) => {
                    const coverUrl = getCoverThumb(ep.episodeNumber);
                    return (
                      <div
                        key={ep.episodeNumber}
                        className={`relative rounded-lg border-2 overflow-hidden ${style.border} ${style.bg}`}
                      >
                        <div className="aspect-[2/3] bg-slate-800 flex items-center justify-center">
                          {coverUrl ? (
                            <img src={coverUrl} alt={`Ep ${ep.episodeNumber}`} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <BookOpen className="w-8 h-8 text-slate-600" />
                          )}
                          <div className="absolute top-2 right-2">
                            <div className="bg-red-500/20 border border-red-500 rounded-full p-1">
                              <Lock className="w-3 h-3 text-red-400" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2">
                            <div className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${style.badge}`}>
                              {style.label}
                            </div>
                          </div>
                        </div>
                        <div className="p-2 bg-slate-800/50">
                          <p className="text-[10px] font-medium">Ep. {ep.episodeNumber}</p>
                          <p className="text-[9px] text-slate-400">${ep.qriptoPrice}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
