"use client";

/**
 * KnytsBridgeStandPanel — STAND stage surface for the KNYTS Bridge journey.
 *
 * Thin read-only rendering of GET /api/journey/knyts-bridge/stand (see
 * services/journey/knytsBridgeStand.ts). Never presents these numbers as a
 * unified reward ledger or Standing score — none exists yet; this shows the
 * real, individually-sourced counts as-is, per crossing.
 */

import React, { useEffect, useState } from "react";
import { Loader2, MessageCircle, Repeat2, Share2, Sparkles, Star, ThumbsUp } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import type { CrossingStanding, KnytsBridgeStand } from "@/services/journey/knytsBridgeStand";

interface Props {
  personaId?: string;
}

export function KnytsBridgeStandPanel({ personaId }: Props) {
  const [stand, setStand] = useState<KnytsBridgeStand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    personaFetch("/api/journey/knyts-bridge/stand", { cache: "no-store", personaIdHint: personaId })
      .then((res) => res.json())
      .then((j: { ok?: boolean; stand?: KnytsBridgeStand; error?: string }) => {
        if (cancelled) return;
        if (!j.ok || !j.stand) {
          setError(j.error ?? "Could not load your Standing");
          return;
        }
        setStand(j.stand);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your Standing"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  if (!personaId) {
    return <p className="text-xs text-slate-500">Claim your Passport to see your Standing.</p>;
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your Standing…
      </div>
    );
  }
  if (error) {
    return <p className="text-xs text-rose-300">{error}</p>;
  }
  if (!stand || stand.crossings.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Remix a Crossing Story and publish it to Pulse — every action on it will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Crossings" value={stand.totals.crossingsPublished} />
        <Stat label="Reactions" value={stand.totals.reactionsReceived} />
        <Stat label="Inspired remixes" value={stand.totals.inspiredRemixes} />
      </div>
      <div className="space-y-2">
        {stand.crossings.map((c) => (
          <CrossingRow key={c.crossingId} crossing={c} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 px-2 py-3">
      <div className="text-lg font-bold text-amber-300">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function CrossingRow({ crossing }: { crossing: CrossingStanding }) {
  const reactionTotal =
    crossing.reactions.spark + crossing.reactions.like + crossing.reactions.question + crossing.reactions.canon_worthy;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
      <p className="text-xs font-semibold text-white truncate mb-1">{crossing.title}</p>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-violet-300" />{crossing.reactions.spark}</span>
        <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3 text-cyan-300" />{crossing.reactions.like}</span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-slate-300" />{crossing.reactions.question}</span>
        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-amber-300" />{crossing.reactions.canon_worthy}</span>
        <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3 text-emerald-300" />{crossing.shareClicks + crossing.shareSignups + crossing.shareConversions}</span>
        <span className="inline-flex items-center gap-1"><Repeat2 className="h-3 w-3 text-amber-200" />{crossing.inspiredRemixes}</span>
        {reactionTotal === 0 && crossing.shareClicks + crossing.shareSignups + crossing.shareConversions === 0 && crossing.inspiredRemixes === 0 && (
          <span className="text-slate-600">No consequence yet — share it to start.</span>
        )}
      </div>
    </div>
  );
}

export default KnytsBridgeStandPanel;
