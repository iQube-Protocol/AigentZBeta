"use client";

import React from "react";
import { Loader2, Package, Lock, Unlock, Users } from "lucide-react";
import { useContentQubeSeries } from "./useContentQubeSeries";

interface CharactersTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  personaId?: string;
}

export function CharactersTab({ theme = 'dark', density = 'wide', personaId }: CharactersTabProps) {
  const { qubes, loading, error } = useContentQubeSeries('metaKnyts', {
    contentKind: 'character',
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-slate-400">
        Unable to load characters. {error}
      </div>
    );
  }

  if (qubes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <Users className="w-8 h-8 text-slate-600" />
        <p className="text-sm text-slate-400">No character cards registered yet.</p>
      </div>
    );
  }

  // Sort by display_number (episode index) so characters appear in story order.
  const sorted = [...qubes].sort((a, b) => {
    const an = a.manifest.display_number ?? 9999;
    const bn = b.manifest.display_number ?? 9999;
    return an - bn;
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Character Cards</h3>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {sorted.length} character{sorted.length !== 1 ? 's' : ''} · metaKnyts series
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map(({ manifest }) => {
          const owned = manifest.persona_owns;
          return (
            <div
              key={manifest.id}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                owned
                  ? 'border-teal-500/30 bg-teal-900/10'
                  : 'border-white/5 bg-slate-900/60'
              }`}
            >
              {/* Placeholder thumbnail */}
              <div className="h-12 w-10 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-600" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {manifest.title ?? `Character #${manifest.display_number ?? '?'}`}
                </p>
                {manifest.display_number != null && (
                  <p className="text-[10px] text-slate-500">Episode {manifest.display_number}</p>
                )}
                <div className="mt-1 flex items-center gap-1">
                  {owned ? (
                    <>
                      <Unlock className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-emerald-400 font-medium">Owned</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500">
                        {manifest.gating_kind === 'free' ? 'Free' : `$${((manifest.price_qc ?? 0) / 100).toFixed(2)}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
