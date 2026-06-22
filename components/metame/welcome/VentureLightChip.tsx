"use client";

/**
 * VentureLightChip — aigentMe carousel chip that launches the Venture Light
 * wizard. Free for every citizen (one venture). Shows the venture name once
 * created, or "Start my venture" otherwise. Mirrors StandingCoreChip.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { VentureLightWizard } from "@/components/metame/setup/VentureLightWizard";

export function VentureLightChip({ personaId }: { personaId?: string }) {
  const [ventureName, setVentureName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await personaFetch("/api/venture/qubes", { personaIdHint: personaId, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const v = Array.isArray(data?.ventures) && data.ventures.length > 0 ? data.ventures[0] : null;
        setVentureName(v?.name ?? null);
      }
    } catch { /* best-effort */ } finally {
      setLoaded(true);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Venture Light — incubate one venture"
        className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 flex items-center gap-1 hover:brightness-110 ${
          ventureName
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-violet-500/10 border-violet-500/30 text-violet-300"
        }`}
      >
        <Sparkles className="w-3 h-3" />
        {ventureName ? `Venture: ${ventureName}` : "Start my venture"}
      </button>
      <VentureLightWizard
        open={open}
        onOpenChange={setOpen}
        personaId={personaId}
        onSaved={() => void load()}
      />
    </>
  );
}

export default VentureLightChip;
