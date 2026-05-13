"use client";

/**
 * MetaMeNbeTab — ranked Next Best Experiences/Actions.
 *
 * Posts to /api/assistant/brief (daily) and surfaces the nextBestActions
 * the same way the welcome tab does, with optional cartridge filtering.
 * Reuses NextBestActionCard.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

import { personaFetch } from "@/utils/personaSpine";
import {
  NextBestActionCard,
  type NextBestActionData,
} from "@/components/metame/cards/NextBestActionCard";

interface BriefShape {
  context: {
    activeCartridges: string[];
    personalGuide?: { guidanceNote: string };
  };
  nextBestActions: NextBestActionData[];
}

const ALL = "__all__";

export function MetaMeNbeTab({ personaId }: { personaId?: string }) {
  const [brief, setBrief] = useState<BriefShape | null>(null);
  const [loading, setLoading] = useState(!!personaId);
  const [error, setError] = useState<string | null>(null);
  const [cartridgeFilter, setCartridgeFilter] = useState<string>(ALL);

  const load = useCallback(async (scopedCartridge?: string) => {
    if (!personaId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const body = scopedCartridge && scopedCartridge !== ALL
        ? { briefType: "cartridge", scopedCartridge }
        : { briefType: "daily" };
      const res = await personaFetch("/api/assistant/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        personaIdHint: personaId,
      });
      if (!res.ok) throw new Error(`brief failed (${res.status})`);
      const data = (await res.json()) as BriefShape;
      setBrief(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void load(cartridgeFilter); }, [load, cartridgeFilter]);

  const cartridges = brief?.context.activeCartridges ?? [];

  return (
    <div className="p-4 sm:p-6 w-full text-slate-100 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Next Best Experiences
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministically ranked actions across your active cartridges, biased by stage and personal guide context.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(cartridgeFilter)}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 hover:border-violet-500/60 text-xs text-slate-300 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </header>

      {brief?.context.personalGuide?.guidanceNote && (
        <p className="text-xs text-slate-400 italic">{brief.context.personalGuide.guidanceNote}</p>
      )}

      {/* Cartridge filter */}
      {cartridges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCartridgeFilter(ALL)}
            className={`px-2.5 py-1 rounded-full border text-xs transition ${
              cartridgeFilter === ALL
                ? "bg-violet-500/20 border-violet-500 text-violet-200"
                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
            }`}
          >
            All
          </button>
          {cartridges.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCartridgeFilter(c)}
              className={`px-2.5 py-1 rounded-full border text-xs transition ${
                cartridgeFilter === c
                  ? "bg-violet-500/20 border-violet-500 text-violet-200"
                  : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">{error}</div>
      )}

      {loading && !brief ? (
        <div className="flex items-center justify-center min-h-[160px] text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Ranking next best actions…
        </div>
      ) : brief && brief.nextBestActions.length > 0 ? (
        <div className="space-y-3">
          {brief.nextBestActions.map((a, idx) => (
            <NextBestActionCard
              key={a.id}
              action={a}
              variant={idx === 0 ? "hero" : "compact"}
              theme="dark"
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No next-best actions surfaced for the current scope.</p>
      )}
    </div>
  );
}

export default MetaMeNbeTab;
